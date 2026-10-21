"use client";

import { useEffect, useState } from "react";
import { trackLabel } from "@/lib/config/program";

const STORAGE_KEY = "mrmnhs_registration";

interface StoredRegistration {
  reference?: string;
  track?: string;
  at?: number;
}

/**
 * Renders the registration reference and track from sessionStorage.
 * Keeping it out of the URL avoids leaking it via server logs, analytics, or
 * referrer headers. Falls back to email instructions when unavailable.
 */
export function RegistrationSummaryClient() {
  const [stored, setStored] = useState<StoredRegistration | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredRegistration;
      // Discard entries older than 24h to avoid showing stale references.
      if (parsed?.reference && typeof parsed.at === "number" && Date.now() - parsed.at < 86_400_000) {
        setStored(parsed);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-navy-100 bg-navy-50/70 p-5">
      <dl className="space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-navy-600">Registration reference</dt>
          <dd className="code-decoration font-bold text-navy-900" data-testid="registration-reference">
            {stored?.reference ?? "—"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-navy-600">Learning track</dt>
          <dd className="font-medium text-navy-900">
            {stored?.track ? trackLabel(stored.track) : "—"}
          </dd>
        </div>
      </dl>
      {stored?.reference ? (
        <p className="mt-3 text-xs text-navy-500">
          Save this reference — it identifies your registration. A copy was also sent to your
          email.
        </p>
      ) : (
        <p className="mt-3 text-xs text-navy-500">
          Your registration was received. The reference is in the confirmation email sent to your
          inbox.
        </p>
      )}
    </div>
  );
}
