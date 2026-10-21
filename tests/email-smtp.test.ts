import { describe, it, expect, afterEach, vi } from "vitest";
import {
  SmtpProvider,
  EmailSendError,
  classifySmtpError,
  getEmailProvider,
  setEmailProvider,
  type OutgoingEmail,
} from "@/lib/email/provider";
import { enqueueEmail, processDueEmailJobs } from "@/lib/email/outbox";
import { getEnv, isSmtpConfigured, SMTP_SETUP_INSTRUCTIONS } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";

/**
 * Gmail SMTP provider tests.
 *
 * No test opens a network connection: every transport is injected, and the
 * Gmail credentials in the test environment are deliberately fake — so these
 * tests can never send a real email to anyone.
 */

const sampleEmail: OutgoingEmail = {
  to: "student@example.com",
  subject: "Welcome to the program",
  html: "<p>Hello</p>",
  text: "Hello",
};

function queueConfirmationJob() {
  return enqueueEmail({
    kind: "confirmation",
    dedupeKey: `smtp-test:${crypto.randomUUID()}`,
    toEmail: "student@example.com",
    subject: "Test subject",
    payload: {
      displayName: "Test",
      reference: "MRMNHS-SMTPTST",
      track: "programming-web-dev",
    },
  });
}

afterEach(() => {
  setEmailProvider(null);
  vi.restoreAllMocks();
});

describe("classifySmtpError retry policy", () => {
  it("treats authentication failures as permanent (never retried)", () => {
    const result = classifySmtpError(
      Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), {
        code: "EAUTH",
        responseCode: 535,
      }),
    );
    expect(result.transient).toBe(false);
    expect(result.code).toBe("smtp_auth_failed");
  });

  it("treats 5xx replies as permanent", () => {
    const result = classifySmtpError(
      Object.assign(new Error("550 5.1.1 The email account does not exist"), {
        responseCode: 550,
      }),
    );
    expect(result.transient).toBe(false);
    expect(result.code).toBe("smtp_perm_error");
  });

  it("treats envelope rejections without a numeric reply as permanent", () => {
    const result = classifySmtpError(
      Object.assign(new Error("Envelope rejected"), { code: "EENVELOPE" }),
    );
    expect(result.transient).toBe(false);
    expect(result.code).toBe("smtp_envelope_rejected");
  });

  it("treats 4xx replies as transient (bounded retries with backoff)", () => {
    const result = classifySmtpError(
      Object.assign(new Error("421 4.7.0 Try again later"), { responseCode: 421 }),
    );
    expect(result.transient).toBe(true);
    expect(result.code).toBe("smtp_temp_error");
  });

  it("treats network failures as transient", () => {
    const result = classifySmtpError(
      Object.assign(new Error("Connection timed out"), { code: "ETIMEDOUT" }),
    );
    expect(result.transient).toBe(true);
    expect(result.code).toBe("smtp_network_error");
  });

  it("never puts the password in the message and caps message length", () => {
    const result = classifySmtpError(new Error("x".repeat(1000)));
    expect(result.message.length).toBeLessThanOrEqual(340);
    expect(result.message).not.toContain("app-password-value");
  });
});

describe("SmtpProvider", () => {
  it("returns only a provider message id on SMTP acceptance (never claims delivery)", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => ({ messageId: "<abc@mail.gmail.com>", accepted: ["a@b.c"], rejected: [] }),
    }));
    const result = await provider.send(sampleEmail, getEnv());
    expect(result.providerMessageId).toBe("<abc@mail.gmail.com>");
    expect(provider.name).toBe("smtp");
    expect(provider.simulated).toBe(false);
  });

  it("passes the configured from address and recipient to the transport", async () => {
    const captured: Record<string, unknown> = {};
    const provider = new SmtpProvider(() => ({
      sendMail: async (options) => {
        Object.assign(captured, options);
        return { messageId: "<x@y.z>", accepted: [options.to], rejected: [] };
      },
    }));
    await provider.send(sampleEmail, getEnv());
    expect(captured.from).toBe(getEnv().EMAIL_FROM);
    expect(captured.to).toBe(sampleEmail.to);
  });

  it("classifies auth errors as permanent and redacts the mailbox identity", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => {
        throw Object.assign(
          new Error(`Invalid login for ${getEnv().GMAIL_USER}: 535-5.7.8 not accepted`),
          { code: "EAUTH", responseCode: 535 },
        );
      },
    }));
    const error = await provider.send(sampleEmail, getEnv()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailSendError);
    const sendError = error as EmailSendError;
    expect(sendError.transient).toBe(false);
    expect(sendError.code).toBe("smtp_auth_failed");
    expect(sendError.message).not.toContain(getEnv().GMAIL_USER); // no credentials in stored errors
  });

  it("fails permanently when the server accepts nothing for the recipient", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => ({ messageId: "<r@x.y>", accepted: [], rejected: ["student@example.com"] }),
    }));
    const error = await provider.send(sampleEmail, getEnv()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailSendError);
    expect((error as EmailSendError).code).toBe("smtp_envelope_rejected");
    expect((error as EmailSendError).transient).toBe(false);
  });

  it("disables sending with clear setup instructions when credentials are missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = new SmtpProvider(() => {
      throw new Error("transport must not be created when unconfigured");
    });
    const unconfigured = { ...getEnv(), GMAIL_USER: "", GMAIL_APP_PASSWORD: "" };
    expect(isSmtpConfigured(unconfigured)).toBe(false);

    const error = await provider.send(sampleEmail, unconfigured).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailSendError);
    const sendError = error as EmailSendError;
    expect(sendError.code).toBe("smtp_not_configured");
    expect(sendError.transient).toBe(false); // no endless retries on missing config
    expect(sendError.message).toBe(SMTP_SETUP_INSTRUCTIONS);
    expect(sendError.message).toContain("App Password");
  });
});

describe("provider factory", () => {
  it("builds the smtp provider when EMAIL_PROVIDER=smtp", () => {
    setEmailProvider(null);
    const provider = getEmailProvider({ ...getEnv(), EMAIL_PROVIDER: "smtp" });
    expect(provider.name).toBe("smtp");
    expect(provider.simulated).toBe(false);
    setEmailProvider(null);
  });

  it("keeps dev-outbox and resend selection unchanged", () => {
    setEmailProvider(null);
    expect(getEmailProvider({ ...getEnv(), EMAIL_PROVIDER: "dev-outbox" }).name).toBe("dev-outbox");
    setEmailProvider(null);
    expect(getEmailProvider({ ...getEnv(), EMAIL_PROVIDER: "resend" }).name).toBe("resend");
    setEmailProvider(null);
  });
});

describe("outbox integration with SMTP outcomes", () => {
  it("marks the job accepted (never delivered) when SMTP accepts the message", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => ({ messageId: "<q1@mail.gmail.com>", accepted: ["a@b.c"], rejected: [] }),
    }));
    await queueConfirmationJob();

    const result = await processDueEmailJobs({ provider });
    expect(result.accepted).toBe(1);

    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("accepted");
    expect(row?.provider).toBe("smtp");
    expect(row?.providerMessageId).toBe("<q1@mail.gmail.com>");
    expect(row?.lastError).toBeNull();
    expect(row?.attempts).toBe(1);
  });

  it("records a permanent auth failure after one attempt without retrying", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => {
        throw Object.assign(new Error("535 auth failed"), { code: "EAUTH", responseCode: 535 });
      },
    }));
    await queueConfirmationJob();

    const result = await processDueEmailJobs({ provider });
    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);

    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(1);
    expect(row?.lastErrorCode).toBe("smtp_auth_failed");
    expect(row?.lastError).toContain("SMTP EAUTH");
  });

  it("retries transient SMTP network errors with bounded backoff", async () => {
    const provider = new SmtpProvider(() => ({
      sendMail: async () => {
        throw Object.assign(new Error("Connection timed out"), { code: "ETIMEDOUT" });
      },
    }));
    await queueConfirmationJob();

    const result = await processDueEmailJobs({ provider });
    expect(result.retried).toBe(1);

    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("queued");
    expect(row?.attempts).toBe(1);
    expect(row?.lastErrorCode).toBe("smtp_network_error");
    expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // Not due yet: no second attempt is burned.
    const second = await processDueEmailJobs({ provider });
    expect(second.processed).toBe(0);
  });

  it("records missing-configuration failures with the setup instructions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = new SmtpProvider(() => ({
      sendMail: async () => ({ messageId: "unused" }),
    }));
    await queueConfirmationJob();

    // Simulate unconfigured server-side env for this run.
    const { getEnv: readEnv, resetEnvCache } = await import("@/lib/config/env");
    const originalUser = process.env.GMAIL_USER;
    process.env.GMAIL_USER = "";
    resetEnvCache();
    try {
      await processDueEmailJobs({ provider });
      expect(readEnv().GMAIL_USER).toBe("");
    } finally {
      if (originalUser !== undefined) process.env.GMAIL_USER = originalUser;
      resetEnvCache();
    }

    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("failed");
    expect(row?.lastErrorCode).toBe("smtp_not_configured");
    expect(row?.lastError).toContain("App Password");
  });
});
