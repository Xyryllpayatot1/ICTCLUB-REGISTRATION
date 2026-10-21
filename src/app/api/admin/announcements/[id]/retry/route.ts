import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { retryAnnouncementFailures } from "@/lib/admin/announcements";
import { processDueEmailJobs } from "@/lib/email/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const { retried } = await retryAnnouncementFailures(id, guard.context.user.email);

  if (retried > 0) {
    void processDueEmailJobs({ limit: 10 }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, retried });
}
