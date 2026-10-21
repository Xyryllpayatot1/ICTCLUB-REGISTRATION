import { getEnv } from "./env";

/**
 * Program constants and configurable school-specific details.
 *
 * Anything that has not been confirmed by the school organizers (start date,
 * deadline, meeting links, contacts) is read from configuration and simply
 * omitted from the UI when unset — it is never invented.
 */

export const SCHOOL_NAME = "Marciano Del Rosario Memorial National High School";
export const SCHOOL_SHORT = "MRMNHS";
export const CLUB_NAME = "MRMNHS ICT Club";
export const PROGRAM_NAME = "ICT Club Teaching Program";
export const TAGLINE = "Learn. Build. Advance.";

// ---------------------------------------------------------------------------
// Controlled vocabularies (shared by form, server validation, admin UI)
// ---------------------------------------------------------------------------

export const TRACKS = [
  {
    id: "programming-web-dev",
    label: "Programming and Web Development",
    description: "Build real web pages and applications while learning programming fundamentals.",
    bullets: [
      "HTML, CSS, JavaScript",
      "Python fundamentals",
      "Git and GitHub",
      "Web applications and practical projects",
    ],
  },
  {
    id: "computer-networking",
    label: "Computer Networking",
    description: "Understand how networks are addressed, built, configured, and troubleshot.",
    bullets: [
      "IP addressing and subnetting",
      "LAN concepts",
      "Router and switch configuration concepts",
      "Network troubleshooting",
      "Network simulation with Cisco Packet Tracer",
    ],
  },
  {
    id: "database-backend",
    label: "Database and Backend Development",
    description: "Store, query, and serve data through databases, APIs, and backend services.",
    bullets: [
      "Database fundamentals",
      "SQL basics",
      "APIs and backend concepts",
      "Data handling and application integration",
    ],
  },
  {
    id: "cybersecurity-fundamentals",
    label: "Cybersecurity Fundamentals",
    description: "Learn to protect accounts, devices, and data — and think like a defender.",
    bullets: [
      "Security awareness",
      "Authentication and access control",
      "Safe computing practices",
      "Ethical and authorized security learning",
    ],
  },
  {
    id: "advanced-ict-skills",
    label: "Advanced ICT Skills",
    description: "Go beyond the basics with systems, hardware, and deployment topics.",
    bullets: [
      "Windows and Linux administration",
      "Hardware maintenance and diagnostics",
      "System development and deployment",
      "Other topics announced by program organizers",
    ],
  },
  {
    id: "exploring-multiple-tracks",
    label: "Exploring Multiple Tracks",
    description: "Not sure yet? Sample topics from several tracks and decide as you learn.",
    bullets: [
      "A bit of everything the program offers",
      "Guidance on choosing a focus track",
      "Rotating practical activities",
    ],
  },
] as const;

export const TRACK_IDS = [
  "programming-web-dev",
  "computer-networking",
  "database-backend",
  "cybersecurity-fundamentals",
  "advanced-ict-skills",
  "exploring-multiple-tracks",
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

// Type-level guard: every track card id must appear in TRACK_IDS (and vice versa).
type _TrackIdsMatch = Exclude<TrackId, (typeof TRACKS)[number]["id"]> extends never
  ? (typeof TRACKS)[number]["id"] extends TrackId
    ? true
    : never
  : never;
const _trackIdsCheck: _TrackIdsMatch = true;
void _trackIdsCheck;

export function trackLabel(id: string): string {
  return TRACKS.find((t) => t.id === id)?.label ?? id;
}

export const GRADE_LEVELS = [
  { id: "grade_11", label: "Grade 11" },
  { id: "grade_12", label: "Grade 12" },
  { id: "other", label: "Other / Not listed" },
] as const;

export const GRADE_LEVEL_IDS = ["grade_11", "grade_12", "other"] as const;
export type GradeLevelId = (typeof GRADE_LEVEL_IDS)[number];

const _gradeIdsCheck: Exclude<GradeLevelId, (typeof GRADE_LEVELS)[number]["id"]> extends never
  ? true
  : never = true;
void _gradeIdsCheck;

export function gradeLevelLabel(id: string): string {
  return GRADE_LEVELS.find((g) => g.id === id)?.label ?? id;
}

export const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "Beginner — little or no experience" },
  { id: "basic", label: "Basic knowledge" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

export const EXPERIENCE_LEVEL_IDS = ["beginner", "basic", "intermediate", "advanced"] as const;
export type ExperienceLevelId = (typeof EXPERIENCE_LEVEL_IDS)[number];

const _expIdsCheck: Exclude<ExperienceLevelId, (typeof EXPERIENCE_LEVELS)[number]["id"]> extends never
  ? true
  : never = true;
void _expIdsCheck;

export function experienceLevelLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return EXPERIENCE_LEVELS.find((e) => e.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Registration statuses
// ---------------------------------------------------------------------------

export const REGISTRATION_STATUSES = [
  { id: "pending_review", label: "Pending Review", active: true },
  { id: "approved", label: "Approved", active: true },
  { id: "waitlisted", label: "Waitlisted", active: true },
  { id: "declined", label: "Declined", active: false },
  { id: "cancelled", label: "Cancelled", active: false },
] as const;

export const STATUS_IDS = ["pending_review", "approved", "waitlisted", "declined", "cancelled"] as const;
export type StatusId = (typeof STATUS_IDS)[number];

const _statusIdsCheck: Exclude<StatusId, (typeof REGISTRATION_STATUSES)[number]["id"]> extends never
  ? true
  : never = true;
void _statusIdsCheck;

export function statusLabel(id: string): string {
  return REGISTRATION_STATUSES.find((s) => s.id === id)?.label ?? id;
}

/** Statuses considered "active" for duplicate-registration protection. */
export const ACTIVE_STATUSES = REGISTRATION_STATUSES.filter((s) => s.active).map((s) => s.id);

// ---------------------------------------------------------------------------
// Configurable program details
// ---------------------------------------------------------------------------

/** Convert "19:00" → "7:00 PM" for display; passes through unparseable values. */
export function formatClockTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const hour = Number(m[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m[2]} ${suffix}`;
}

export function getProgramConfig() {
  const env = getEnv();
  const tzLabel = env.PROGRAM_TIMEZONE === "Asia/Manila" ? "Philippine Time" : env.PROGRAM_TIMEZONE;
  return {
    schedule: env.PROGRAM_SCHEDULE,
    startTime: formatClockTime(env.PROGRAM_START_TIME),
    endTime: formatClockTime(env.PROGRAM_END_TIME),
    timezone: env.PROGRAM_TIMEZONE,
    timezoneLabel: tzLabel,
    scheduleLabel: `${env.PROGRAM_SCHEDULE} | ${formatClockTime(env.PROGRAM_START_TIME)}–${formatClockTime(env.PROGRAM_END_TIME)} ${tzLabel}`,
    platformLabel: "Online via Zoom / Group Call",
    sessionLengthNote:
      "Individual sessions may last approximately 30–60 minutes, depending on the topic and activities.",
    registrationOpen: env.REGISTRATION_OPEN,
    defaultStatus: env.REGISTRATION_STATUS_DEFAULT,
    /** Only surfaced when the organizers have confirmed and configured it. */
    startDate: env.PROGRAM_START_DATE || null,
    /** Only included in emails when confirmed and configured. */
    meetingUrl: env.PROGRAM_MEETING_URL || null,
    contactEmail: env.CONTACT_EMAIL || null,
  };
}

export type ProgramConfig = ReturnType<typeof getProgramConfig>;
