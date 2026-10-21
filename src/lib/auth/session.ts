import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";

/**
 * Server-managed admin sessions.
 *
 * - Session token: 32 random bytes, base64url. Only its SHA-256 hash is stored.
 * - Cookie: HttpOnly, SameSite=Lax, Secure in production, Path=/.
 * - Expiry: fixed lifetime with sliding activity tracking; expired sessions are
 *   rejected server-side and pruned periodically.
 * - CSRF: a per-session token derived from AUTH_SECRET is issued in a readable
 *   cookie at login; every state-changing admin request must echo it in the
 *   `x-csrf-token` header (see csrf.ts).
 */

export const SESSION_COOKIE = "mrmnhs_admin_session";
export const SESSION_HOURS = 12;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface SessionContext {
  session: { id: string; expiresAt: Date };
  user: SessionUser;
}

export function hashSessionToken(token: string): string {
  return sha256(token);
}

export function deriveCsrfToken(tokenHash: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`csrf:${tokenHash}`).digest("base64url");
}

export async function createSession(adminUserId: string): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const prisma = getPrisma();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);

  await prisma.session.create({
    data: { tokenHash, adminUserId, expiresAt },
  });

  return { token, csrfToken: deriveCsrfToken(tokenHash), expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Validate the session cookie and return the logged-in admin, or null. */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { adminUser: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding activity marker (best-effort; never blocks the response path).
  void prisma.session
    .updateMany({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return {
    session: { id: session.id, expiresAt: session.expiresAt },
    user: session.adminUser,
  };
}

/** Validate a raw session token (used by API guards that read cookies directly). */
export async function getSessionByToken(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null;
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { adminUser: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return { session: { id: session.id, expiresAt: session.expiresAt }, user: session.adminUser };
}

/** Delete expired sessions (called opportunistically on login). */
export async function pruneExpiredSessions(): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function baseCookieOptions(): { httpOnly: boolean; sameSite: "lax"; secure: boolean; path: string } {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setSessionCookies(response: NextResponse, token: string, csrfToken: string): void {
  const maxAge = SESSION_HOURS * 3600;
  response.cookies.set(SESSION_COOKIE, token, { ...baseCookieOptions(), maxAge });
  // Readable by client JS on purpose: it is a CSRF token, not a secret session.
  response.cookies.set("mrmnhs_csrf", csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete("mrmnhs_csrf");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
