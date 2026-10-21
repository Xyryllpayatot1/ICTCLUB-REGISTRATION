import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { AnnouncementSchema } from "@/lib/validation/schemas";
import { sendAnnouncement, previewAnnouncement } from "@/lib/admin/announcements";
import { processDueEmailJobs } from "@/lib/email/outbox";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/announcements — preview or send.
 * Body `{ preview: true, ... }` returns recipient stats without sending.
 */
export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const limited = rateLimit(
    `announce:${guard.context.user.email}`,
    RATE_LIMITS.announcementSend.limit,
    RATE_LIMITS.announcementSend.windowMs,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many announcement requests. Please wait a few minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = AnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid announcement." },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const isPreview = (body as { preview?: unknown }).preview === true;
  if (isPreview) {
    const preview = await previewAnnouncement({ kind: input.kind, statuses: input.statuses });
    return NextResponse.json({ ok: true, preview });
  }

  const result = await sendAnnouncement({
    subject: input.subject,
    message: input.message,
    kind: input.kind,
    statuses: input.statuses,
    actorEmail: guard.context.user.email,
    actorName: guard.context.user.name ?? guard.context.user.email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  void processDueEmailJobs({ limit: 10 }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    batchId: result.batchId,
    recipientCount: result.recipientCount,
  });
}
