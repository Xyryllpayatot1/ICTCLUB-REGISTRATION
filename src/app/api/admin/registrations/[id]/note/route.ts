import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { AdminNoteSchema } from "@/lib/validation/schemas";
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

  const parsed = AdminNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Note must be 2000 characters or fewer." }, { status: 422 });
  }

  const prisma = getPrisma();
  const registration = await prisma.registration.findUnique({
    where: { id },
    select: { reference: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  await prisma.registration.update({
    where: { id },
    data: { adminNotes: parsed.data.note === "" ? null : parsed.data.note },
  });

  await logAudit({
    action: AUDIT_ACTIONS.ADMIN_NOTE,
    actor: guard.context.user.email,
    targetType: "registration",
    targetId: id,
    detail: { reference: registration.reference, cleared: parsed.data.note === "" },
  });

  return NextResponse.json({ ok: true });
}
