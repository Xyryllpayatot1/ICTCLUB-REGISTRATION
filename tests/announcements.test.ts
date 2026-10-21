import { describe, it, expect, afterEach } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { createRegistration } from "@/lib/registration/service";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { processDueEmailJobs } from "@/lib/email/outbox";
import { setEmailProvider } from "@/lib/email/provider";
import { previewAnnouncement, sendAnnouncement } from "@/lib/admin/announcements";
import { ACTIVE_STATUSES } from "@/lib/config/program";
import { FakeEmailProvider, validRegistrationPayload } from "./helpers";

async function makeRegistration(overrides: Record<string, unknown> = {}) {
  const parsed = RegistrationSchema.safeParse(validRegistrationPayload(overrides));
  if (!parsed.success) throw new Error("bad fixture");
  const result = await createRegistration(parsed.data);
  if (result.outcome !== "created") throw new Error("setup failed");
  const row = await getPrisma().registration.findFirst({ where: { reference: result.reference } });
  return row!;
}

afterEach(() => {
  setEmailProvider(null);
});

describe("announcement sending", () => {
  it("treats pending-review registrations as eligible for the active-status audience", async () => {
    const registration = await makeRegistration({ preferredName: "Ana" });

    // The composer defaults to every active status; new registrations are
    // pending_review, so this must not resolve to an empty audience.
    const preview = await previewAnnouncement({
      kind: "essential",
      statuses: [...ACTIVE_STATUSES],
    });
    expect(preview.recipientCount).toBe(1);
    expect(preview.sampleRecipients).toEqual([
      expect.objectContaining({ reference: registration.reference, displayName: "Ana" }),
    ]);

    // Regression guard: "approved" alone used to be the default and silently
    // produced zero recipients (and therefore no send button at all).
    const approvedOnly = await previewAnnouncement({ kind: "essential", statuses: ["approved"] });
    expect(approvedOnly.recipientCount).toBe(0);
  });

  it("queues and delivers one email per eligible recipient, then completes the batch", async () => {
    const provider = new FakeEmailProvider();
    setEmailProvider(provider);

    const ana = await makeRegistration({ email: "ana@example.com", preferredName: "Ana" });
    const ben = await makeRegistration({ email: "ben@example.com", preferredName: "Ben" });
    await getPrisma().registration.update({ where: { id: ben.id }, data: { status: "approved" } });

    // Drain the registration-confirmation jobs first.
    await processDueEmailJobs({ provider });
    provider.sent.length = 0;

    const result = await sendAnnouncement({
      subject: "Session update",
      message: "Hello everyone.\n\nSee you online.",
      kind: "essential",
      statuses: [...ACTIVE_STATUSES],
      actorEmail: "admin@example.com",
      actorName: "Admin",
    });

    expect(result.ok).toBe(true);
    expect(result.recipientCount).toBe(2);
    expect(result.batchId).toBeTruthy();

    const jobs = await getPrisma().emailJob.findMany({ where: { kind: "announcement" } });
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.status === "queued")).toBe(true);

    await processDueEmailJobs({ provider });

    expect(provider.sent).toHaveLength(2);
    const toAna = provider.sent.find((s) => s.to === ana.email);
    const toBen = provider.sent.find((s) => s.to === ben.email);
    expect(toAna?.subject).toBe("Session update");
    expect(toAna?.text).toContain("Hello Ana,");
    expect(toAna?.text).toContain("See you online.");
    expect(toBen?.text).toContain("Hello Ben,");

    const batch = await getPrisma().announcementBatch.findUnique({ where: { id: result.batchId! } });
    expect(batch).toMatchObject({
      status: "completed",
      totalRecipients: 2,
      acceptedCount: 2,
      sentCount: 2,
      failedCount: 0,
    });

    // Sends are audited.
    const audit = await getPrisma().auditLog.findFirst({ where: { action: "announcement.created" } });
    expect(audit?.targetId).toBe(result.batchId);
  });

  it("excludes registrations without marketing consent from marketing announcements", async () => {
    await makeRegistration({ email: "ana@example.com", marketingConsent: false });
    await makeRegistration({ email: "ben@example.com", marketingConsent: true });

    const essential = await previewAnnouncement({ kind: "essential", statuses: [...ACTIVE_STATUSES] });
    expect(essential.recipientCount).toBe(2);

    const marketing = await previewAnnouncement({ kind: "marketing", statuses: [...ACTIVE_STATUSES] });
    expect(marketing.recipientCount).toBe(1);
  });

  it("refuses to send when the selected audience has no eligible recipient", async () => {
    await makeRegistration();

    const result = await sendAnnouncement({
      subject: "Session update",
      message: "Hello everyone.",
      kind: "essential",
      statuses: ["approved"],
      actorEmail: "admin@example.com",
      actorName: "Admin",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Pending Review");
    expect(await getPrisma().announcementBatch.count()).toBe(0);
    expect(await getPrisma().emailJob.count({ where: { kind: "announcement" } })).toBe(0);
  });
});
