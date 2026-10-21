import { ButtonLink } from "@/components/ui";
import { OfficialLogos } from "@/components/brand";
import { getProgramConfig } from "@/lib/config/program";

/** Decorative circuit-node motif (pure CSS/SVG, hidden from the a11y tree). */
function CircuitVisual() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 240"
      className="h-full w-full text-navy-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Traces */}
      <path d="M20 60h70l24 24h60" strokeOpacity="0.7" />
      <path d="M20 130h40l30 30h90l20-20h100" strokeOpacity="0.55" />
      <path d="M60 210h80l24-24h116" strokeOpacity="0.45" />
      <path d="M250 30v40l-24 24" strokeOpacity="0.6" />
      <path d="M300 110h-40l-18-18" strokeOpacity="0.5" />
      {/* Nodes */}
      <circle cx="20" cy="60" r="4" className="fill-gold-400" stroke="none" />
      <circle cx="174" cy="84" r="4" className="fill-gold-400" stroke="none" />
      <circle cx="20" cy="130" r="4" strokeOpacity="0.7" />
      <circle cx="200" cy="140" r="4" className="fill-gold-400" stroke="none" />
      <circle cx="300" cy="140" r="4" strokeOpacity="0.7" />
      <circle cx="60" cy="210" r="4" strokeOpacity="0.7" />
      <circle cx="164" cy="186" r="4" className="fill-gold-400" stroke="none" />
      <circle cx="250" cy="30" r="4" strokeOpacity="0.7" />
      {/* Chip outline */}
      <rect x="118" y="96" width="84" height="60" rx="6" strokeOpacity="0.8" />
      <rect x="136" y="112" width="48" height="28" rx="3" strokeOpacity="0.5" />
    </svg>
  );
}

/**
 * Hero: headline, supporting copy, tagline, CTAs, and the general schedule.
 * Two balanced columns on desktop (copy + CTAs | logo branding panel with a
 * subtle circuit motif); stacked naturally on mobile.
 */
export function Hero() {
  const program = getProgramConfig();
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      {/* Decorative grid + circuit dots; purely visual, hidden from a11y tree. */}
      <div className="grid-sheen pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="circuit-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-24 top-16 hidden h-96 w-96 rounded-full bg-gold-400/10 blur-3xl lg:block"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Copy column */}
          <div>
            <p className="code-decoration mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-gold-400">
              Learn. Build. Advance.
            </p>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Build Your Future in ICT.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-100">
              Explore programming, networking, and practical technology skills through
              collaborative learning with the MRMNHS ICT Club.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href="#register" className="px-6 py-3 text-base">
                Register Now
              </ButtonLink>
              <ButtonLink
                href="#tracks"
                variant="outline"
                className="px-6 py-3 text-base"
              >
                Explore Learning Tracks
              </ButtonLink>
            </div>
          </div>

          {/* Branding / technology column */}
          <div className="relative overflow-hidden rounded-2xl border border-navy-700 bg-navy-800/80 p-6">
            <div className="circuit-trace pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative flex flex-col items-center gap-5 rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-8 sm:px-6">
              {/* Official logos on a white chip, undistorted, with alt text. */}
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <OfficialLogos size={64} gap="gap-3" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">MRMNHS ICT Club</p>
                <p className="code-decoration mt-1 text-xs uppercase tracking-[0.2em] text-gold-400">
                  {program.platformLabel}
                </p>
              </div>
              <div className="h-24 w-full max-w-[320px]" aria-hidden="true">
                <CircuitVisual />
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-12 grid max-w-3xl gap-4 rounded-xl border border-navy-700 bg-navy-800/70 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gold-400">Schedule</dt>
            <dd className="mt-1 text-sm text-navy-100">{program.schedule.replace("-", "–")}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gold-400">Session time</dt>
            <dd className="mt-1 text-sm text-navy-100">
              {program.startTime}–{program.endTime} {program.timezoneLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gold-400">Where</dt>
            <dd className="mt-1 text-sm text-navy-100">{program.platformLabel}</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-3xl text-sm text-navy-200">{program.sessionLengthNote}</p>
      </div>
    </section>
  );
}
