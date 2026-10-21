import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SMTP_SETUP_INSTRUCTIONS, type AppEnv } from "@/lib/config/env";

/**
 * Email provider abstraction.
 *
 * - ResendProvider sends via the Resend HTTP API (transactional email service).
 * - SmtpProvider sends via Gmail SMTP (smtp.gmail.com:465, implicit TLS) using
 *   Nodemailer with credentials from server-side environment variables only.
 * - DevOutboxProvider writes messages to `.email-outbox/` for local
 *   development. It NEVER delivers real email and the admin dashboard clearly
 *   labels these messages as simulated.
 *
 * Errors are classified so the outbox can retry only transient failures
 * (rate limits, network, 5xx) and give up on permanent ones (invalid address,
 * auth errors).
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export class EmailSendError extends Error {
  readonly transient: boolean;
  readonly code: string;

  constructor(message: string, opts: { transient: boolean; code: string }) {
    super(message);
    this.name = "EmailSendError";
    this.transient = opts.transient;
    this.code = opts.code;
  }
}

export interface EmailProvider {
  readonly name: string;
  /** True when messages are only simulated locally (never delivered). */
  readonly simulated: boolean;
  send(email: OutgoingEmail, env: AppEnv): Promise<{ providerMessageId: string | null }>;
}

// ---------------------------------------------------------------------------
// Resend (https://resend.com) — HTTP API, no SDK dependency
// ---------------------------------------------------------------------------

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  readonly simulated = false;

  async send(email: OutgoingEmail, env: AppEnv): Promise<{ providerMessageId: string | null }> {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailSendError(`Network error calling Resend: ${(error as Error).message}`, {
        transient: true,
        code: "network_error",
      });
    }

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { providerMessageId: body.id ?? null };
    }

    // Drain the body so the connection can be reused; never log it (may
    // contain addresses) and never include the API key in errors.
    await response.text().catch(() => "");
    const status = response.status;
    const transient = status === 429 || status >= 500;
    const code = status === 429 ? "rate_limited" : `http_${status}`;
    // Never include the API key or full response body (may contain addresses) in the error.
    throw new EmailSendError(`Resend API returned HTTP ${status}`, { transient, code });
  }
}

// ---------------------------------------------------------------------------
// Development outbox — files on disk, clearly simulated
// ---------------------------------------------------------------------------

export class DevOutboxProvider implements EmailProvider {
  readonly name = "dev-outbox";
  readonly simulated = true;

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string | null }> {
    const dir = path.join(process.cwd(), ".email-outbox");
    await mkdir(dir, { recursive: true });
    const id = `dev-${randomUUID()}`;
    const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
    const file = path.join(dir, `${stamp}_${id}.json`);
    await writeFile(
      file,
      JSON.stringify(
        {
          simulated: true,
          note: "This email was NOT delivered to a real recipient. Development outbox only.",
          providerMessageId: id,
          to: email.to,
          from: "(dev-outbox)",
          subject: email.subject,
          text: email.text,
          html: email.html,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    return { providerMessageId: id };
  }
}

// ---------------------------------------------------------------------------
// Gmail SMTP (smtp.gmail.com) — Nodemailer, implicit TLS on port 465
// ---------------------------------------------------------------------------

/**
 * Minimal transport shape so tests can inject a fake without a network.
 * Nodemailer's `Transporter` is structurally compatible.
 */
export interface SmtpTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }): Promise<{
    messageId?: string;
    accepted?: unknown[];
    rejected?: unknown[];
  }>;
}

interface SmtpErrorShape {
  code?: string;
  responseCode?: number;
  message?: string;
}

/**
 * Classify an SMTP failure for the outbox retry policy:
 * - Permanent (no retry): authentication failures, envelope/message rejections
 *   with a 5xx reply, oversized messages, missing configuration.
 * - Transient (bounded retries with backoff): network/timeouts and 4xx replies.
 * Unknown errors are treated as transient — retries are capped at
 * `maxAttempts` either way, so nothing is retried indefinitely.
 *
 * The password never appears in these messages (Nodemailer does not include
 * it, and the caller additionally redacts the username).
 */
export function classifySmtpError(error: unknown): {
  transient: boolean;
  code: string;
  message: string;
} {
  const err = (error ?? {}) as SmtpErrorShape;
  const errCode = typeof err.code === "string" ? err.code : "";
  const responseCode = typeof err.responseCode === "number" ? err.responseCode : undefined;
  const raw = (typeof err.message === "string" ? err.message : String(error)).slice(0, 300);
  const message = `SMTP ${errCode || "error"}${responseCode ? ` (${responseCode})` : ""}: ${raw}`;

  // Permanent authentication/configuration failures — must never be retried.
  if (errCode === "EAUTH") return { transient: false, code: "smtp_auth_failed", message };
  if (errCode === "EMSMLIMIT" || errCode === "EMSGSIZE") {
    return { transient: false, code: "smtp_message_rejected", message };
  }
  if (responseCode !== undefined && responseCode >= 500) {
    return { transient: false, code: "smtp_perm_error", message };
  }
  if (errCode === "EENVELOPE") {
    // No numeric reply: an envelope rejection is a recipient/sender problem —
    // retrying the same envelope would fail the same way.
    return { transient: false, code: "smtp_envelope_rejected", message };
  }
  if (responseCode !== undefined && responseCode >= 400) {
    return { transient: true, code: "smtp_temp_error", message };
  }
  return { transient: true, code: "smtp_network_error", message };
}

export class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  readonly simulated = false;

  private transportPromise: Promise<SmtpTransport> | null = null;
  private reportedUnconfigured = false;

  /** `transportFactory` exists for tests (no network in unit tests). */
  constructor(private readonly transportFactory?: () => SmtpTransport) {}

  private async getTransport(env: AppEnv): Promise<SmtpTransport> {
    if (this.transportFactory) return this.transportFactory();
    if (!this.transportPromise) {
      this.transportPromise = import("nodemailer").then((mod) => {
        const nodemailer = mod.default;
        return nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: env.GMAIL_USER.trim(),
            // App passwords are conventionally shown with spaces; Gmail
            // expects the 16 characters without whitespace.
            pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
          },
          connectionTimeout: 15_000,
          greetingTimeout: 10_000,
          socketTimeout: 30_000,
        }) as unknown as SmtpTransport;
      });
    }
    return this.transportPromise;
  }

  async send(email: OutgoingEmail, env: AppEnv): Promise<{ providerMessageId: string | null }> {
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
      // Dev-friendly but honest: nothing is faked. The outbox records this as
      // a permanent failure with the setup instructions, and sending stays
      // disabled until credentials are configured.
      if (!this.reportedUnconfigured) {
        console.error(`[email-smtp] sending disabled.\n${SMTP_SETUP_INSTRUCTIONS}`);
        this.reportedUnconfigured = true;
      }
      throw new EmailSendError(SMTP_SETUP_INSTRUCTIONS, {
        transient: false,
        code: "smtp_not_configured",
      });
    }

    const transport = await this.getTransport(env);
    let result: Awaited<ReturnType<SmtpTransport["sendMail"]>>;
    try {
      result = await transport.sendMail({
        from: env.EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      });
    } catch (error) {
      if (error instanceof EmailSendError) throw error;
      const classified = classifySmtpError(error);
      // Never leak the mailbox identity into stored errors/logs.
      const redacted = env.GMAIL_USER
        ? classified.message.split(env.GMAIL_USER).join("[redacted]")
        : classified.message;
      throw new EmailSendError(redacted, {
        transient: classified.transient,
        code: classified.code,
      });
    }

    // SMTP answered 2xx but did not accept the recipient — do NOT report this
    // as accepted. (Nodemailer normally raises EENVELOPE instead.)
    if ((result.rejected?.length ?? 0) > 0 && (result.accepted?.length ?? 0) === 0) {
      throw new EmailSendError("SMTP server rejected the recipient address.", {
        transient: false,
        code: "smtp_envelope_rejected",
      });
    }

    // "providerMessageId" only — the caller marks the job `accepted`, never
    // `delivered`: SMTP acceptance is not proof of inbox delivery.
    return { providerMessageId: result.messageId ?? null };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let providerInstance: EmailProvider | null = null;

export function getEmailProvider(env: AppEnv): EmailProvider {
  // An injected provider (tests, tooling) always wins over configuration.
  if (providerInstance) return providerInstance;
  if (env.EMAIL_PROVIDER === "resend") {
    providerInstance = new ResendProvider();
  } else if (env.EMAIL_PROVIDER === "smtp") {
    providerInstance = new SmtpProvider();
  } else {
    providerInstance = new DevOutboxProvider();
  }
  return providerInstance;
}

/** Test helper: inject a fake provider. */
export function setEmailProvider(provider: EmailProvider | null): void {
  providerInstance = provider;
}
