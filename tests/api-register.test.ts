import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/register/route";
import { getPrisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { makeRequest, validRegistrationPayload } from "./helpers";

const URL = "http://localhost:3000/api/register";

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    makeRequest(URL, { method: "POST", body: JSON.stringify(body), headers: { ...headers, "x-forwarded-for": "10.0.0.1" } }),
  );
}

describe("POST /api/register", () => {
  it("accepts a valid registration and returns the reference", async () => {
    const response = await post(validRegistrationPayload());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.outcome).toBe("created");
    expect(data.reference).toMatch(/^MRMNHS-[0-9A-HJKMNP-TV-Z]{8}$/);

    const prisma = getPrisma();
    const row = await prisma.registration.findFirst({ where: { reference: data.reference } });
    expect(row).not.toBeNull();
  });

  it("does not leak the internal database id or email into the response", async () => {
    const response = await post(validRegistrationPayload());
    const raw = await response.text();
    expect(raw).not.toContain('"id"');
    expect(raw).not.toContain("juan@example.com"); // response echoes nothing personal
    expect(raw).not.toMatch(/Prisma|Error:/);
  });

  it("rejects missing required fields with per-field errors (server-side)", async () => {
    const response = await post({ essentialConsent: true });
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.fieldErrors.fullName).toBeTruthy();
    expect(data.fieldErrors.email).toBeTruthy();
    expect(data.fieldErrors.track).toBeTruthy();
    expect(await getPrisma().registration.count()).toBe(0);
  });

  it("rejects an invalid email independently of the client", async () => {
    const response = await post(validRegistrationPayload({ email: "bad-address" }));
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.fieldErrors.email).toMatch(/valid email/i);
  });

  it("rejects an invalid learning track", async () => {
    const response = await post(validRegistrationPayload({ track: "underwater basket weaving" }));
    expect(response.status).toBe(422);
    expect((await response.json()).fieldErrors.track).toBeTruthy();
  });

  it("returns a generic duplicate response without revealing the existing reference", async () => {
    await post(validRegistrationPayload());
    const response = await post(validRegistrationPayload({ idempotencyKey: undefined }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.outcome).toBe("duplicate");
    expect(data.reference).toBeUndefined();
    expect(data.message).toMatch(/already been received/i);
    expect(await getPrisma().registration.count()).toBe(1);
  });

  it("handles double submissions via idempotency key (no duplicate rows)", async () => {
    const key = crypto.randomUUID();
    const first = await post(validRegistrationPayload({ idempotencyKey: key }));
    const second = await post(validRegistrationPayload({ idempotencyKey: key }));
    const a = await first.json();
    const b = await second.json();
    expect(a.outcome).toBe("created");
    expect(b.outcome).toBe("idempotent_replay");
    expect(b.reference).toBe(a.reference);
    expect(await getPrisma().registration.count()).toBe(1);
  });

  it("silently discards honeypot submissions without storing data", async () => {
    const response = await post(validRegistrationPayload({ website: "http://spam.example" }));
    expect(response.status).toBe(200);
    expect(await getPrisma().registration.count()).toBe(0);
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    for (let i = 0; i < RATE_LIMITS.register.limit; i++) {
      const key = crypto.randomUUID();
      await post(validRegistrationPayload({ email: `s${i}@example.com`, idempotencyKey: key }));
    }
    const response = await post(validRegistrationPayload({ email: "one-more@example.com" }));
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("rate limiter allows different IPs independently", async () => {
    for (let i = 0; i < RATE_LIMITS.register.limit; i++) {
      await post(validRegistrationPayload({ email: `a${i}@example.com` }));
    }
    const otherIp = makeRequest(URL, {
      method: "POST",
      body: JSON.stringify(validRegistrationPayload({ email: "other@example.com" })),
      headers: { "x-forwarded-for": "10.9.9.9" },
    });
    const response = await POST(otherIp);
    expect(response.status).toBe(200);
  });

  it("database failure returns an error and never a false success", async () => {
    const prisma = getPrisma();
    const spy = vi.spyOn(prisma.registration, "create").mockRejectedValueOnce(new Error("db down"));

    const response = await post(validRegistrationPayload({ email: "fail@example.com" }));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.reference).toBeUndefined();
    // The error must not leak internals.
    expect(JSON.stringify(data)).not.toMatch(/db down|stack|prisma/i);

    spy.mockRestore();
  });

  it("rejects malformed JSON bodies", async () => {
    const request = new Request(URL, {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("does not log personal data on the happy path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await post(validRegistrationPayload({ email: "quiet@example.com", fullName: "Quiet Person" }));

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .map((c) => c.map(String).join(" "))
      .join(" ");
    expect(logged).not.toContain("quiet@example.com");
    expect(logged).not.toContain("Quiet Person");

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// Keep the rate-limit import referenced (guards against accidental tree-shaking of the test).
void rateLimit;
