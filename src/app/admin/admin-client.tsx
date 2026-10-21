"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

async function readCsrfToken(): Promise<string> {
  const match = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("mrmnhs_csrf="));
  return match ? decodeURIComponent(match.slice("mrmnhs_csrf=".length)) : "";
}

/** Shared client helper for state-changing admin requests (CSRF header). */
export async function adminFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const csrf = await readCsrfToken();
  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
      ...(init.headers ?? {}),
    },
  });
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="ghost"
      className="px-3 py-1.5 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await adminFetch("/api/admin/logout", { method: "POST" });
        } finally {
          setBusy(false);
          router.push("/admin/login");
          router.refresh();
        }
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
