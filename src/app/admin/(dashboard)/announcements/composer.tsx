"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { adminFetch } from "@/app/admin/admin-client";
import { ACTIVE_STATUSES, REGISTRATION_STATUSES } from "@/lib/config/program";

/**
 * Announcement composer + live progress.
 *
 * Flow: compose → preview (recipient count + sample) → explicit confirmation →
 * send → poll progress. Retry is offered for failed deliveries.
 */

interface Preview {
  recipientCount: number;
  capped: boolean;
  sampleRecipients: Array<{ reference: string; displayName: string; track: string; gradeLevel: string }>;
}

interface Progress {
  batch: {
    id: string;
    subject: string;
    status: string;
    totalRecipients: number;
    acceptedCount: number;
    failedCount: number;
    sentCount: number;
  };
  failures: Array<{ id: string; toEmail: string; lastError: string | null }>;
}

export function AnnouncementComposer() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"essential" | "marketing">("essential");
  // Default to every active status so the audience is never empty just because
  // no registration has been approved yet (registrations usually start as
  // "pending_review"). Admins can still narrow the audience explicitly.
  const [statuses, setStatuses] = useState<string[]>([...ACTIVE_STATUSES]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setPreview(null);
    setConfirming(false);
    setStatuses((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const loadPreview = useCallback(async () => {
    setBusy("preview");
    setError(null);
    try {
      const response = await adminFetch("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({ preview: true, subject, message, kind, statuses }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; preview?: Preview };
      if (!response.ok) {
        setError(data.error ?? "Could not load preview.");
        return;
      }
      setPreview(data.preview ?? null);
    } catch {
      setError("Network error — preview not loaded.");
    } finally {
      setBusy(null);
    }
  }, [subject, message, kind, statuses]);

  const send = useCallback(async () => {
    setBusy("send");
    setError(null);
    try {
      const response = await adminFetch("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({ subject, message, kind, statuses }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        batchId?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not send announcement.");
        setConfirming(false);
        return;
      }
      setActiveBatchId(data.batchId ?? null);
      setConfirming(false);
      setPreview(null);
      setSubject("");
      setMessage("");
    } catch {
      setError("Network error — announcement not sent.");
    } finally {
      setBusy(null);
    }
  }, [subject, message, kind, statuses]);

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void loadPreview();
        }}
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-base font-semibold text-navy-900">Compose announcement</h2>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-navy-800">Audience</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {REGISTRATION_STATUSES.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-navy-700">
                <input
                  type="checkbox"
                  checked={statuses.includes(s.id)}
                  onChange={() => toggleStatus(s.id)}
                  className="h-4 w-4 accent-navy-800"
                />
                {s.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Declined and cancelled registrations are excluded from marketing announcements
            automatically. All recipients must have given essential-communications consent.
          </p>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-navy-800">Type</legend>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input
                type="radio"
                name="kind"
                checked={kind === "essential"}
                onChange={() => {
                  setKind("essential");
                  setPreview(null);
                }}
                className="accent-navy-800"
              />
              Essential program update
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-700">
              <input
                type="radio"
                name="kind"
                checked={kind === "marketing"}
                onChange={() => {
                  setKind("marketing");
                  setPreview(null);
                }}
                className="accent-navy-800"
              />
              Optional announcement (opted-in only)
            </label>
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="ann-subject" className="mb-1.5 block text-sm font-medium text-navy-800">
            Subject
          </label>
          <input
            id="ann-subject"
            type="text"
            maxLength={150}
            required
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPreview(null);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="ann-message" className="mb-1.5 block text-sm font-medium text-navy-800">
            Message
          </label>
          <textarea
            id="ann-message"
            rows={6}
            maxLength={5000}
            required
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setPreview(null);
            }}
            placeholder={"Write the announcement in plain text.\n\nUse a blank line between paragraphs."}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none"
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {preview ? (
          preview.recipientCount === 0 ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
            >
              <p className="text-sm font-semibold text-amber-900">No eligible recipients yet</p>
              <p className="mt-1 text-xs text-amber-800">
                No registration matches the selected audience. Tick additional statuses above
                (for example <strong>Pending Review</strong>, where new registrations usually
                start) — recipients must also have given essential-communications consent.
                Nothing has been sent.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">
                This announcement will be sent to {preview.recipientCount} recipient
                {preview.recipientCount === 1 ? "" : "s"}.
              </p>
              {preview.capped ? (
                <p className="mt-1 text-xs text-sky-800">
                  Audience exceeds the per-send limit; narrow the selection.
                </p>
              ) : null}
              {preview.sampleRecipients.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-sky-800">
                  {preview.sampleRecipients.map((r) => (
                    <li key={r.reference}>
                      {r.reference} — {r.displayName} ({r.track})
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" variant="ghost" disabled={busy !== null || !subject || !message}>
            {busy === "preview" ? "Loading preview…" : "Preview audience"}
          </Button>
          {preview && preview.recipientCount > 0 ? (
            confirming ? (
              <>
                <Button type="button" disabled={busy !== null} onClick={() => void send()}>
                  {busy === "send" ? "Sending…" : `Yes, send to ${preview.recipientCount} recipients`}
                </Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" disabled={busy !== null} onClick={() => setConfirming(true)}>
                Send announcement…
              </Button>
            )
          ) : null}
        </div>
      </form>

      {activeBatchId ? <AnnouncementProgress batchId={activeBatchId} /> : null}
    </div>
  );
}

/** Polls a batch until it finishes, showing accepted/failed counts. */
export function AnnouncementProgress({ batchId }: { batchId: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [retrying, setRetrying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const response = await adminFetch(`/api/admin/announcements/${batchId}`, { method: "GET" });
      if (!response.ok) return;
      const data = (await response.json()) as { batch?: Progress["batch"]; failures?: Progress["failures"] };
      if (data.batch) {
        setProgress({ batch: data.batch, failures: data.failures ?? [] });
      }
    } catch {
      /* transient */
    }
  }, [batchId]);

  useEffect(() => {
    void poll();
    timer.current = setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [poll]);

  if (!progress) return <p className="text-sm text-slate-500">Loading send progress…</p>;

  const { batch, failures } = progress;
  const done = batch.status !== "sending";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6" aria-live="polite">
      <h2 className="text-base font-semibold text-navy-900">Send progress — {batch.subject}</h2>
      <div className="mt-3 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-emerald-600">{batch.acceptedCount}</p>
          <p className="text-xs text-slate-500">Accepted</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-rose-600">{batch.failedCount}</p>
          <p className="text-xs text-slate-500">Failed</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-navy-700">{batch.totalRecipients}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Status: <strong>{batch.status}</strong>
        {!done ? " — sending continues in the background; this page refreshes automatically." : ""}
      </p>

      {failures.length > 0 ? (
        <div className="mt-4">
          <ul className="space-y-1 text-xs text-rose-700">
            {failures.map((f) => (
              <li key={f.id}>
                {f.toEmail} — {f.lastError ?? "failed"}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  await adminFetch(`/api/admin/announcements/${batchId}/retry`, { method: "POST" });
                  await poll();
                } finally {
                  setRetrying(false);
                }
              }}
            >
              {retrying ? "Retrying…" : `Retry ${failures.length} failed`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
