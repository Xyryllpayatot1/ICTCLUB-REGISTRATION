import Link from "next/link";
import { getDashboardStats } from "@/lib/admin/registrations";
import { TRACKS, trackLabel, statusLabel } from "@/lib/config/program";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";

export const metadata = { title: "Admin overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getDashboardStats();

  const cards = [
    { label: "Total registrations", value: stats.total },
    { label: "Pending review", value: stats.byStatus.pending_review ?? 0 },
    { label: "Approved", value: stats.byStatus.approved ?? 0 },
    { label: "Waitlisted", value: stats.byStatus.waitlisted ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-navy-900">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-navy-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-navy-900">Registrations by learning track</h2>
          <ul className="mt-4 space-y-3">
            {TRACKS.map((track) => {
              const count = stats.byTrack[track.id] ?? 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <li key={track.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-navy-700">{track.label}</span>
                    <span className="font-medium text-navy-900">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-navy-600"
                      style={{ width: `${pct}%` }}
                      role="presentation"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-navy-900">Email delivery</h2>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.email.accepted}</p>
              <p className="mt-1 text-xs text-slate-500">Accepted by provider</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{stats.email.queued}</p>
              <p className="mt-1 text-xs text-slate-500">Queued</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{stats.email.failed}</p>
              <p className="mt-1 text-xs text-slate-500">Failed</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            “Accepted” means the provider accepted the message; it is not confirmation of delivery.
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Recent registrations</h2>
          <Link href="/admin/registrations" className="text-sm text-navy-600 underline hover:text-navy-900">
            View all
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No registrations yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {stats.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <Link
                    href={`/admin/registrations/${r.id}`}
                    className="text-sm font-medium text-navy-900 underline-offset-2 hover:underline"
                  >
                    {r.fullName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {r.reference} · {trackLabel(r.track)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</span>
                  <StatusBadge status={r.status} label={statusLabel(r.status)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
