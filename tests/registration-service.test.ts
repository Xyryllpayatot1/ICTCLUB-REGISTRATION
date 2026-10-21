import { describe, it, expect } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { createRegistration } from "@/lib/registration/service";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { isValidReferenceFormat } from "@/lib/registration/reference";
import { processDueEmailJobs } from "@/lib/email/outbox";
import { FakeEmailProvider } from "./helpers";
import { setEmailProvider } from "@/lib/email/provider";
import { validRegistrationPayload } from "./helpers";

function parse(payload: Record<string, unknown>) {
  const result = RegistrationSchema.safeParse(payload);
  if (!result.success) throw new Error("test payload invalid");
  return result.data;
}

describe("createRegistration (service level)", () => {
  it("creates a registration with a unique, non-sequential reference", async () => {
    const result = await createRegistration(parse(validRegistrationPayload()));
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;
    expect(isValidReferenceFormat(result.reference)).toBe(true);
    // References must never encode a row number: no sequential suffix.
    expect(result.reference).not.toMatch(/-0*\d{4,}$/);

    const prisma = getPrisma();
    const row = await prisma.registration.findFirst({ where: { reference: result.reference } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("pending_review");
    expect(row?.emailNormalized).toBe("juan@example.com");
    expect(row?.confirmationEmailStatus).toBe("queued");
    // No internal DB id leaked to the caller.
    expect(Object.keys(result)).not.toContain("id");
  });

  it("queues exactly one confirmation email job per registration", async () => {
    await createRegistration(parse(validRegistrationPayload()));
    const prisma = getPrisma();
    const jobs = await prisma.emailJob.findMany({ where: { kind: "confirmation" } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("queued");
  });

  it("blocks duplicate active registrations for the same normalized email", async () => {
    await createRegistration(parse(validRegistrationPayload()));
    const second = await createRegistration(
      parse(validRegistrationPayload({ fullName: "Someone Else", idempotencyKey: undefined })),
    );
    expect(second.outcome).toBe("duplicate");
    expect(second.reference).toBeNull();

    const prisma = getPrisma();
    expect(await prisma.registration.count()).toBe(1);
  });

  it("treats case-differing emails as duplicates", async () => {
    await createRegistration(parse(validRegistrationPayload()));
    const second = await createRegistration(
      parse(validRegistrationPayload({ email: "JUAN@EXAMPLE.COM" })),
    );
    expect(second.outcome).toBe("duplicate");
  });

  it("returns the original registration on idempotency-key replay", async () => {
    const key = crypto.randomUUID();
    const first = await createRegistration(parse(validRegistrationPayload({ idempotencyKey: key })));
    const replay = await createRegistration(parse(validRegistrationPayload({ idempotencyKey: key })));
    expect(first.outcome).toBe("created");
    expect(replay.outcome).toBe("idempotent_replay");
    if (first.outcome === "created" && replay.outcome === "idempotent_replay") {
      expect(replay.reference).toBe(first.reference);
    }
    const prisma = getPrisma();
    expect(await prisma.registration.count()).toBe(1);
  });

  it("saves the registration even when the email provider later fails", async () => {
    const { FailingEmailProvider } = await import("./helpers");
    setEmailProvider(new FailingEmailProvider(true));

    const result = await createRegistration(parse(validRegistrationPayload()));
    expect(result.outcome).toBe("created"); // registration does not depend on email

    // Worker run: transient failure → stays queued for retry, registration intact.
    await processDueEmailJobs({ limit: 5 });
    const prisma = getPrisma();
    const reg = await prisma.registration.findFirst();
    expect(reg).not.toBeNull();
    expect(reg?.confirmationEmailStatus).toBe("queued"); // will retry
    const job = await prisma.emailJob.findFirst();
    expect(job?.status).toBe("queued");
    expect(job?.attempts).toBe(1);

    setEmailProvider(null);
  });

  it("allows a new registration after the previous one was declined", async () => {
    const first = await createRegistration(parse(validRegistrationPayload()));
    if (first.outcome !== "created") throw new Error("setup failed");
    const prisma = getPrisma();
    await prisma.registration.updateMany({ data: { status: "declined" } });

    const second = await createRegistration(
      parse(validRegistrationPayload({ email: "juan@example.com" })),
    );
    expect(second.outcome).toBe("created");
  });
});

describe("email confirmation content", () => {
  it("contains the reference, track, and schedule and is addressed correctly", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);

    const result = await createRegistration(
      parse(validRegistrationPayload({ preferredName: "Juancho", track: "computer-networking" })),
    );
    if (result.outcome !== "created") throw new Error("setup failed");

    await processDueEmailJobs({ limit: 5, provider });

    expect(provider.sent).toHaveLength(1);
    const email = provider.sent[0]!;
    expect(email.to).toBe("juan@example.com");
    expect(email.subject).toContain("Registration Received");
    expect(email.text).toContain(result.reference);
    expect(email.text).toContain("Computer Networking");
    expect(email.text).toContain("7:00 PM");
    expect(email.html).toContain(result.reference);
    expect(email.html).toContain("Juancho"); // preferred name used in greeting
    setEmailProvider(null);
  });
});
