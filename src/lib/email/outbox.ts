import type { PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";
import { getEmailProvider, EmailSendError, type EmailProvider } from "@/lib/email/provider";
import { renderEmail, type EmailTemplateKind } from "@/lib/email/templates";

/**
 * Durable email outbox.
 *
 * Emails are persisted as jobs before being sent. A worker (in-process loop on
 * long-running servers, or the secured cron endpoint on serverless platforms)
 * picks up due jobs, sends them through the provider, and records the outcome.
 *
 * Reliability rules:
 * - The registration transaction never waits on an email provider.
 * - A job is only marked `accepted` when the provider actually accepted it.
 *   (Delivery events could update it to `delivered` via webhooks — not
 *   enabled by default; see docs/DEPLOYMENT.md.)
 * - Transient provider failures are retried with bounded exponential backoff.
 * - `dedupeKey` prevents the same logical email from being queued twice
 *   (double-clicks, network retries, repeated admin actions).
 */

export const EMAIL_JOB_STATUSES = [
  "queued",
  "processing",
  "accepted",
  "delivered",
  "failed",
  "cancelled",
] as const;

export type EmailJobStatus = (typeof EMAIL_JOB_STATUSES)[number];

export interface EnqueueEmailInput {
  kind: EmailTemplateKind;
  dedupeKey: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  payload: Record<string, unknown>;
  registrationId?: string | null;
  batchId?: string | null;
}

/** Backoff schedule for transient failures (minutes). */
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];

function backoffMinutes(attempt: number): number {
  return RETRY_BACKOFF_MINUTES[Math.min(attempt, RETRY_BACKOFF_MINUTES.length - 1)];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Queue an email. Returns `{ job, alreadyQueued }`; when the dedupe key already
 * exists the existing job is returned and nothing new is queued.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<{
  job: { id: string; status: string };
  alreadyQueued: boolean;
}> {
  const prisma = getPrisma();
  try {
    const job = await prisma.emailJob.create({
      data: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        batchId: input.batchId ?? null,
        registrationId: input.registrationId ?? null,
        toEmail: input.toEmail,
        toName: input.toName ?? null,
        subject: input.subject,
        template: input.kind,
        payload: JSON.stringify(input.payload),
        status: "queued",
      },
      select: { id: true, status: true },
    });
    return { job, alreadyQueued: false };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await prisma.emailJob.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true, status: true },
      });
      if (existing) return { job: existing, alreadyQueued: true };
    }
    throw error;
  }
}

/** Mark a registration's confirmation email status (visible in admin UI). */
async function updateConfirmationStatus(
  prisma: PrismaClient,
  jobId: string,
  registrationId: string | null,
  status: string,
): Promise<void> {
  if (!registrationId) return;
  // Only confirmation jobs drive this field.
  const job = await prisma.emailJob.findUnique({ where: { id: jobId }, select: { kind: true } });
  if (job?.kind !== "confirmation") return;
  await prisma.registration.update({
    where: { id: registrationId },
    data: { confirmationEmailStatus: status },
  });
}

export interface ProcessResult {
  processed: number;
  accepted: number;
  failed: number;
  retried: number;
}

/**
 * Process up to `limit` due email jobs. Safe to call concurrently: each job is
 * claimed with an atomic status transition before sending.
 */
export async function processDueEmailJobs(
  opts: { limit?: number; provider?: EmailProvider } = {},
): Promise<ProcessResult> {
  const env = getEnv();
  const prisma = getPrisma();
  const provider = opts.provider ?? getEmailProvider(env);
  const limit = Math.min(opts.limit ?? 20, 100);

  const due = await prisma.emailJob.findMany({
    where: {
      status: "queued",
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const result: ProcessResult = { processed: 0, accepted: 0, failed: 0, retried: 0 };

  for (const { id } of due) {
    // Atomic claim — skip if another worker instance grabbed it first.
    const claimed = await prisma.emailJob.updateMany({
      where: { id, status: "queued" },
      data: { status: "processing" },
    });
    if (claimed.count === 0) continue;

    const job = await prisma.emailJob.findUnique({ where: { id } });
    if (!job) continue;
    result.processed++;

    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>;
      const rendered = renderEmail({ kind: job.kind as EmailTemplateKind, payload });
      const { providerMessageId } = await provider.send(
        {
          to: job.toEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        },
        env,
      );

      // "accepted" means the provider accepted the message — NOT that it was
      // delivered. Delivery requires webhook confirmation (see docs/DEPLOYMENT.md).
      await prisma.emailJob.update({
        where: { id },
        data: {
          status: "accepted",
          attempts: job.attempts + 1,
          provider: provider.name,
          providerMessageId,
          sentAt: new Date(),
          lastError: null,
          lastErrorCode: null,
        },
      });
      await updateConfirmationStatus(prisma, id, job.registrationId, "accepted");
      result.accepted++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const sendError =
        error instanceof EmailSendError
          ? error
          : new EmailSendError((error as Error).message ?? "Unknown error", {
              transient: true,
              code: "unexpected_error",
            });
      const canRetry = sendError.transient && attempts < job.maxAttempts;

      await prisma.emailJob.update({
        where: { id },
        data: {
          status: canRetry ? "queued" : "failed",
          attempts,
          provider: provider.name,
          lastError: sendError.message,
          lastErrorCode: sendError.code,
          nextAttemptAt: new Date(Date.now() + backoffMinutes(attempts) * 60_000),
        },
      });
      await updateConfirmationStatus(prisma, id, job.registrationId, canRetry ? "queued" : "failed");
      if (canRetry) result.retried++;
      else result.failed++;
    }
  }

  // Refresh announcement batch counters for any batches touched in this run.
  const batchIds = new Set(
    (
      await prisma.emailJob.findMany({
        where: { id: { in: due.map((d) => d.id) }, batchId: { not: null } },
        select: { batchId: true },
      })
    )
      .map((j) => j.batchId)
      .filter((v): v is string => Boolean(v)),
  );
  for (const batchId of batchIds) {
    await refreshAnnouncementBatchCounters(prisma, batchId);
  }

  return result;
}

/** Recompute announcement batch progress counters from its jobs. */
export async function refreshAnnouncementBatchCounters(
  prisma: PrismaClient,
  batchId: string,
): Promise<void> {
  const [total, accepted, failed, pending] = await Promise.all([
    prisma.emailJob.count({ where: { batchId } }),
    prisma.emailJob.count({ where: { batchId, status: { in: ["accepted", "delivered"] } } }),
    prisma.emailJob.count({ where: { batchId, status: "failed" } }),
    prisma.emailJob.count({ where: { batchId, status: { in: ["queued", "processing"] } } }),
  ]);
  const status =
    pending > 0 ? "sending" : failed === 0 ? "completed" : accepted === 0 ? "failed" : "partially_failed";
  await prisma.announcementBatch.update({
    where: { id: batchId },
    data: { totalRecipients: total, acceptedCount: accepted, sentCount: accepted, failedCount: failed, status },
  });
}

/** Manually retry a failed email job (admin action; audited by the caller). */
export async function retryEmailJob(jobId: string): Promise<{ requeued: boolean }> {
  const prisma = getPrisma();
  const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "failed") return { requeued: false };
  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: "queued",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      lastErrorCode: null,
    },
  });
  await updateConfirmationStatus(prisma, jobId, job.registrationId, "queued");
  return { requeued: true };
}
