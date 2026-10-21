import { describe, it, expect } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import {
  enqueueEmail,
  processDueEmailJobs,
  retryEmailJob,
} from "@/lib/email/outbox";
import { setEmailProvider } from "@/lib/email/provider";
import { FakeEmailProvider, FailingEmailProvider } from "./helpers";

function job(overrides: Record<string, unknown> = {}) {
  return {
    kind: "confirmation" as const,
    dedupeKey: `test:${crypto.randomUUID()}`,
    toEmail: "student@example.com",
    subject: "Test subject",
    payload: { displayName: "Test", reference: "MRMNHS-TESTTEST", track: "programming-web-dev" },
    ...overrides,
  };
}

describe("email outbox", () => {
  it("deduplicates jobs by dedupe key (same logical email queued once)", async () => {
    const input = job();
    const first = await enqueueEmail(input);
    const second = await enqueueEmail(input);
    expect(first.alreadyQueued).toBe(false);
    expect(second.alreadyQueued).toBe(true);
    expect(second.job.id).toBe(first.job.id);
    expect(await getPrisma().emailJob.count()).toBe(1);
  });

  it("marks jobs accepted only when the provider accepts them", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    await enqueueEmail(job());

    const result = await processDueEmailJobs({ provider });
    expect(result.accepted).toBe(1);

    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("accepted");
    expect(row?.providerMessageId).toBe("fake-1");
    expect(row?.sentAt).not.toBeNull();
    setEmailProvider(null);
  });

  it("retries transient failures with backoff and keeps the queued job durable", async () => {
    setEmailProvider(new FailingEmailProvider(true));
    await enqueueEmail(job());

    const first = await processDueEmailJobs();
    expect(first.retried).toBe(1);
    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("queued");
    expect(row?.attempts).toBe(1);
    expect(row?.lastErrorCode).toBe("http_503");
    expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()); // backoff scheduled

    // Not due yet — a second run must not process it.
    const skipped = await processDueEmailJobs();
    expect(skipped.processed).toBe(0);
    setEmailProvider(null);
  });

  it("fails permanently on non-transient provider errors", async () => {
    setEmailProvider(new FailingEmailProvider(false));
    await enqueueEmail(job());

    await processDueEmailJobs();
    const row = await getPrisma().emailJob.findFirst();
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(1); // no retry for permanent errors
    setEmailProvider(null);
  });

  it("admin retry requeues a failed job and sending succeeds without duplicates", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(new FailingEmailProvider(false));
    const { job: created } = await enqueueEmail(job());
    await processDueEmailJobs();

    const { requeued } = await retryEmailJob(created.id);
    expect(requeued).toBe(true);

    setEmailProvider(provider);
    await processDueEmailJobs();
    expect(provider.sent).toHaveLength(1);

    // Processing again must not resend (job is no longer queued).
    await processDueEmailJobs();
    expect(provider.sent).toHaveLength(1);

    const row = await getPrisma().emailJob.findUnique({ where: { id: created.id } });
    expect(row?.status).toBe("accepted");
    expect(row?.attempts).toBe(1);
    setEmailProvider(null);
  });

  it("does not retry non-failed jobs via the manual retry endpoint", async () => {
    const { job: created } = await enqueueEmail(job());
    const { requeued } = await retryEmailJob(created.id);
    expect(requeued).toBe(false);
  });

  it("updates the registration's confirmation email status as jobs progress", async () => {
    const { createRegistration } = await import("@/lib/registration/service");
    const { RegistrationSchema } = await import("@/lib/validation/schemas");
    const { validRegistrationPayload } = await import("./helpers");

    const parsed = RegistrationSchema.safeParse(validRegistrationPayload());
    if (!parsed.success) throw new Error("bad fixture");
    const created = await createRegistration(parsed.data);
    if (created.outcome !== "created") throw new Error("setup failed");

    const prisma = getPrisma();
    const reg = await prisma.registration.findFirst({ where: { reference: created.reference } });
    expect(reg?.confirmationEmailStatus).toBe("queued");

    const provider = new FakeEmailProvider();
    await processDueEmailJobs({ provider });
    const updated = await prisma.registration.findFirst({ where: { id: reg!.id } });
    expect(updated?.confirmationEmailStatus).toBe("accepted");
  });
});

describe("cron endpoint authorization", () => {
  it("rejects calls without the CRON_SECRET bearer token", async () => {
    const { GET } = await import("@/app/api/cron/email-worker/route");
    const response = await GET(
      new Request("http://localhost:3000/api/cron/email-worker", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts calls with the correct token", async () => {
    const { GET } = await import("@/app/api/cron/email-worker/route");
    const response = await GET(
      new Request("http://localhost:3000/api/cron/email-worker", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});
