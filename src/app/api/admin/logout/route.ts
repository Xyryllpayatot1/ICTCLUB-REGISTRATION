import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroySession, clearSessionCookies, hashSessionToken } from "@/lib/auth/session";
import { verifyOrigin } from "@/lib/auth/guards";
import { logAudit, AUDIT_ACTIONS } from "@/lib/admin/audit";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifyOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  const token = match?.slice(SESSION_COOKIE.length + 1);

  if (token) {
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: { adminUser: { select: { email: true } } },
    });
    await destroySession(token);
    if (session) {
      await logAudit({ action: AUDIT_ACTIONS.ADMIN_LOGOUT, actor: session.adminUser.email });
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
