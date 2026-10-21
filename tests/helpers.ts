import type { EmailProvider, OutgoingEmail } from "@/lib/email/provider";
import type { AppEnv } from "@/lib/config/env";

/**
 * Test doubles for the email layer.
 *
 * Tests never talk to a real email provider: FakeEmailProvider records every
 * message in memory; FailingEmailProvider simulates transient/permanent
 * failures to exercise retry logic.
 */

export interface SentRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  readonly simulated = false;
  sent: SentRecord[] = [];

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string | null }> {
    this.sent.push({ to: email.to, subject: email.subject, html: email.html, text: email.text });
    return { providerMessageId: `fake-${this.sent.length}` };
  }
}

export class FailingEmailProvider implements EmailProvider {
  readonly name = "failing";
  readonly simulated = false;
  attempts = 0;

  constructor(private readonly transient: boolean) {}

  async send(): Promise<{ providerMessageId: string | null }> {
    this.attempts++;
    const { EmailSendError } = await import("@/lib/email/provider");
    throw new EmailSendError(this.transient ? "Simulated 503" : "Simulated invalid address", {
      transient: this.transient,
      code: this.transient ? "http_503" : "http_400",
    });
  }
}

/** A minimal valid registration payload for API-level tests. */
export function validRegistrationPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Juan Dela Cruz",
    email: "juan@example.com",
    gradeLevel: "grade_11",
    track: "programming-web-dev",
    essentialConsent: true,
    marketingConsent: false,
    website: "",
    ...overrides,
  };
}

export function makeRequest(
  url: string,
  init: RequestInit & { cookies?: Record<string, string> } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.cookies) {
    headers.set(
      "Cookie",
      Object.entries(init.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  return new Request(url, { ...init, headers });
}

export type { AppEnv };
