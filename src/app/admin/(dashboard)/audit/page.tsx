import { getPrisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const prisma = getPrisma();

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Administrative actions: status changes, exports, announcements, email retries, and sign-ins.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">When</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Actor</th>
                <th scope="col" className="px-4 py-3">Target</th>
                <th scope="col" className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 code-decoration text-xs font-semibold text-navy-800">
                      {e.action}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-900">{e.actor}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {e.targetType ? `${e.targetType}` : "—"}
                      {e.targetId ? (
                        <span className="block code-decoration text-[10px] text-slate-400">
                          {e.targetId.slice(0, 10)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-md px-4 py-3 code-decoration text-[11px] text-slate-500">
                      {e.detail ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <a
                href={`/admin/audit?page=${page - 1}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Previous
              </a>
            ) : null}
            {page < pageCount ? (
              <a
                href={`/admin/audit?page=${page + 1}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Next
              </a>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
