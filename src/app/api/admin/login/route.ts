import { NextResponse } from "next/server";
import { getEnv, getAdminAllowlist } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";
import { AdminLoginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookies,
  pruneExpiredSessions,
} from "@/lib/auth/session";
import { clientIp, verifyOrigin } from "@/lib/auth/guards";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAudit, AUDIT_ACTIONS } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/login
 *
 * Secure server-managed session login. Protections:
 * - Rate limiting per IP and per email (5 attempts / 15 min).
 * - Constant-time password verification via scrypt.
 * - Admin accounts must exist in the DB (provisioned by `npm run admin:create`)
 *   and, when ADMIN_EMAILS is configured, appear on the allowlist.
 * - No public registration endpoint; no default credentials.
 */

export async function POST(req: Request) {
  if (!verifyOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const ip = clientIp(req);
  const ipLimited = rateLimit(`login-ip:${ip}`, RATE_LIMITS.auth.limit, RATE_LIMITS.auth.windowMs);
  if (!ipLimited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later.", retryAfterSeconds: ipLimited.retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = AdminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 422 });
  }
  const { email, password } = parsed.data;

  const emailLimited = rateLimit(
    `login-email:${email}`,
    RATE_LIMITS.auth.limit,
    RATE_LIMITS.auth.windowMs,
  );
  if (!emailLimited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts for this account. Please try again later." },
      { status: 429 },
    );
  }

  const prisma = getPrisma();
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Uniform failure path: same message and comparable timing whether the
  // account exists or the password is wrong.
  const genericFailure = async () => {
    await logAudit({
      action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
      actor: email,
      detail: { ip },
    });
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  };

  if (!admin) {
    // Run a dummy verification to reduce timing differences.
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return genericFailure();
  }

  const allowlist = getAdminAllowlist();
  const onAllowlist = allowlist.length === 0 || allowlist.includes(email);
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid || !onAllowlist) {
    return genericFailure();
  }

  const { token, csrfToken } = await createSession(admin.id);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  void pruneExpiredSessions().catch(() => undefined);

  await logAudit({
    action: AUDIT_ACTIONS.ADMIN_LOGIN,
    actor: email,
    detail: { ip, env: getEnv().NODE_ENV },
  });

  const response = NextResponse.json({ ok: true, user: { email: admin.email, name: admin.name } });
  setSessionCookies(response, token, csrfToken);
  return response;
}
