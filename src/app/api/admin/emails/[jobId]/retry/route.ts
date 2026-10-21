import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { retryEmailJob, processDueEmailJobs } from "@/lib/email/outbox";
import { getPrisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { jobId } = await ctx.params;

  const prisma = getPrisma();
  const job = await prisma.emailJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, kind: true, registration: { select: { reference: true } } },
  });
  if (!job) {
    return NextResponse.json({ error: "Email job not found." }, { status: 404 });
  }
  if (job.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed emails can be retried." },
      { status: 409 },
    );
  }

  const { requeued } = await retryEmailJob(jobId);
  if (!requeued) {
    return NextResponse.json({ error: "Could not requeue this email." }, { status: 409 });
  }

  await logAudit({
    action: AUDIT_ACTIONS.EMAIL_RETRY,
    actor: guard.context.user.email,
    targetType: "email_job",
    targetId: jobId,
    detail: { kind: job.kind, reference: job.registration?.reference },
  });

  void processDueEmailJobs({ limit: 5 }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
