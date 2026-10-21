"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { adminFetch } from "@/app/admin/admin-client";
import { REGISTRATION_STATUSES } from "@/lib/config/program";

/**
 * Status change + admin note forms for a registration detail page.
 * Each action carries a per-click idempotency token so double-clicks or
 * network retries cannot trigger duplicate emails or duplicate transitions.
 */
export function RegistrationActions({
  registrationId,
  currentStatus,
  currentNote,
}: {
  registrationId: string;
  currentStatus: string;
  currentNote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState(currentNote ?? "");
  const [busy, setBusy] = useState<"status" | "note" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const transitionToken = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";

  async function saveStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("status");
    setMessage(null);
    try {
      const response = await adminFetch(`/api/admin/registrations/${registrationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note: note.trim() || undefined,
          transitionId: transitionToken(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ kind: "error", text: data.error ?? "Failed to update status." });
        return;
      }
      setMessage({ kind: "ok", text: "Status updated. Any notification email has been queued." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error — status not changed." });
    } finally {
      setBusy(null);
    }
  }

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("note");
    setMessage(null);
    try {
      const response = await adminFetch(`/api/admin/registrations/${registrationId}/note`, {
        method: "PATCH",
        body: JSON.stringify({ note }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ kind: "error", text: data.error ?? "Failed to save note." });
        return;
      }
      setMessage({ kind: "ok", text: "Internal note saved." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error — note not saved." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          role="status"
          className={
            message.kind === "ok"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          }
        >
          {message.text}
        </p>
      ) : null}

      <form onSubmit={saveStatus} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">Registration status</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="status-select" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
              disabled={busy !== null}
            >
              {REGISTRATION_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={busy !== null || status === currentStatus}
          >
            {busy === "status" ? "Saving…" : "Save status"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Changing to Approved, Waitlisted, Declined, or Cancelled queues the matching notification
          email (Pending Review sends none).
        </p>
      </form>

      <form onSubmit={saveNote} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">Internal note</h2>
        <label htmlFor="admin-note" className="sr-only">
          Internal administrative note
        </label>
        <textarea
          id="admin-note"
          rows={4}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Visible to administrators only. Never included in student-facing emails."
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
          disabled={busy !== null}
        />
        <div className="mt-3">
          <Button type="submit" variant="ghost" disabled={busy !== null}>
            {busy === "note" ? "Saving…" : "Save note"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Retry button for a failed email job on the detail page. */
export function EmailRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="ghost"
        className="px-2.5 py-1 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await adminFetch(`/api/admin/emails/${jobId}/retry`, { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
              setError(data.error ?? "Retry failed.");
              return;
            }
            router.refresh();
          } catch {
            setError("Network error.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying…" : "Retry"}
      </Button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}
