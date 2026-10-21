import { SectionHeading } from "@/components/ui";
import { TRACKS } from "@/lib/config/program";

/**
 * Consistent line icons (navy tile, gold strokes) — one per track, drawn as
 * simple technology motifs. Decorative only.
 */
function TrackIcon({ id, className }: { id: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (id) {
    case "programming-web-dev":
      return (
        <svg {...common}>
          <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 16" />
        </svg>
      );
    case "computer-networking":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="5" rx="1" />
          <rect x="3" y="16" width="6" height="5" rx="1" />
          <rect x="15" y="16" width="6" height="5" rx="1" />
          <path d="M12 8v4M6 16v-2h12v2" />
        </svg>
      );
    case "database-backend":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5.5" rx="8" ry="3" />
          <path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      );
    case "cybersecurity-fundamentals":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "advanced-ict-skills":
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
        </svg>
      );
  }
}

/** The five learning areas featured on the public page. */
const FEATURED_TRACK_IDS = [
  "programming-web-dev",
  "computer-networking",
  "database-backend",
  "cybersecurity-fundamentals",
  "advanced-ict-skills",
] as const;

/**
 * Learning tracks presented as consistent, responsive cards. These are
 * intended learning areas announced by the organizers — not a fixed syllabus
 * guaranteed for every session.
 */
export function LearningTracks() {
  const featured = TRACKS.filter((t) =>
    (FEATURED_TRACK_IDS as readonly string[]).includes(t.id),
  );

  return (
    <section id="tracks" className="scroll-mt-20 bg-navy-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Learning tracks"
          title="Choose the area of ICT you want to explore"
          description="Pick one primary track when you register. Topics within each track are intended learning areas announced by the organizers — not a fixed syllabus for every session."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((track) => (
            <article
              key={track.id}
              className="flex flex-col rounded-xl border border-navy-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-gold-400">
                  <TrackIcon id={track.id} className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold text-navy-900">{track.label}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{track.description}</p>
              <ul className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm text-navy-700">
                {track.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {/* Undecided option — also selectable in the registration form */}
          <article className="flex flex-col justify-between rounded-xl border border-navy-200 border-dashed bg-white/60 p-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-navy-300 text-navy-500">
                  <TrackIcon id="exploring-multiple-tracks" className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold text-navy-800">Not sure yet?</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">
                You can choose <strong>Exploring Multiple Tracks</strong> when you register and
                sample topics from several areas before deciding on a focus.
              </p>
            </div>
            <a
              href="#register"
              className="mt-4 inline-flex text-sm font-semibold text-navy-700 underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-navy-900"
            >
              Go to registration
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
