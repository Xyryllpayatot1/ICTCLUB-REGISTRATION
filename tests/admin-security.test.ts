import { describe, it, expect, beforeEach } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { login, patchStatus, getExport, postAnnouncement } from "./helpers/admin-requests";
import { createRegistration } from "@/lib/registration/service";
import { RegistrationSchema } from "@/lib/validation/schemas";
import { validRegistrationPayload } from "./helpers";

/**
 * Security tests for the admin surface:
 * - unauthenticated requests are rejected on every protected endpoint,
 * - CSRF is enforced on mutations,
 * - secrets and stack traces never appear in responses.
 */

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "correct-horse-battery-1";

let registrationId = "";

// tests/setup.ts clears all tables before every test, so the admin user and
// fixture registration must be recreated per test.
beforeEach(async () => {
  const prisma = getPrisma();
  await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      name: "Test Admin",
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    },
  });

  const parsed = RegistrationSchema.safeParse(validRegistrationPayload());
  if (!parsed.success) throw new Error("bad fixture");
  const created = await createRegistration(parsed.data);
  if (created.outcome !== "created") throw new Error("fixture registration failed");
  const row = await prisma.registration.findFirst({ where: { reference: created.reference } });
  registrationId = row!.id;
});

async function adminContext() {
  const session = await createSession(
    (await getPrisma().adminUser.findUnique({ where: { email: ADMIN_EMAIL } }))!.id,
  );
  return {
    cookies: { mrmnhs_admin_session: session.token, mrmnhs_csrf: session.csrfToken },
    headers: { "x-csrf-token": session.csrfToken },
  };
}

describe("admin authentication", () => {
  it("rejects login with wrong credentials and does not distinguish unknown accounts", async () => {
    const unknown = await login({ email: "nobody@example.com", password: "wrong-password-123" });
    const wrongPw = await login({ email: ADMIN_EMAIL, password: "wrong-password-123" });
    expect(unknown.status).toBe(401);
    expect(wrongPw.status).toBe(401);
    const a = await unknown.json();
    const b = await wrongPw.json();
    expect(a.error).toBe(b.error);
  });

  it("accepts valid credentials and sets HttpOnly, SameSite session cookies", async () => {
    const response = await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(response.status).toBe(200);
    const setCookies = response.headers.getSetCookie().join(" ; ");
    expect(setCookies).toContain("mrmnhs_admin_session=");
    expect(setCookies.toLowerCase()).toContain("httponly");
    expect(setCookies.toLowerCase()).toContain("samesite=lax");
    // The session token itself must never be readable from JS.
    expect(setCookies).toMatch(/mrmnhs_admin_session=[^;]+/);
  });

  it("does not reveal whether an email has an account", async () => {
    const response = await login({ email: "no-such-account@example.com", password: "whatever-12345" });
    expect(response.status).toBe(401);
  });
});

describe("authorization on protected endpoints", () => {
  it("rejects status changes without a session", async () => {
    const response = await patchStatus(registrationId, { status: "approved" });
    expect(response.status).toBe(401);
  });

  it("rejects status changes with a session but no CSRF token", async () => {
    const { cookies } = await adminContext();
    const response = await patchStatus(
      registrationId,
      { status: "approved" },
      { cookies },
    );
    expect(response.status).toBe(403);
    // Status must be unchanged.
    const row = await getPrisma().registration.findUnique({ where: { id: registrationId } });
    expect(row?.status).toBe("pending_review");
  });

  it("rejects status changes with a forged CSRF token", async () => {
    const { cookies } = await adminContext();
    const response = await patchStatus(
      registrationId,
      { status: "approved" },
      { cookies, headers: { "x-csrf-token": "forged-token" } },
    );
    expect(response.status).toBe(403);
  });

  it("rejects requests from a foreign origin", async () => {
    const ctx = await adminContext();
    const response = await patchStatus(
      registrationId,
      { status: "approved" },
      { ...ctx, headers: { ...ctx.headers, origin: "https://evil.example" } },
    );
    expect(response.status).toBe(403);
  });

  it("allows an authenticated, CSRF-valid status change and audits it", async () => {
    const ctx = await adminContext();
    const response = await patchStatus(registrationId, { status: "waitlisted", note: "Capacity" }, ctx);
    expect(response.status).toBe(200);
    const row = await getPrisma().registration.findUnique({ where: { id: registrationId } });
    expect(row?.status).toBe("waitlisted");

    const audit = await getPrisma().auditLog.findFirst({
      where: { action: "registration.status_change", actor: ADMIN_EMAIL },
    });
    expect(audit).not.toBeNull();
    expect(audit?.detail).toContain("waitlisted");
  });

  it("blocks CSV export without authentication", async () => {
    const response = await getExport();
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).not.toContain("reference"); // no CSV data leaks
  });

  it("allows export with a session and writes an audit entry", async () => {
    const ctx = await adminContext();
    const response = await getExport({}, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const csv = await response.text();
    expect(csv.split("\r\n")[0]).toContain("reference");
    expect(csv).toContain("juan@example.com"); // legitimate export contains data

    const audit = await getPrisma().auditLog.findFirst({ where: { action: "registration.export_csv" } });
    expect(audit).not.toBeNull();
  });

  it("blocks announcement sending without authentication", async () => {
    const response = await postAnnouncement({
      subject: "Hack",
      message: "Should never send",
      kind: "essential",
      statuses: ["approved"],
    });
    expect(response.status).toBe(401);
    expect(await getPrisma().announcementBatch.count()).toBe(0);
  });

  it("blocks announcement sending with session but no CSRF", async () => {
    const { cookies } = await adminContext();
    const response = await postAnnouncement(
      { subject: "Test", message: "A valid message body", kind: "essential", statuses: ["approved"] },
      { cookies },
    );
    expect(response.status).toBe(403);
    expect(await getPrisma().announcementBatch.count()).toBe(0);
  });

  it("never exposes the admin password hash or session token in API responses", async () => {
    const ctx = await adminContext();
    const response = await getExport({}, ctx);
    const raw = await response.text();
    expect(raw).not.toContain("scrypt$");
    expect(raw).not.toContain(ctx.cookies.mrmnhs_admin_session);
  });
});
