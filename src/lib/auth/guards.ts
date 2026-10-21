import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import {
  SESSION_COOKIE,
  deriveCsrfToken,
  getSessionByToken,
  hashSessionToken,
  safeEqual,
  type SessionContext,
} from "@/lib/auth/session";

/**
 * Server-side authorization guards for admin API routes.
 *
 * Every protected endpoint calls one of these; authorization is never
 * delegated to client-side code or hidden links. CSRF protection combines:
 *  1. SameSite=Lax session cookies (baseline),
 *  2. Origin/Sec-Fetch-Site verification against APP_BASE_URL,
 *  3. A per-session HMAC token echoed in the `x-csrf-token` header.
 */

export interface GuardSuccess {
  ok: true;
  context: SessionContext;
}

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

function readCookieHeader(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** Verify the request came from our own origin (defense in depth for CSRF). */
export function verifyOrigin(req: Request): boolean {
  const { APP_BASE_URL } = getEnv();
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site") return false;

  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin non-browser requests (curl/tests) — cookie + CSRF still required
  try {
    return new URL(origin).host === new URL(APP_BASE_URL).host;
  } catch {
    return false;
  }
}

/** Authenticate an admin API request (session cookie + CSRF for mutations). */
export async function requireAdminApi(
  req: Request,
  opts: { csrf?: boolean } = { csrf: true },
): Promise<GuardResult> {
  if (!verifyOrigin(req)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
    };
  }

  const token = readCookieHeader(req, SESSION_COOKIE);
  const context = await getSessionByToken(token);
  if (!context) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  if (opts.csrf !== false) {
    const cookieToken = readCookieHeader(req, "mrmnhs_csrf");
    const headerToken = req.headers.get("x-csrf-token");
    const expected = deriveCsrfToken(hashSessionToken(token ?? ""));
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, expected) || !safeEqual(headerToken, cookieToken)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid or missing CSRF token." }, { status: 403 }),
      };
    }
  }

  return { ok: true, context };
}

/** Extract client IP for rate limiting (behind proxies this is the edge IP). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
