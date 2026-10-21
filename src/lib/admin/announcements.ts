import { getPrisma } from "@/lib/db/prisma";
import { ACTIVE_STATUSES, trackLabel, gradeLevelLabel } from "@/lib/config/program";
import { enqueueEmail, refreshAnnouncementBatchCounters, retryEmailJob } from "@/lib/email/outbox";
import { messageToHtml } from "@/lib/email/templates";
import { logAudit } from "@/lib/admin/audit";

/**
 * Announcement sending (Email E).
 *
 * Announcements are deliberately not an unrestricted bulk-mail feature:
 * - Audience is limited to configured registration statuses.
 * - Essential announcements always require essential-communications consent;
 *   marketing announcements additionally require the separate marketing opt-in
 *   and may never target declined/cancelled registrations.
 * - Recipient count is hard-capped (MAX_ANNOUNCEMENT_RECIPIENTS).
 * - Each recipient gets an individual queued job; delivery is rate-bounded by
 *   the email worker's batch size, with per-job retry handling.
 * - Every send is audit-logged with actor, audience and counts.
 */

export const MAX_ANNOUNCEMENT_RECIPIENTS = 500;

export interface AnnouncementInput {
  subject: string;
  message: string;
  kind: "essential" | "marketing";
  statuses: string[];
  actorEmail: string;
  actorName: string;
}

export interface AnnouncementRecipient {
  id: string;
  reference: string;
  email: string;
  displayName: string;
  track: string;
  gradeLevel: string;
}

/** Resolve the audience for an announcement (also used by the preview). */
export async function resolveAnnouncementAudience(input: {
  kind: "essential" | "marketing";
  statuses: string[];
}): Promise<AnnouncementRecipient[]> {
  const prisma = getPrisma();
  const statuses =
    input.kind === "marketing"
      ? input.statuses.filter((s) => (ACTIVE_STATUSES as readonly string[]).includes(s))
      : input.statuses;

  const registrations = await prisma.registration.findMany({
    where: {
      status: { in: statuses },
      essentialConsent: true,
      ...(input.kind === "marketing" ? { marketingConsent: true } : {}),
    },
    select: {
      id: true,
      reference: true,
      email: true,
      fullName: true,
      preferredName: true,
      track: true,
      gradeLevel: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return registrations.map((r) => ({
    id: r.id,
    reference: r.reference,
    email: r.email,
    displayName: r.preferredName || r.fullName,
    track: r.track,
    gradeLevel: r.gradeLevel,
  }));
}

export interface AnnouncementPreview {
  recipientCount: number;
  capped: boolean;
  sampleRecipients: Array<{ reference: string; displayName: string; track: string; gradeLevel: string }>;
}

export async function previewAnnouncement(input: {
  kind: "essential" | "marketing";
  statuses: string[];
}): Promise<AnnouncementPreview> {
  const audience = await resolveAnnouncementAudience(input);
  return {
    recipientCount: Math.min(audience.length, MAX_ANNOUNCEMENT_RECIPIENTS),
    capped: audience.length > MAX_ANNOUNCEMENT_RECIPIENTS,
    sampleRecipients: audience.slice(0, 5).map((a) => ({
      reference: a.reference,
      displayName: a.displayName,
      track: trackLabel(a.track),
      gradeLevel: gradeLevelLabel(a.gradeLevel),
    })),
  };
}

export interface SendAnnouncementResult {
  ok: boolean;
  batchId?: string;
  recipientCount?: number;
  error?: string;
}

export async function sendAnnouncement(input: AnnouncementInput): Promise<SendAnnouncementResult> {
  const prisma = getPrisma();
  const audience = await resolveAnnouncementAudience(input);

  if (audience.length === 0) {
    return {
      ok: false,
      error:
        "No eligible recipients match the selected audience. Include other statuses (new registrations usually start as Pending Review) — recipients must also have given essential-communications consent.",
    };
  }
  if (audience.length > MAX_ANNOUNCEMENT_RECIPIENTS) {
    return {
      ok: false,
      error: `This audience has ${audience.length} recipients, above the limit of ${MAX_ANNOUNCEMENT_RECIPIENTS}. Narrow the audience or split the announcement.`,
    };
  }

  const statusesLabel = input.statuses.join(", ");
  const batch = await prisma.announcementBatch.create({
    data: {
      subject: input.subject,
      message: input.message,
      audience: `${input.kind} → statuses: ${statusesLabel}`,
      kind: input.kind,
      statuses: JSON.stringify(input.statuses),
      status: "sending",
      totalRecipients: audience.length,
      createdById: input.actorName || input.actorEmail,
      createdByEmail: input.actorEmail,
    },
  });

  const messageHtml = messageToHtml(input.message);
  for (const recipient of audience) {
    await enqueueEmail({
      kind: "announcement",
      dedupeKey: `announcement:${batch.id}:${recipient.id}`,
      toEmail: recipient.email,
      toName: recipient.displayName,
      subject: input.subject,
      batchId: batch.id,
      registrationId: recipient.id,
      payload: {
        displayName: recipient.displayName,
        subject: input.subject,
        messageHtml,
        messageText: input.message,
        kind: input.kind,
      },
    });
  }

  await logAudit({
    action: "announcement.created",
    actor: input.actorEmail,
    targetType: "announcement_batch",
    targetId: batch.id,
    detail: {
      subject: input.subject,
      kind: input.kind,
      statuses: input.statuses,
      recipients: audience.length,
    },
  });

  return { ok: true, batchId: batch.id, recipientCount: audience.length };
}

/** Retry every failed job in a batch (admin action). */
export async function retryAnnouncementFailures(
  batchId: string,
  actorEmail: string,
): Promise<{ retried: number }> {
  const prisma = getPrisma();
  const failed = await prisma.emailJob.findMany({
    where: { batchId, status: "failed" },
    select: { id: true },
  });
  let retried = 0;
  for (const job of failed) {
    const { requeued } = await retryEmailJob(job.id);
    if (requeued) retried++;
  }
  await refreshAnnouncementBatchCounters(prisma, batchId);
  if (retried > 0) {
    await logAudit({
      action: "announcement.retried",
      actor: actorEmail,
      targetType: "announcement_batch",
      targetId: batchId,
      detail: { retried },
    });
  }
  return { retried };
}

export async function listAnnouncementBatches(limit = 25) {
  const prisma = getPrisma();
  return prisma.announcementBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAnnouncementBatch(id: string) {
  const prisma = getPrisma();
  const batch = await prisma.announcementBatch.findUnique({ where: { id } });
  if (!batch) return null;
  const failures = await prisma.emailJob.findMany({
    where: { batchId: id, status: "failed" },
    select: { id: true, toEmail: true, lastError: true, attempts: true },
    take: 20,
  });
  return { batch, failures };
}
