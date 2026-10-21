import { getEnv } from "@/lib/config/env";
import { getPrisma } from "@/lib/db/prisma";
import { ACTIVE_STATUSES, trackLabel } from "@/lib/config/program";
import { normalizeEmail } from "@/lib/utils";
import { generateUniqueReference } from "@/lib/registration/reference";
import { enqueueEmail } from "@/lib/email/outbox";
import { renderConfirmationEmail, renderApprovalEmail, renderWaitlistEmail, renderDeclineEmail } from "@/lib/email/templates";
import type { ValidatedRegistration } from "@/lib/validation/schemas";

/**
 * Registration business logic.
 *
 * Guarantees:
 * - Duplicate active registrations per normalized email are prevented by a
 *   partial unique index (race-safe), with a generic response that does not
 *   leak whether an arbitrary email belongs to a participant.
 * - Idempotency keys make client retries return the original result instead of
 *   creating a second registration.
 * - The confirmation email is queued AFTER the registration is committed; the
 *   registration never depends on email delivery.
 */

export type CreateRegistrationResult =
  | { outcome: "created"; reference: string; track: string }
  | { outcome: "duplicate"; reference: null; track: null }
  | { outcome: "idempotent_replay"; reference: string; track: string };

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const e = error as { code: string; meta?: { target?: string[] } };
  if (e.code !== "P2002") return false;
  if (!field || !e.meta?.target) return true;
  return e.meta.target.includes(field);
}

export async function createRegistration(input: ValidatedRegistration): Promise<CreateRegistrationResult> {
  const env = getEnv();
  const prisma = getPrisma();
  const emailNormalized = normalizeEmail(input.email);

  // 1. Idempotent replay — same browser retry returns the original result.
  if (input.idempotencyKey) {
    const existing = await prisma.registration.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { reference: true, track: true },
    });
    if (existing) {
      return { outcome: "idempotent_replay", reference: existing.reference, track: existing.track };
    }
  }

  // 2. Duplicate active registration — generic message, no enumeration.
  const duplicate = await prisma.registration.findFirst({
    where: { emailNormalized, status: { in: ACTIVE_STATUSES } },
    select: { id: true },
  });
  if (duplicate) {
    return { outcome: "duplicate", reference: null, track: null };
  }

  // 3. Create the registration and queue the confirmation email atomically.
  const reference = await generateUniqueReference(async (candidate) =>
    Boolean(await prisma.registration.findUnique({ where: { reference: candidate }, select: { id: true } })),
  );

  const now = new Date();
  try {
    const created = await prisma.registration.create({
      data: {
        reference,
        email: input.email,
        emailNormalized,
        fullName: input.fullName,
        preferredName: input.preferredName ?? null,
        gradeLevel: input.gradeLevel,
        section: input.section ?? null,
        track: input.track,
        experienceLevel: input.experienceLevel ?? null,
        learningGoals: input.learningGoals ?? null,
        additionalInterests: input.additionalInterests ?? null,
        status: env.REGISTRATION_STATUS_DEFAULT,
        essentialConsent: true,
        essentialConsentAt: now,
        marketingConsent: input.marketingConsent ?? false,
        marketingConsentAt: input.marketingConsent ? now : null,
        idempotencyKey: input.idempotencyKey ?? null,
        confirmationEmailStatus: "queued",
      },
      select: { id: true, reference: true, track: true, preferredName: true, fullName: true },
    });

    const rendered = renderConfirmationEmail({
      displayName: created.preferredName || created.fullName,
      reference: created.reference,
      track: created.track,
    });

    await enqueueEmail({
      kind: "confirmation",
      dedupeKey: `confirmation:${created.id}`,
      toEmail: input.email,
      toName: created.preferredName || created.fullName,
      subject: rendered.subject,
      payload: {
        displayName: created.preferredName || created.fullName,
        reference: created.reference,
        track: created.track,
      },
      registrationId: created.id,
    });

    return { outcome: "created", reference: created.reference, track: created.track };
  } catch (error) {
    // Race on the partial unique index (two identical submissions arriving at
    // the exact same moment) surfaces as a unique violation — treat as duplicate.
    if (isUniqueViolation(error, "emailNormalized") || isUniqueViolation(error, "idempotencyKey")) {
      if (input.idempotencyKey) {
        const existing = await prisma.registration.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { reference: true, track: true },
        });
        if (existing) {
          return { outcome: "idempotent_replay", reference: existing.reference, track: existing.track };
        }
      }
      return { outcome: "duplicate", reference: null, track: null };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Status transitions (admin-initiated)
// ---------------------------------------------------------------------------

export type StatusTransitionEmail = "approval" | "waitlist" | "decline" | "cancelled" | null;

export function emailKindForTransition(to: string): StatusTransitionEmail {
  switch (to) {
    case "approved":
      return "approval";
    case "waitlisted":
      return "waitlist";
    case "declined":
      return "decline";
    case "cancelled":
      return "cancelled";
    default:
      return null; // back to pending_review → no email
  }
}

export interface UpdateStatusOptions {
  registrationId: string;
  to: string;
  actor: string;
  /** Unique per admin action so double-clicks do not double-send. */
  transitionId: string;
  note?: string | null;
}

export interface UpdateStatusResult {
  ok: boolean;
  status?: string;
  error?: string;
}

export async function updateRegistrationStatus(opts: UpdateStatusOptions): Promise<UpdateStatusResult> {
  const prisma = getPrisma();

  const registration = await prisma.registration.findUnique({
    where: { id: opts.registrationId },
    select: { id: true, reference: true, email: true, fullName: true, preferredName: true, track: true, status: true },
  });
  if (!registration) return { ok: false, error: "Registration not found." };
  if (registration.status === opts.to) {
    return { ok: true, status: registration.status };
  }

  const updated = await prisma.registration.update({
    where: { id: opts.registrationId },
    data: { status: opts.to },
    select: { id: true, status: true, reference: true, email: true, fullName: true, preferredName: true, track: true },
  });

  const emailKind = emailKindForTransition(opts.to);
  if (emailKind) {
    const displayName = updated.preferredName || updated.fullName;
    const payload = { displayName, reference: updated.reference, track: updated.track, note: opts.note ?? null };
    const rendered =
      emailKind === "approval"
        ? renderApprovalEmail(payload)
        : emailKind === "waitlist"
          ? renderWaitlistEmail(payload)
          : renderDeclineEmail(payload, emailKind === "cancelled" ? "cancelled" : "declined");

    await enqueueEmail({
      kind: emailKind,
      dedupeKey: `status-email:${updated.id}:${opts.to}:${opts.transitionId}`,
      toEmail: updated.email,
      toName: displayName,
      subject: rendered.subject,
      payload,
      registrationId: updated.id,
    });
  }

  return { ok: true, status: updated.status };
}

/** Human-readable track label used in emails/UI. */
export { trackLabel };
