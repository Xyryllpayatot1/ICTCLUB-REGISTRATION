"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RegistrationSchema, type RegistrationInput } from "@/lib/validation/schemas";
import { EXPERIENCE_LEVELS, GRADE_LEVELS, TRACKS } from "@/lib/config/program";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Registration form (client component).
 *
 * - Validation uses the SAME Zod schema as the server (the server re-validates
 *   independently — client checks are only for immediate feedback).
 * - Entered data is preserved on any failure.
 * - A per-form idempotency key makes retries safe (no duplicate rows).
 * - Inline errors are announced accessibly (aria-invalid + aria-describedby).
 * - Honeypot field (hidden from real users and assistive tech) filters bots.
 * - On success the reference is handed to the success page via sessionStorage
 *   (never placed in a URL).
 */

type FieldErrors = Record<string, string | undefined>;

interface FormState {
  status: "idle" | "submitting" | "error";
  message: string | null;
  duplicate: boolean;
}

const initialForm: RegistrationInput = {
  fullName: "",
  preferredName: "",
  email: "",
  gradeLevel: "" as unknown as RegistrationInput["gradeLevel"],
  section: "",
  track: "" as unknown as RegistrationInput["track"],
  experienceLevel: undefined,
  learningGoals: "",
  additionalInterests: "",
  essentialConsent: false,
  marketingConsent: false,
  website: "",
};

const inputClasses =
  "w-full rounded-md border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-300 focus:border-navy-500 focus:outline-none disabled:bg-slate-50";

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-navy-800">
      {children}
      {required ? (
        <span className="ml-1 text-rose-600" aria-hidden="true">
          *
        </span>
      ) : (
        <span className="ml-2 text-xs font-normal text-navy-400">optional</span>
      )}
    </label>
  );
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-rose-600">
      {message}
    </p>
  );
}

export function RegistrationForm({ registrationOpen }: { registrationOpen: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<RegistrationInput>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<FormState>({ status: "idle", message: null, duplicate: false });

  // One idempotency key per form instance; reused across retries.
  const idempotencyKey = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "",
  );

  const set = useCallback(<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key as string] ? { ...prev, [key as string]: undefined } : prev));
  }, []);

  const disabled = form.status === "submitting" || !registrationOpen;

  const validateField = useCallback(
    (key: keyof RegistrationInput, allValues: RegistrationInput): string | undefined => {
      const result = RegistrationSchema.safeParse(allValues);
      if (result.success) return undefined;
      const issue = result.error.issues.find((i) => i.path[0] === key);
      return issue?.message;
    },
    [],
  );

  const onBlurField = useCallback(
    (key: keyof RegistrationInput) => {
      setValues((current) => {
        const message = validateField(key, current);
        setErrors((prev) => ({ ...prev, [key]: message }));
        return current;
      });
    },
    [validateField],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (form.status === "submitting") return;

      const parsed = RegistrationSchema.safeParse(values);
      if (!parsed.success) {
        const nextErrors: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".") || "_form";
          if (!nextErrors[key]) nextErrors[key] = issue.message;
        }
        setErrors(nextErrors);
        setForm({
          status: "error",
          message: "Please correct the highlighted fields and try again.",
          duplicate: false,
        });
        // Move focus to the first invalid field for keyboard/screen-reader users.
        const firstKey = parsed.error.issues[0]?.path[0];
        if (typeof firstKey === "string") {
          document.getElementById(`reg-${firstKey}`)?.focus();
        }
        return;
      }

      setForm({ status: "submitting", message: null, duplicate: false });

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...parsed.data, idempotencyKey: idempotencyKey.current }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          outcome?: string;
          reference?: string;
          track?: string;
          message?: string;
          fieldErrors?: FieldErrors;
        };

        if (!response.ok || data.ok === false) {
          if (data.fieldErrors) setErrors(data.fieldErrors);
          setForm({
            status: "error",
            message: data.error ?? "Something went wrong. Please try again.",
            duplicate: false,
          });
          return;
        }

        if (data.outcome === "duplicate") {
          setForm({
            status: "error",
            message:
              data.message ??
              "A registration for this email has already been received. Please check your email or contact the organizers.",
            duplicate: true,
          });
          return;
        }

        // Success: hand the reference to the success page without putting it in a URL.
        try {
          sessionStorage.setItem(
            "mrmnhs_registration",
            JSON.stringify({
              reference: data.reference,
              track: data.track,
              at: Date.now(),
            }),
          );
        } catch {
          /* storage unavailable — the success page will fall back gracefully */
        }
        router.push("/register/success");
      } catch {
        setForm({
          status: "error",
          message: "Network error — please check your connection and try again. Your answers are still here.",
          duplicate: false,
        });
      }
    },
    [form.status, values, router],
  );

  const trackOptions = useMemo(() => TRACKS, []);
  const errId = (key: string) => `reg-${key}-error`;

  if (!registrationOpen) {
    return (
      <div className="rounded-xl border border-navy-200 bg-navy-50 p-8 text-center">
        <h3 className="text-lg font-semibold text-navy-900">Registration is currently closed</h3>
        <p className="mt-2 text-sm text-navy-600">
          Please watch official announcements — the form will open again when the organizers
          announce the next intake.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-describedby="reg-intro">
      <p id="reg-intro" className="text-sm text-navy-600">
        Fields marked with <span className="text-rose-600">*</span> are required. We only collect
        what is needed to run the program.
      </p>

      {/* Honeypot — invisible to people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="reg-website">Website</label>
        <input
          id="reg-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website ?? ""}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="reg-fullName" required>
            Full name
          </Label>
          <input
            id="reg-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            maxLength={120}
            className={cn(inputClasses, errors.fullName && "border-rose-400")}
            value={values.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            onBlur={() => onBlurField("fullName")}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? errId("fullName") : undefined}
            disabled={disabled}
          />
          <ErrorText id={errId("fullName")} message={errors.fullName} />
        </div>

        <div>
          <Label htmlFor="reg-preferredName">Preferred name</Label>
          <input
            id="reg-preferredName"
            name="preferredName"
            type="text"
            maxLength={80}
            className={cn(inputClasses, errors.preferredName && "border-rose-400")}
            value={values.preferredName ?? ""}
            onChange={(e) => set("preferredName", e.target.value)}
            onBlur={() => onBlurField("preferredName")}
            aria-invalid={Boolean(errors.preferredName)}
            aria-describedby={errors.preferredName ? errId("preferredName") : undefined}
            disabled={disabled}
          />
          <ErrorText id={errId("preferredName")} message={errors.preferredName} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="reg-email" required>
            Email address
          </Label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            className={cn(inputClasses, errors.email && "border-rose-400")}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => onBlurField("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? errId("email") : "reg-email-help"}
            disabled={disabled}
          />
          <p id="reg-email-help" className="mt-1.5 text-xs text-navy-500">
            Use an email you check regularly — announcements are sent here.
          </p>
          <ErrorText id={errId("email")} message={errors.email} />
        </div>

        <div>
          <Label htmlFor="reg-gradeLevel" required>
            Grade level
          </Label>
          <select
            id="reg-gradeLevel"
            name="gradeLevel"
            className={cn(inputClasses, errors.gradeLevel && "border-rose-400")}
            value={values.gradeLevel ?? ""}
            onChange={(e) => set("gradeLevel", e.target.value as RegistrationInput["gradeLevel"])}
            onBlur={() => onBlurField("gradeLevel")}
            aria-invalid={Boolean(errors.gradeLevel)}
            aria-describedby={errors.gradeLevel ? errId("gradeLevel") : undefined}
            disabled={disabled}
          >
            <option value="">Select your grade level</option>
            {GRADE_LEVELS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <ErrorText id={errId("gradeLevel")} message={errors.gradeLevel} />
        </div>

        <div>
          <Label htmlFor="reg-section">Section</Label>
          <input
            id="reg-section"
            name="section"
            type="text"
            maxLength={40}
            className={cn(inputClasses, errors.section && "border-rose-400")}
            value={values.section ?? ""}
            onChange={(e) => set("section", e.target.value)}
            onBlur={() => onBlurField("section")}
            aria-invalid={Boolean(errors.section)}
            aria-describedby={errors.section ? errId("section") : undefined}
            disabled={disabled}
          />
          <ErrorText id={errId("section")} message={errors.section} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="reg-track" required>
            Preferred learning track
          </Label>
          <select
            id="reg-track"
            name="track"
            className={cn(inputClasses, errors.track && "border-rose-400")}
            value={values.track ?? ""}
            onChange={(e) => set("track", e.target.value as RegistrationInput["track"])}
            onBlur={() => onBlurField("track")}
            aria-invalid={Boolean(errors.track)}
            aria-describedby={errors.track ? errId("track") : undefined}
            disabled={disabled}
          >
            <option value="">Select one primary track</option>
            {trackOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ErrorText id={errId("track")} message={errors.track} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="reg-experienceLevel">Current experience level</Label>
          <select
            id="reg-experienceLevel"
            name="experienceLevel"
            className={cn(inputClasses, errors.experienceLevel && "border-rose-400")}
            value={values.experienceLevel ?? ""}
            onChange={(e) =>
              set("experienceLevel", (e.target.value || undefined) as RegistrationInput["experienceLevel"])
            }
            onBlur={() => onBlurField("experienceLevel")}
            aria-invalid={Boolean(errors.experienceLevel)}
            aria-describedby={errors.experienceLevel ? errId("experienceLevel") : undefined}
            disabled={disabled}
          >
            <option value="">Select (optional)</option>
            {EXPERIENCE_LEVELS.map((e2) => (
              <option key={e2.id} value={e2.id}>
                {e2.label}
              </option>
            ))}
          </select>
          <ErrorText id={errId("experienceLevel")} message={errors.experienceLevel} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="reg-learningGoals">Learning goals</Label>
          <textarea
            id="reg-learningGoals"
            name="learningGoals"
            rows={3}
            maxLength={1000}
            placeholder="What do you hope to learn or achieve?"
            className={cn(inputClasses, errors.learningGoals && "border-rose-400")}
            value={values.learningGoals ?? ""}
            onChange={(e) => set("learningGoals", e.target.value)}
            onBlur={() => onBlurField("learningGoals")}
            aria-invalid={Boolean(errors.learningGoals)}
            aria-describedby={errors.learningGoals ? errId("learningGoals") : undefined}
            disabled={disabled}
          />
          <ErrorText id={errId("learningGoals")} message={errors.learningGoals} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="reg-additionalInterests">Additional ICT interests</Label>
          <textarea
            id="reg-additionalInterests"
            name="additionalInterests"
            rows={2}
            maxLength={500}
            placeholder="Other ICT topics you're curious about"
            className={cn(inputClasses, errors.additionalInterests && "border-rose-400")}
            value={values.additionalInterests ?? ""}
            onChange={(e) => set("additionalInterests", e.target.value)}
            onBlur={() => onBlurField("additionalInterests")}
            aria-invalid={Boolean(errors.additionalInterests)}
            aria-describedby={errors.additionalInterests ? errId("additionalInterests") : undefined}
            disabled={disabled}
          />
          <ErrorText id={errId("additionalInterests")} message={errors.additionalInterests} />
        </div>
      </div>

      {/* Consent — essential and marketing are separate, explicit choices */}
      <div className="space-y-4 rounded-xl border border-navy-100 bg-navy-50/60 p-5">
        <div>
          <div className="flex items-start gap-3">
            <input
              id="reg-essentialConsent"
              name="essentialConsent"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-navy-300 accent-navy-800"
              checked={values.essentialConsent === true}
              onChange={(e) => set("essentialConsent", e.target.checked)}
              aria-invalid={Boolean(errors.essentialConsent)}
              aria-describedby={errors.essentialConsent ? errId("essentialConsent") : "reg-essential-help"}
              disabled={disabled}
            />
            <div>
              <label htmlFor="reg-essentialConsent" className="text-sm font-medium text-navy-800">
                I agree to receive essential program-related communications{" "}
                <span className="text-rose-600" aria-hidden="true">
                  *
                </span>
              </label>
              <p id="reg-essential-help" className="mt-1 text-xs text-navy-500">
                Registration confirmations, participation instructions, and important program
                updates sent to the email address above.
              </p>
              <ErrorText id={errId("essentialConsent")} message={errors.essentialConsent} />
            </div>
          </div>
        </div>

        <div className="border-t border-navy-100 pt-4">
          <div className="flex items-start gap-3">
            <input
              id="reg-marketingConsent"
              name="marketingConsent"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-navy-300 accent-navy-800"
              checked={values.marketingConsent === true}
              onChange={(e) => set("marketingConsent", e.target.checked)}
              disabled={disabled}
            />
            <div>
              <label htmlFor="reg-marketingConsent" className="text-sm font-medium text-navy-800">
                I also want to receive optional announcements about future programs and activities
              </label>
              <p className="mt-1 text-xs text-navy-500">
                Optional. You can still join the program without this, and it never affects your
                registration.
              </p>
            </div>
          </div>
        </div>
      </div>

      {form.message ? (
        <div
          role="alert"
          className={cn(
            "rounded-lg border p-4 text-sm",
            form.duplicate
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          {form.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={disabled} className="px-8 py-3 text-base">
          {form.status === "submitting" ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-navy-900 border-t-transparent"
                aria-hidden="true"
              />
              Submitting…
            </>
          ) : (
            "Submit registration"
          )}
        </Button>
        <p className="text-xs text-navy-500">
          Your information is used only to administer this program. Read the{" "}
          <a href="/privacy" className="underline text-navy-700 hover:text-navy-900">
            privacy notice
          </a>
          .
        </p>
      </div>
      {form.status === "submitting" ? (
        <p role="status" className="sr-only">
          Submitting your registration, please wait.
        </p>
      ) : null}
    </form>
  );
}
