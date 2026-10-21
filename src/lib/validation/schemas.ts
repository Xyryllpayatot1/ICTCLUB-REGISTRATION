import { z } from "zod";
import {
  EXPERIENCE_LEVEL_IDS,
  GRADE_LEVEL_IDS,
  STATUS_IDS,
  TRACK_IDS,
} from "@/lib/config/program";

/**
 * Registration schema shared by client and server.
 *
 * Server-side validation is authoritative: the form uses this same schema for
 * immediate feedback, but every submission is validated again on the server.
 */

export const FIELD_LIMITS = {
  fullName: { min: 2, max: 120 },
  preferredName: { max: 80 },
  email: { max: 254 },
  section: { max: 40 },
  learningGoals: { max: 1000 },
  additionalInterests: { max: 500 },
  honeypot: { max: 0 },
} as const;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? undefined : t;
    });

export const RegistrationSchema = z.object({
  fullName: z
    .string("Please enter your full name.")
    .trim()
    .min(FIELD_LIMITS.fullName.min, "Please enter your full name (at least 2 characters).")
    .max(FIELD_LIMITS.fullName.max, `Full name must be ${FIELD_LIMITS.fullName.max} characters or fewer.`),

  preferredName: optionalTrimmed(FIELD_LIMITS.preferredName.max),

  email: z
    .string("Please enter your email address.")
    .trim()
    .max(FIELD_LIMITS.email.max, `Email must be ${FIELD_LIMITS.email.max} characters or fewer.`)
    .pipe(z.email("Please enter a valid email address (e.g. name@example.com)."))
    .transform((v) => v.toLowerCase()),

  gradeLevel: z.enum(GRADE_LEVEL_IDS, "Please select your grade level."),

  section: optionalTrimmed(FIELD_LIMITS.section.max),

  track: z.enum(TRACK_IDS, "Please select a learning track."),

  experienceLevel: z
    .enum(EXPERIENCE_LEVEL_IDS, "Please select an experience level.")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  learningGoals: optionalTrimmed(FIELD_LIMITS.learningGoals.max),

  additionalInterests: optionalTrimmed(FIELD_LIMITS.additionalInterests.max),

  essentialConsent: z
    .boolean()
    .refine((v) => v === true, "You must agree to receive essential program communications."),

  marketingConsent: z.boolean().optional().default(false),

  /** Anti-spam honeypot — must be empty. */
  website: z.string().max(FIELD_LIMITS.honeypot.max).optional().default(""),

  /** Client-generated idempotency key to make retries safe. */
  idempotencyKey: z.uuid("Invalid submission token.").optional(),
});

export type RegistrationInput = z.input<typeof RegistrationSchema>;
export type ValidatedRegistration = z.output<typeof RegistrationSchema>;

// ---------------------------------------------------------------------------
// Admin schemas
// ---------------------------------------------------------------------------

export const AdminLoginSchema = z.object({
  email: z
    .email("Enter a valid email address.")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required.").max(200),
});

export const StatusUpdateSchema = z.object({
  status: z.enum(STATUS_IDS, "Invalid status."),
  note: z.string().trim().max(2000, "Note must be 2000 characters or fewer.").optional(),
});

export const AdminNoteSchema = z.object({
  note: z.string().trim().max(2000, "Note must be 2000 characters or fewer."),
});

export const AnnouncementSchema = z
  .object({
    subject: z
      .string("Subject is required.")
      .trim()
      .min(3, "Subject must be at least 3 characters.")
      .max(150, "Subject must be 150 characters or fewer."),
    message: z
      .string("Message is required.")
      .trim()
      .min(10, "Message must be at least 10 characters.")
      .max(5000, "Message must be 5000 characters or fewer."),
    kind: z.enum(["essential", "marketing"], "Invalid announcement type."),
    statuses: z
      .array(z.enum(STATUS_IDS))
      .min(1, "Select at least one audience status.")
      .max(STATUS_IDS.length),
  })
  .refine((v) => !(v.kind === "marketing" && v.statuses.includes("declined")), {
    message: "Marketing announcements must not target declined or cancelled registrations.",
    path: ["statuses"],
  })
  .refine((v) => !(v.kind === "marketing" && v.statuses.includes("cancelled")), {
    message: "Marketing announcements must not target declined or cancelled registrations.",
    path: ["statuses"],
  });

export const AnnouncementRetrySchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1).max(500),
});
