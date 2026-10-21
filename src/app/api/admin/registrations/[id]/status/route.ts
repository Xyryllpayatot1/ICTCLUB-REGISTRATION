import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { StatusUpdateSchema } from "@/lib/validation/schemas";
import { updateRegistrationStatus } from "@/lib/registration/service";
import { processDueEmailJobs } from "@/lib/email/outbox";
import { getPrisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = StatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status or note." }, { status: 422 });
  }

  // The client sends a per-action idempotency token so double-clicks don't
  // enqueue two emails for the same transition.
  const transitionId =
    typeof (body as { transitionId?: unknown }).transitionId === "string" &&
    /^[0-9a-f-]{36}$/i.test((body as { transitionId: string }).transitionId)
      ? (body as { transitionId: string }).transitionId
      : crypto.randomUUID();

  const prisma = getPrisma();
  const before = await prisma.registration.findUnique({
    where: { id },
    select: { status: true, reference: true },
  });
  if (!before) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const result = await updateRegistrationStatus({
    registrationId: id,
    to: parsed.data.status,
    actor: guard.context.user.email,
    transitionId,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (before.status !== parsed.data.status) {
    await logAudit({
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      actor: guard.context.user.email,
      targetType: "registration",
      targetId: id,
      detail: {
        reference: before.reference,
        from: before.status,
        to: parsed.data.status,
        noteIncluded: Boolean(parsed.data.note),
      },
    });
    // Kick the email worker so the notification goes out promptly without
    // blocking this response on the provider.
    void processDueEmailJobs({ limit: 5 }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, status: result.status });
}
