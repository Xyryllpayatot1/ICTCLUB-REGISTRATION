import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guards";
import { exportRegistrationsCsv } from "@/lib/admin/registrations";
import { logAudit, AUDIT_ACTIONS } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminApi(req, { csrf: false });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const track = url.searchParams.get("track") ?? undefined;
  const gradeLevel = url.searchParams.get("gradeLevel") ?? undefined;

  try {
    const csv = await exportRegistrationsCsv({ status, track, gradeLevel });

    await logAudit({
      action: AUDIT_ACTIONS.EXPORT_CSV,
      actor: guard.context.user.email,
      detail: { filters: { status: status ?? "all", track: track ?? "all", gradeLevel: gradeLevel ?? "all" } },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mrmnhs-ict-registrations-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export] failed:", (error as Error).message);
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
