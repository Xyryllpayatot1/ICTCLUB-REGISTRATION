import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { getAnnouncementBatch } from "@/lib/admin/announcements";
import { refreshAnnouncementBatchCounters } from "@/lib/email/outbox";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req, { csrf: false });
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const result = await getAnnouncementBatch(id);
  if (!result) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  // Refresh counters so the polling UI reflects live progress.
  await refreshAnnouncementBatchCounters(getPrisma(), id);
  const fresh = await getAnnouncementBatch(id);

  return NextResponse.json({
    ok: true,
    batch: fresh?.batch,
    failures: fresh?.failures ?? [],
  });
}
