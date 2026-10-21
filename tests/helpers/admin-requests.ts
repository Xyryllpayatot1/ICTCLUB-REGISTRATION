import { makeRequest } from "../helpers";

/** Thin wrappers around admin route handlers for tests. */

const BASE = "http://localhost:3000";

export interface ReqCtx {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

export function login(body: { email: string; password: string }) {
  // Imported lazily so each test file only loads what it needs.
  return import("@/app/api/admin/login/route").then(({ POST }) =>
    POST(
      makeRequest(`${BASE}/api/admin/login`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { origin: "http://localhost:3000" },
      }),
    ),
  );
}

export function patchStatus(id: string, body: unknown, ctx: ReqCtx = {}) {
  return import("@/app/api/admin/registrations/[id]/status/route").then(({ PATCH }) =>
    PATCH(
      makeRequest(`${BASE}/api/admin/registrations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { origin: "http://localhost:3000", ...ctx.headers },
        cookies: ctx.cookies,
      }),
      { params: Promise.resolve({ id }) },
    ),
  );
}

export function getExport(query: Record<string, string> = {}, ctx: ReqCtx = {}) {
  const qs = new URLSearchParams(query).toString();
  return import("@/app/api/admin/registrations/export/route").then(({ GET }) =>
    GET(
      makeRequest(`${BASE}/api/admin/registrations/export${qs ? `?${qs}` : ""}`, {
        headers: { origin: "http://localhost:3000", ...ctx.headers },
        cookies: ctx.cookies,
      }),
    ),
  );
}

export function postAnnouncement(body: unknown, ctx: ReqCtx = {}) {
  return import("@/app/api/admin/announcements/route").then(({ POST }) =>
    POST(
      makeRequest(`${BASE}/api/admin/announcements`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { origin: "http://localhost:3000", ...ctx.headers },
        cookies: ctx.cookies,
      }),
    ),
  );
}

export function retryEmail(jobId: string, ctx: ReqCtx = {}) {
  return import("@/app/api/admin/emails/[jobId]/retry/route").then(({ POST }) =>
    POST(
      makeRequest(`${BASE}/api/admin/emails/${jobId}/retry`, {
        method: "POST",
        body: "{}",
        headers: { origin: "http://localhost:3000", ...ctx.headers },
        cookies: ctx.cookies,
      }),
      { params: Promise.resolve({ jobId }) },
    ),
  );
}
