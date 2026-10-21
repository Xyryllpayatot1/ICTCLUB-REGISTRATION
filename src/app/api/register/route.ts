import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { getProgramConfig } from "@/lib/config/program";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { createRegistration } from "@/lib/registration/service";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/registrations → /api/register
 *
 * Creates a registration. Server-side validation is authoritative; the form's
 * client-side validation is only for immediate feedback. Anti-spam layers:
 * rate limiting per IP and a honeypot field. Duplicate active registrations
 * are answered with a generic message (no enumeration), and idempotency keys
 * make network retries safe.
 */

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: Request) {
  getEnv(); // validate required env before handling any registration
  const program = getProgramConfig();

  // Rate limit before parsing the body.
  const ip = clientIp(req);
  const limited = rateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!limited.ok) {
    return jsonError(
      "Too many attempts. Please wait a moment and try again.",
      429,
      { retryAfterSeconds: limited.retryAfterSeconds },
    );
  }

  if (!program.registrationOpen) {
    return jsonError("Registration is currently closed. Please watch for official announcements.", 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  // Honeypot: bots fill hidden fields. Pretend success without storing anything.
  const honeypot = (body as { website?: unknown })?.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    console.warn("[register] honeypot triggered — submission discarded (no data stored).");
    return NextResponse.json({
      ok: true,
      outcome: "created",
      reference: "MRMNHS-DEMO0000",
      track: "",
      message: "Registration received.",
    });
  }

  const parsed = RegistrationSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return jsonError("Please correct the highlighted fields.", 422, { fieldErrors });
  }

  try {
    const result = await createRegistration(parsed.data);

    if (result.outcome === "duplicate") {
      // Generic, non-enumerating response. The legitimate student already has
      // their reference from their confirmation email.
      return NextResponse.json({
        ok: true,
        outcome: "duplicate",
        message:
          "A registration for this email address has already been received. If that was you, please check your email for your registration reference. To update or re-submit a registration, contact the program organizers.",
      });
    }

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      reference: result.reference,
      track: result.track,
    });
  } catch (error) {
    // Never leak internals; log server-side without personal data.
    console.error("[register] failed to save registration:", (error as Error).message);
    return jsonError(
      "We could not save your registration right now. Please try again in a few minutes.",
      500,
    );
  }
}
