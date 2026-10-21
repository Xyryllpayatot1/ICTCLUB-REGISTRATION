import Link from "next/link";
import { listRegistrations, type ListQuery } from "@/lib/admin/registrations";
import {
  TRACKS,
  GRADE_LEVELS,
  REGISTRATION_STATUSES,
  trackLabel,
  gradeLevelLabel,
  statusLabel,
} from "@/lib/config/program";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";

export const metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { id: "created_desc", label: "Newest first" },
  { id: "created_asc", label: "Oldest first" },
  { id: "name_asc", label: "Name A–Z" },
  { id: "name_desc", label: "Name Z–A" },
] as const;

function buildHref(query: ListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.status) params.set("status", query.status);
  if (query.track) params.set("track", query.track);
  if (query.gradeLevel) params.set("gradeLevel", query.gradeLevel);
  if (query.sort && query.sort !== "created_desc") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const query: ListQuery = {
    search: str(sp.q),
    status: str(sp.status),
    track: str(sp.track),
    gradeLevel: str(sp.gradeLevel),
    sort: (str(sp.sort) as ListQuery["sort"]) ?? "created_desc",
    page: Number(str(sp.page) ?? "1") || 1,
    pageSize: 20,
  };

  const result = await listRegistrations(query);
  const exportParams = new URLSearchParams();
  if (query.status) exportParams.set("status", query.status);
  if (query.track) exportParams.set("track", query.track);
  if (query.gradeLevel) exportParams.set("gradeLevel", query.gradeLevel);
  const exportHref = `/api/admin/registrations/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Registrations</h1>
        <a
          href={exportHref}
          className="inline-flex items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
        >
          Export CSV ({result.total})
        </a>
      </div>

      {/* Filters — plain GET form: works with and without JavaScript */}
      <form method="get" action="/admin/registrations" className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-600">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.search ?? ""}
              placeholder="Name or reference"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={query.status ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              {REGISTRATION_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="track" className="mb-1 block text-xs font-medium text-slate-600">
              Learning track
            </label>
            <select
              id="track"
              name="track"
              defaultValue={query.track ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            >
              <option value="">All tracks</option>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gradeLevel" className="mb-1 block text-xs font-medium text-slate-600">
              Grade level
            </label>
            <select
              id="gradeLevel"
              name="gradeLevel"
              defaultValue={query.gradeLevel ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            >
              <option value="">All grades</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-1 block text-xs font-medium text-slate-600">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={query.sort}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Apply filters
          </button>
          <Link
            href="/admin/registrations"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Reference</th>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Grade</th>
                <th scope="col" className="px-4 py-3">Track</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No registrations match the current filters.
                  </td>
                </tr>
              ) : (
                result.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 code-decoration text-xs font-semibold text-navy-700">
                      <Link href={`/admin/registrations/${r.id}`} className="underline-offset-2 hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/registrations/${r.id}`}
                        className="font-medium text-navy-900 underline-offset-2 hover:underline"
                      >
                        {r.fullName}
                      </Link>
                      {r.preferredName ? (
                        <span className="block text-xs text-slate-500">“{r.preferredName}”</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{gradeLevelLabel(r.gradeLevel)}</td>
                    <td className="px-4 py-3 text-slate-600">{trackLabel(r.track)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} label={statusLabel(r.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${r.confirmationEmailStatus === "failed" ? "font-semibold text-rose-600" : "text-slate-500"}`}
                        title={`Confirmation email: ${r.confirmationEmailStatus}`}
                      >
                        {r.confirmationEmailStatus === "accepted"
                          ? "Sent"
                          : r.confirmationEmailStatus === "failed"
                            ? "Email failed"
                            : r.confirmationEmailStatus === "queued"
                              ? "Queued"
                              : r.confirmationEmailStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Page {result.page} of {result.pageCount} · {result.total} total
          </p>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link
                href={buildHref(query, result.page - 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Previous
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={buildHref(query, result.page + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
