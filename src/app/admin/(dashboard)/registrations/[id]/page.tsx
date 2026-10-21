import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db/prisma";
import {
  trackLabel,
  gradeLevelLabel,
  experienceLevelLabel,
  statusLabel,
} from "@/lib/config/program";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { RegistrationActions, EmailRetryButton } from "./actions";

export const metadata = { title: "Registration detail" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-navy-900">{value}</dd>
    </div>
  );
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prisma = getPrisma();

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      emailJobs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/registrations" className="text-sm text-navy-600 underline hover:text-navy-900">
            ← Back to registrations
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">{registration.fullName}</h1>
          <p className="code-decoration text-sm text-navy-600">{registration.reference}</p>
        </div>
        <StatusBadge status={registration.status} label={statusLabel(registration.status)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-navy-900">Registration details</h2>
          <dl className="mt-3">
            <Row label="Full name" value={registration.fullName} />
            <Row
              label="Preferred name"
              value={registration.preferredName ?? <span className="text-slate-400">—</span>}
            />
            <Row label="Email" value={registration.email} />
            <Row label="Grade level" value={gradeLevelLabel(registration.gradeLevel)} />
            <Row
              label="Section"
              value={registration.section ?? <span className="text-slate-400">—</span>}
            />
            <Row label="Learning track" value={trackLabel(registration.track)} />
            <Row label="Experience" value={experienceLevelLabel(registration.experienceLevel)} />
            <Row
              label="Learning goals"
              value={
                registration.learningGoals ?? <span className="text-slate-400">—</span>
              }
            />
            <Row
              label="Other interests"
              value={
                registration.additionalInterests ?? <span className="text-slate-400">—</span>
              }
            />
            <Row
              label="Essential consent"
              value={`Yes — ${formatDateTime(registration.essentialConsentAt)}`}
            />
            <Row
              label="Marketing consent"
              value={
                registration.marketingConsent ? (
                  `Yes — ${formatDateTime(registration.marketingConsentAt)}`
                ) : (
                  <span className="text-slate-400">No</span>
                )
              }
            />
            <Row label="Registered" value={formatDateTime(registration.createdAt)} />
            <Row label="Last updated" value={formatDateTime(registration.updatedAt)} />
          </dl>
        </section>

        <div className="space-y-6">
          <RegistrationActions
            registrationId={registration.id}
            currentStatus={registration.status}
            currentNote={registration.adminNotes}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-navy-900">Email history</h2>
            {registration.emailJobs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No emails queued for this registration.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {registration.emailJobs.map((job) => (
                  <li key={job.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy-900">
                        {job.kind}{" "}
                        <span
                          className={`ml-1 text-xs font-normal ${
                            job.status === "failed"
                              ? "text-rose-600"
                              : job.status === "accepted" || job.status === "delivered"
                                ? "text-emerald-600"
                                : "text-amber-600"
                          }`}
                        >
                          {job.status === "accepted" && job.provider === "dev-outbox"
                            ? "accepted (dev outbox — NOT delivered)"
                            : job.status}
                        </span>
                      </p>
                      {job.status === "failed" ? <EmailRetryButton jobId={job.id} /> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {job.subject} · attempts {job.attempts}/{job.maxAttempts}
                      {job.providerMessageId ? ` · id ${job.providerMessageId.slice(0, 12)}…` : ""}
                    </p>
                    {job.lastError ? (
                      <p className="mt-1 text-xs text-rose-600">
                        {job.lastError} ({job.lastErrorCode ?? "error"})
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-400">Updated {formatDateTime(job.updatedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
