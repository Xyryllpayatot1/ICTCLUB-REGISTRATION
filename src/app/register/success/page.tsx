import Link from "next/link";
import { getProgramConfig } from "@/lib/config/program";
import { ButtonLink } from "@/components/ui";
import { OfficialLogos } from "@/components/brand";
import { RegistrationSummaryClient } from "./registration-summary-client";

export const metadata = { title: "Registration received" };
export const dynamic = "force-dynamic";

/**
 * Post-registration success page.
 *
 * The reference is read from sessionStorage (set by the form on success) so it
 * never appears in a URL, server logs, or referrer headers. If the page is
 * opened directly, it degrades gracefully with instructions to check email.
 */
export default function SuccessPage() {
  const program = getProgramConfig();

  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-sm">
        {/* Compact branding: both official logos (school first, then club). */}
        <div className="flex flex-col items-center gap-3 border-b border-navy-100 pb-6">
          <OfficialLogos size={52} gap="gap-4" />
          <p className="code-decoration text-xs font-semibold uppercase tracking-[0.2em] text-navy-500">
            MRMNHS ICT Club · Registration
          </p>
        </div>

        <div
          className="mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-2xl text-gold-400"
          aria-hidden="true"
        >
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-bold text-navy-900 sm:text-3xl">
          Your registration was received!
        </h1>
        <p className="mt-3 text-base leading-relaxed text-navy-600">
          Thank you for registering for the MRMNHS ICT Club Teaching Program. We have saved your
          registration and sent a confirmation email to the address you provided.
        </p>

        <RegistrationSummaryClient />

        <div className="mt-8 space-y-3 rounded-xl border border-navy-100 bg-navy-50/70 p-5 text-sm text-navy-700">
          <p>
            <strong>Program schedule:</strong> {program.scheduleLabel}
          </p>
          <p>
            <strong>Platform:</strong> {program.platformLabel}
          </p>
          <p>{program.sessionLengthNote}</p>
        </div>

        <div className="mt-8 rounded-xl border border-gold-300 bg-gold-300/20 p-5 text-sm text-navy-800">
          <p>
            <strong>What happens next:</strong> Watch your inbox for official program announcements
            and participation instructions. Submitting the registration does not automatically
            confirm acceptance if registration review is required.
          </p>
        </div>

        <div className="mt-8">
          <ButtonLink href="/">Back to the main page</ButtonLink>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-navy-500">
        Need to fix something in your registration? Contact the program organizers and provide your
        registration reference. For your safety, registrations cannot be edited publicly by
        reference alone.{" "}
        <Link href="/privacy" className="text-navy-700 underline">
          Privacy notice
        </Link>
      </p>
    </main>
  );
}
