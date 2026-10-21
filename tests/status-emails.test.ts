import { describe, it, expect } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { createRegistration, updateRegistrationStatus } from "@/lib/registration/service";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { processDueEmailJobs } from "@/lib/email/outbox";
import { setEmailProvider } from "@/lib/email/provider";
import { FakeEmailProvider, validRegistrationPayload } from "./helpers";

async function makeRegistration(overrides: Record<string, unknown> = {}) {
  const parsed = RegistrationSchema.safeParse(validRegistrationPayload(overrides));
  if (!parsed.success) throw new Error("bad fixture");
  const result = await createRegistration(parsed.data);
  if (result.outcome !== "created") throw new Error("setup failed");
  const row = await getPrisma().registration.findFirst({ where: { reference: result.reference } });
  return row!;
}

describe("status transition emails", () => {
  it("sends an approval email only after an approved transition", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    const registration = await makeRegistration({ preferredName: "Ana" });

    // No email before any transition (only the queued confirmation).
    expect(await getPrisma().emailJob.count({ where: { kind: "approval" } })).toBe(0);

    const result = await updateRegistrationStatus({
      registrationId: registration.id,
      to: "approved",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    expect(await getPrisma().emailJob.count({ where: { kind: "approval" } })).toBe(1);

    await processDueEmailJobs({ provider });
    const approval = provider.sent.find((s) => s.subject.includes("Approved"));
    expect(approval).toBeDefined();
    expect(approval!.to).toBe("juan@example.com");
    expect(approval!.text).toContain(registration.reference);
    expect(approval!.text).toContain("Programming and Web Development");
    expect(approval!.text).toContain("Ana");
    // Meeting URL must never be invented when not configured.
    expect(approval!.text).not.toMatch(/zoom\.us|https:\/\/.*meeting/i);
    setEmailProvider(null);
  });

  it("sends waitlist and decline emails for their transitions", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    const registration = await makeRegistration();

    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "waitlisted",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "declined",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    await processDueEmailJobs({ provider });

    expect(provider.sent.some((s) => s.subject.includes("Waitlist"))).toBe(true);
    expect(provider.sent.some((s) => s.subject.includes("Registration Update"))).toBe(true);
    setEmailProvider(null);
  });

  it("sends no email when a registration returns to pending review", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    const registration = await makeRegistration();
    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "approved",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    await processDueEmailJobs({ provider });
    const countAfterApproval = provider.sent.length;

    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "pending_review",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    await processDueEmailJobs({ provider });
    expect(provider.sent.length).toBe(countAfterApproval);
    setEmailProvider(null);
  });

  it("double-clicked transitions do not send duplicate emails (same transitionId)", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    const registration = await makeRegistration();
    const transitionId = crypto.randomUUID();

    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "approved",
      actor: "admin@example.com",
      transitionId,
    });
    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "waitlisted",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    // Return to approved with the ORIGINAL transition id (simulated retry).
    await updateRegistrationStatus({
      registrationId: registration.id,
      to: "approved",
      actor: "admin@example.com",
      transitionId,
    });

    await processDueEmailJobs({ provider });
    const approvals = provider.sent.filter((s) => s.subject.includes("Approved"));
    expect(approvals).toHaveLength(1); // deduped
    setEmailProvider(null);
  });

  it("same-status update is a no-op and sends nothing", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);
    const registration = await makeRegistration();
    const result = await updateRegistrationStatus({
      registrationId: registration.id,
      to: "pending_review",
      actor: "admin@example.com",
      transitionId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    expect(await getPrisma().emailJob.count({ where: { kind: { not: "confirmation" } } })).toBe(0);
    setEmailProvider(null);
  });
});
