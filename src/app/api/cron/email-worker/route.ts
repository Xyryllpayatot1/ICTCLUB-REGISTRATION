import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { processDueEmailJobs } from "@/lib/email/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/email-worker
 *
 * Processes due email jobs. Protected by CRON_SECRET (Bearer token). Called by:
 * - Vercel Cron / platform schedulers,
 * - external schedulers (cron-job.org, GitHub Actions schedule),
 * - tests and the `npm run email:process` script.
 *
 * Body/query may include `limit` (1–100).
 */
export async function POST(req: Request) {
  const env = getEnv();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let limit = 20;
  try {
    const url = new URL(req.url);
    const q = Number(url.searchParams.get("limit"));
    if (Number.isFinite(q) && q > 0) limit = q;
  } catch {
    /* body-less call */
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    if (typeof body.limit === "number" && body.limit > 0) limit = body.limit;
  } catch {
    /* ignore */
  }
  limit = Math.min(100, Math.max(1, limit));

  const result = await processDueEmailJobs({ limit });
  return NextResponse.json({ ok: true, ...result });
}

/** Allow GET for schedulers that can only hit URLs (still auth-protected). */
export async function GET(req: Request) {
  return POST(req);
}
