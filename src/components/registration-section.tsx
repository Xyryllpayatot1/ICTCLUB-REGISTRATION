import { getProgramConfig } from "@/lib/config/program";
import { RegistrationForm } from "@/components/registration-form";
import { SectionHeading } from "@/components/ui";
import { OfficialLogos } from "@/components/brand";

/** Registration section wrapper (anchor target for the CTAs on the landing page). */
export function RegistrationSection() {
  const program = getProgramConfig();
  return (
    <section id="register" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Compact branding header: school logo first, club logo second. */}
        <div className="mx-auto flex w-fit flex-col items-center gap-3 border-b border-navy-100 pb-6">
          <OfficialLogos size={56} gap="gap-4" />
          <p className="code-decoration text-xs font-semibold uppercase tracking-[0.2em] text-navy-500">
            Registration form
          </p>
        </div>
        <SectionHeading
          eyebrow="Registration"
          title="Register for the Teaching Program"
          description="Complete the form below to register your interest. You'll receive a confirmation email with your registration reference."
        />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-navy-600">
          <span>{program.scheduleLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{program.platformLabel}</span>
        </div>
        <div className="mt-10 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8">
          <RegistrationForm registrationOpen={program.registrationOpen} />
        </div>
      </div>
    </section>
  );
}
