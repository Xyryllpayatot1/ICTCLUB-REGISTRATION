import { z } from "zod";

/**
 * Central environment validation.
 *
 * All server-side configuration is read from process.env and validated here in
 * one place. Missing or invalid configuration produces a clear, actionable
 * error instead of a cryptic runtime failure later. In development the errors
 * are printed once; in production/ tests they are thrown.
 */

const EXAMPLE_SECRET_MARKER = "change-me";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),

    APP_BASE_URL: z
      .string()
      .url("APP_BASE_URL must be a valid URL, e.g. https://example.com")
      .transform((v) => v.replace(/\/+$/, "")),

    AUTH_SECRET: z
      .string()
      .min(1, "AUTH_SECRET is required.")
      .refine((v) => v.length >= 32, "AUTH_SECRET must be at least 32 characters long.")
      .refine(
        (v) => !v.toLowerCase().includes(EXAMPLE_SECRET_MARKER),
        "AUTH_SECRET still contains the example placeholder. Generate a real secret.",
      ),

    EMAIL_PROVIDER: z.enum(["resend", "smtp", "dev-outbox"]).default("dev-outbox"),
    EMAIL_PROVIDER_API_KEY: z.string().optional().default(""),
    EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required, e.g. 'MRMNHS ICT Club <you@domain.tld>'."),
    EMAIL_ADMIN_NOTIFY: z.string().optional().default(""),

    // Gmail SMTP (EMAIL_PROVIDER="smtp"). Server-side only — never exposed to
    // the browser bundle (no NEXT_PUBLIC_ prefix) and never written to logs.
    GMAIL_USER: z.string().optional().default(""),
    // Gmail App Password (16 chars, spaces tolerated and stripped at use).
    GMAIL_APP_PASSWORD: z.string().optional().default(""),

    CRON_SECRET: z.string().optional().default(""),
    EMAIL_WORKER_INTERVAL_MS: z.coerce.number().int().min(5000).default(15000),

    ADMIN_EMAILS: z.string().optional().default(""),

    PROGRAM_TIMEZONE: z.string().default("Asia/Manila"),
    PROGRAM_START_TIME: z.string().default("19:00"),
    PROGRAM_END_TIME: z.string().default("20:00"),
    PROGRAM_SCHEDULE: z.string().default("Sunday-Saturday"),
    REGISTRATION_STATUS_DEFAULT: z
      .enum(["pending_review", "approved", "waitlisted"])
      .default("pending_review"),
    REGISTRATION_OPEN: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    CONTACT_EMAIL: z.string().optional().default(""),
    PROGRAM_MEETING_URL: z
      .string()
      .optional()
      .default("")
      .refine((v) => v === "" || /^https:\/\//.test(v), "PROGRAM_MEETING_URL must be an https:// URL."),
    PROGRAM_START_DATE: z.string().optional().default(""),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "resend" && !env.EMAIL_PROVIDER_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER_API_KEY"],
        message:
          'EMAIL_PROVIDER_API_KEY is required when EMAIL_PROVIDER="resend". Set it, or use EMAIL_PROVIDER="dev-outbox" for local development.',
      });
    }
    if (
      env.EMAIL_PROVIDER === "smtp" &&
      env.NODE_ENV === "production" &&
      (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD)
    ) {
      ctx.addIssue({
        code: "custom",
        path: env.GMAIL_USER ? ["GMAIL_APP_PASSWORD"] : ["GMAIL_USER"],
        message:
          'GMAIL_USER and GMAIL_APP_PASSWORD are required when EMAIL_PROVIDER="smtp" in production. ' +
          "Create one at myaccount.google.com → Security → 2-Step Verification → App passwords, " +
          'or use EMAIL_PROVIDER="dev-outbox" for local development.',
      });
    }
    if (env.NODE_ENV === "production") {
      if (!env.DATABASE_URL.startsWith("postgres")) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message:
            "Production must use a managed PostgreSQL database (DATABASE_URL starting with postgresql://). SQLite is for local development only.",
        });
      }
      if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET must be set to at least 32 random characters in production.",
        });
      }
      if (env.EMAIL_PROVIDER === "dev-outbox") {
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER"],
          message:
            "EMAIL_PROVIDER=\"dev-outbox\" does not send real email and must not be used in production.",
        });
      }
      if (!env.CRON_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["CRON_SECRET"],
          message: "CRON_SECRET must be set in production to protect the email worker endpoint.",
        });
      }
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

/** Human-readable setup steps shown when SMTP is selected but unconfigured. */
export const SMTP_SETUP_INSTRUCTIONS = [
  'Email provider "smtp" (Gmail) is selected but GMAIL_USER / GMAIL_APP_PASSWORD are not set,',
  "so email sending is disabled. To enable it:",
  "  1. Open the Google account → Security → 2-Step Verification (must be ON).",
  "  2. Create an App Password: myaccount.google.com/security/apppasswords",
  "  3. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env (server-side only) and restart.",
  'Or switch back to local simulation with EMAIL_PROVIDER="dev-outbox".',
].join("\n");

/** True when the Gmail SMTP credentials are present. */
export function isSmtpConfigured(env: AppEnv): boolean {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

let cached: AppEnv | null = null;
let reported = false;
let smtpWarned = false;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Returns the validated environment configuration.
 * Throws with a readable message when configuration is missing or invalid.
 */
export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = [
      "Invalid environment configuration:",
      formatIssues(parsed.error),
      "",
      "Copy .env.example to .env and fill in the required values. See README.md for setup help.",
    ].join("\n");
    if (process.env.NODE_ENV !== "production") {
      if (!reported) {
        console.error(`\n[config] ${message}\n`);
        reported = true;
      }
    }
    throw new Error(message);
  }
  cached = parsed.data;
  // Development: missing SMTP credentials disable sending clearly instead of
  // failing boot — report the setup instructions once on the server console.
  if (
    !smtpWarned &&
    cached.NODE_ENV !== "production" &&
    cached.EMAIL_PROVIDER === "smtp" &&
    !isSmtpConfigured(cached)
  ) {
    console.warn(`\n[config] ${SMTP_SETUP_INSTRUCTIONS}\n`);
    smtpWarned = true;
  }
  return cached;
}

/** Comma-separated admin allowlist (lowercased, deduplicated). */
export function getAdminAllowlist(): string[] {
  return getEnv()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Test helper: clear the cached environment (used when env changes between tests). */
export function resetEnvCache(): void {
  cached = null;
  reported = false;
  smtpWarned = false;
}
