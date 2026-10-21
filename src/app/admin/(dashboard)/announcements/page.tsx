import { listAnnouncementBatches } from "@/lib/admin/announcements";
import { formatDateTime } from "@/lib/utils";
import { AnnouncementComposer, AnnouncementProgress } from "./composer";

export const metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const batches = await listAnnouncementBatches();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Announcements</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send essential program updates or opted-in announcements. Every send is audited, bounded
          by recipient limits, and retried automatically on transient failures.
        </p>
      </div>

      <AnnouncementComposer />

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-navy-900">Recent announcements</h2>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No announcements sent yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {batches.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy-900">{b.subject}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : b.status === "sending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {b.createdByEmail} · {formatDateTime(b.createdAt)} · {b.sentCount}/
                  {b.totalRecipients} accepted · {b.failedCount} failed · audience: {b.audience}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {batches.some((b) => b.status === "sending") ? (
        <AnnouncementProgress batchId={batches.find((b) => b.status === "sending")!.id} />
      ) : null}
    </div>
  );
}
