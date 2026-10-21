import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { ACTIVE_STATUSES, STATUS_IDS, TRACK_IDS, GRADE_LEVEL_IDS } from "@/lib/config/program";

/** True when the configured database is PostgreSQL (production). */
function isPostgres(): boolean {
  try {
    return getEnv().DATABASE_URL.startsWith("postgres");
  } catch {
    return false;
  }
}

/**
 * Admin-side registration queries: list/search/filter/sort/paginate, stats,
 * and CSV export. All queries are built through Prisma's typed API (parameterized
 * under the hood — no string-built SQL).
 */

export interface ListQuery {
  search?: string;
  status?: string;
  track?: string;
  gradeLevel?: string;
  sort?: "created_desc" | "created_asc" | "name_asc" | "name_desc";
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function buildWhere(q: ListQuery): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = {};
  if (q.status && STATUS_IDS.includes(q.status as (typeof STATUS_IDS)[number])) {
    where.status = q.status;
  }
  if (q.track && TRACK_IDS.includes(q.track as (typeof TRACK_IDS)[number])) {
    where.track = q.track;
  }
  if (q.gradeLevel && GRADE_LEVEL_IDS.includes(q.gradeLevel as (typeof GRADE_LEVEL_IDS)[number])) {
    where.gradeLevel = q.gradeLevel;
  }
  if (q.search && q.search.trim() !== "") {
    const term = q.search.trim();
    // SQLite has no case-sensitive mode flag (LIKE is ASCII-insensitive there);
    // PostgreSQL supports explicit case-insensitive matching.
    const insensitive = isPostgres();
    where.OR = [
      { fullName: { contains: term, ...(insensitive ? { mode: "insensitive" as const } : {}) } },
      { preferredName: { contains: term, ...(insensitive ? { mode: "insensitive" as const } : {}) } },
      { reference: { contains: term, ...(insensitive ? { mode: "insensitive" as const } : {}) } },
      { email: { contains: term, ...(insensitive ? { mode: "insensitive" as const } : {}) } },
    ];
  }
  return where;
}

const SORT_MAP = {
  created_desc: { createdAt: "desc" },
  created_asc: { createdAt: "asc" },
  name_asc: { fullName: "asc" },
  name_desc: { fullName: "desc" },
} as const;

export async function listRegistrations(q: ListQuery): Promise<
  ListResult<{
    id: string;
    reference: string;
    fullName: string;
    preferredName: string | null;
    email: string;
    gradeLevel: string;
    section: string | null;
    track: string;
    experienceLevel: string | null;
    status: string;
    confirmationEmailStatus: string;
    createdAt: Date;
  }>
> {
  const prisma = getPrisma();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const where = buildWhere(q);
  const orderBy = SORT_MAP[q.sort ?? "created_desc"];

  const [items, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        fullName: true,
        preferredName: true,
        email: true,
        gradeLevel: true,
        section: true,
        track: true,
        experienceLevel: true,
        status: true,
        confirmationEmailStatus: true,
        createdAt: true,
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byTrack: Record<string, number>;
  recent: Array<{
    id: string;
    reference: string;
    fullName: string;
    track: string;
    status: string;
    createdAt: Date;
  }>;
  email: {
    accepted: number;
    failed: number;
    queued: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const prisma = getPrisma();

  const [total, statusGroups, trackGroups, recent, emailGroups] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.registration.groupBy({ by: ["track"], _count: { _all: true } }),
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        reference: true,
        fullName: true,
        track: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.emailJob.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const s of STATUS_IDS) byStatus[s] = 0;
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  const byTrack: Record<string, number> = {};
  for (const t of TRACK_IDS) byTrack[t] = 0;
  for (const g of trackGroups) byTrack[g.track] = g._count._all;

  const email = { accepted: 0, failed: 0, queued: 0 };
  for (const g of emailGroups) {
    if (g.status === "accepted" || g.status === "delivered") email.accepted += g._count._all;
    else if (g.status === "failed") email.failed += g._count._all;
    else if (g.status === "queued" || g.status === "processing") email.queued += g._count._all;
  }

  return { total, byStatus, byTrack, recent, email };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const EXPORT_COLUMNS = [
  "reference",
  "full_name",
  "preferred_name",
  "email",
  "grade_level",
  "section",
  "track",
  "experience_level",
  "learning_goals",
  "additional_interests",
  "status",
  "confirmation_email_status",
  "essential_consent_at",
  "marketing_consent",
  "registered_at",
] as const;

function csvEscape(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replaceAll('"', '""')}"`;
  }
  return v;
}

export async function exportRegistrationsCsv(opts: {
  status?: string;
  track?: string;
  gradeLevel?: string;
}): Promise<string> {
  const prisma = getPrisma();
  const rows = await prisma.registration.findMany({
    where: buildWhere(opts),
    orderBy: { createdAt: "asc" },
    select: {
      reference: true,
      fullName: true,
      preferredName: true,
      email: true,
      gradeLevel: true,
      section: true,
      track: true,
      experienceLevel: true,
      learningGoals: true,
      additionalInterests: true,
      status: true,
      confirmationEmailStatus: true,
      essentialConsentAt: true,
      marketingConsent: true,
      createdAt: true,
    },
  });

  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        r.fullName,
        r.preferredName,
        r.email,
        r.gradeLevel,
        r.section,
        r.track,
        r.experienceLevel,
        r.learningGoals,
        r.additionalInterests,
        r.status,
        r.confirmationEmailStatus,
        r.essentialConsentAt.toISOString(),
        r.marketingConsent ? "yes" : "no",
        r.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export { ACTIVE_STATUSES };
