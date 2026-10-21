# Implementation Report

MRMNHS ICT Club Teaching Program — Registration Funnel & Management Platform

## 1. Scope and goals

A complete registration funnel (landing → validated form → success → confirmation email)
plus an admin dashboard (auth, registration management, CSV export, announcements, audit
log), built to production standards for a program whose participants are largely minors.

Two constraints shaped many decisions:

1. **Honesty about unconfirmed program details.** Start dates, deadlines, meeting links,
   instructor names, and contact info are *configuration*, never hardcoded guesses. The
   site and emails hide anything not explicitly configured.
2. **Minor-student privacy.** Essential and optional consent are separated, no PII
   appears in URLs/logs/client bundles, and the privacy notice states the school's
   obligations rather than inventing legal claims.

## 2. Technology stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server components, route handlers, middleware; single codebase for funnel + API + admin |
| Language | TypeScript 5.9 (strict) | End-to-end type safety across schema → validation → UI |
| Database | Prisma 6; SQLite dev, PostgreSQL prod | Zero-setup development, real relational durability in production |
| Validation | Zod 4 (shared client + server) | One source of truth; server always authoritative |
| Styling | Tailwind CSS 4 | Design-token-driven navy/white/yellow system, zero runtime CSS-in-JS |
| Auth | Custom server-side sessions + scrypt | Full control over cookies, CSRF, rate limiting; no third-party dependency for a school deployment |
| Email | Pluggable provider (Gmail SMTP / Resend / dev-outbox) | Real delivery in production; honest simulation in dev |
| Tests | Vitest 5 + Testing Library (jsdom) | Fast unit/integration coverage of every layer |

## 3. Architecture

```
Public funnel                         Admin surface                      Operations
──────────────                        ─────────────                      ──────────
/  (landing)                          /admin/login                       /api/health
/register (form section)              /admin (overview)                  /api/cron/email-worker
/register/success                     /admin/registrations[...]          scripts/email:process
/privacy                              /admin/announcements
                                     /admin/audit
        │                                     │
        └──────────── /api/register ──────────┴── /api/admin/* ──────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │  src/lib domain modules    │
                       │  registration · auth ·     │
                       │  email · admin · security  │
                       └─────────────┬─────────────┘
                             Prisma (SQLite / PostgreSQL)
```

- **Route groups** separate the admin dashboard (`src/app/admin/(dashboard)/`) from the
  login page, avoiding auth-redirect loops.
- **Domain logic lives in `src/lib`**, not in route handlers — every behavior is unit
  testable without HTTP.
- **Middleware-adjacent guards** (`src/lib/auth/guards.ts`) verify session, CSRF header,
  and Origin on every mutating admin request.

## 4. Data model

`Registration`, `EmailJob`, `AnnouncementBatch`, `AdminUser`, `Session`, `AuditLog`.

Notable design points:

- **Public references, not IDs.** Each registration gets a Crockford-base32 reference
  (`MRMNHS-XXXXXXXX`) derived from CSPRNG bytes — non-sequential and non-derivable.
  Database IDs never leave the server; URLs never contain student PII.
- **Partial unique index** (raw-SQL migration `active_email_unique`):
  `UNIQUE(emailNormalized) WHERE status IN ('pending_review','approved','waitlisted')`
  — one *active* registration per email, while declined/cancelled students may reapply.
- **Durable email outbox.** Every message is an `EmailJob` row with a dedupe key, claimed
  atomically (`updateMany` from `queued` → `processing`) so concurrent workers never
  double-send. Retries use exponential backoff up to 5 attempts; permanent provider
  errors fail fast without retry.
- **Sessions store only token hashes** (SHA-256). A database leak does not yield usable
  session cookies.
- **AuditLog** records every admin action with actor, target, and sanitized detail.

## 5. Security posture

| Threat | Mitigation |
| --- | --- |
| Credential stuffing / brute force | Per-IP *and* per-account rate limiting (5 attempts / 15 min), uniform error messages, constant-time scrypt verification with dummy-hash path for unknown accounts |
| Session theft | HttpOnly + SameSite=Lax + Secure(in prod) cookies; only SHA-256 hashes stored; 12-hour expiry with server-side rejection |
| CSRF | Per-session HMAC token in a readable cookie, echoed in `x-csrf-token` on every mutation; `Origin` verified against `APP_BASE_URL`; both checks enforced in one guard |
| Account enumeration | Login failures are indistinguishable (same message, comparable timing); duplicate registrations return a generic message |
| Admin registration abuse | No public signup endpoint; accounts only via `npm run admin:create`; optional `ADMIN_EMAILS` allowlist |
| Spam / bots | Honeypot field (silent fake success), per-IP rate limiting, Zod validation on both sides |
| PII leakage | No PII in URLs (reference via sessionStorage), no PII in server logs, no student data in the client bundle beyond the submitted form; CSV export is authenticated and audited |
| SQL injection | Prisma parameterized queries everywhere; no raw SQL except the reviewed migration file |
| XSS | React's escaping; email templates HTML-escape every dynamic value; announcement messages are converted from plain text to escaped HTML |
| Default credentials | None exist; env validation rejects placeholder secrets (`change-me...`) in production |
| SQLite in production | Hard startup failure when `NODE_ENV=production` with a file URL |

Password hashing uses **scrypt** (N=16384, r=8, p=1) from `node:crypto` — memory-hard,
dependency-free, and FIPS-adjacent for school IT comfort.

## 6. Registration flow (correctness)

1. Client generates a UUID idempotency key (kept across retries).
2. Server validates with the shared Zod schema; rate-limits by IP; checks the honeypot.
3. `createRegistration` runs in one Prisma transaction: row insert + email enqueue.
   - Idempotency-key replay returns the original reference (safe network retries).
   - Duplicate active email → generic "already received" message.
   - Reference collision → retried server-side (CSPRNG makes this rare anyway).
4. **Registration never depends on email delivery** — provider failures leave the job
   queued for retry; the student still succeeds.
5. Success page reads reference + summary from sessionStorage; refresh-safe; the URL
   stays clean.

## 7. Email system

- **Provider interface** (`src/lib/email/provider.ts`): `SmtpProvider` (Gmail SMTP via
  Nodemailer — `smtp.gmail.com:465` implicit TLS, credentials from server-side
  `GMAIL_USER`/`GMAIL_APP_PASSWORD` only, app-password spaces stripped, mailbox identity
  redacted from stored errors), `ResendProvider` (real HTTP,
  API-key auth, error classification into transient/permanent), `DevOutboxProvider`
  (writes `.email-outbox/*.json` + `.html`, clearly flagged simulated), plus test
  providers (`FakeEmailProvider`, `FailingEmailProvider`) for deterministic tests.
  Injected providers are honored unconditionally so tests never touch the network.
- **Honest SMTP outcomes.** A successful SMTP handoff is recorded as `accepted`, never
  `delivered` (acceptance is not inbox proof). `classifySmtpError` marks authentication
  (`EAUTH`), 5xx, and envelope/configuration failures permanent — recorded once as
  `failed` with an error code instead of retried indefinitely — while network/4xx
  failures retry with the existing bounded backoff. Missing credentials disable sending
  with setup instructions (console + job `lastError`) rather than faking delivery, and
  are a hard startup error in production. Manual verification: `npm run email:test`
  (never automatic; defaults to the sending account itself).
- **Five templates** (confirmation, approval, waitlist, decline/cancel, announcement),
  each with table-based inline-styled HTML + plain-text alternative, rendered from
  program config — unconfirmed details (meeting URL, start date) render only when set.
- **Worker** claims jobs atomically, applies exponential backoff (1m → 5m → 25m → …),
  records attempts and error codes, and supports admin-triggered retry of failed jobs.
  Runs in-process on long servers (`instrumentation.ts`) or via the bearer-protected
  cron endpoint on serverless platforms.
- **Announcements** are bounded: subject ≤ 120 chars, message ≤ 5000 chars, audience is
  an explicit subset of statuses, and *optional* announcements only reach students with
  recorded marketing consent.

## 8. Admin dashboard

- Overview: counts by status, track breakdown, email queue health, recent activity.
- Registrations: server-driven search (name/email/reference), status/track/grade
  filters, sortable columns, pagination; CSV export streams from the database.
- Detail view: full record, internal notes, status transitions with optional note to
  the student, confirmation dialogs, and the related email job history with retry.
- Announcements composer: audience preview before send, per-batch progress and retry.
- Audit log: every action with actor, timestamp, and sanitized detail.
- Every mutation is CSRF-protected and audited; every admin API response was verified
  to never contain password hashes or session tokens (covered by tests).

## 9. Testing

93 automated tests across 9 suites, all green:

| Suite | Coverage focus |
| --- | --- |
| `validation` | Schema boundaries: names, email formats, phone, grade/track enums, consent rules, honeypot field, message bounds |
| `registration-service` | Reference format/uniqueness, duplicate + case-variant emails, idempotency replay, declined-then-reapply, email queued exactly once, provider failure never blocks registration, confirmation email content (reference, track, 12-hour schedule, preferred name) |
| `api-register` | HTTP layer: 422 mapping, honeypot fake success, rate limiting, duplicate generic message |
| `admin-security` | 401/403 on every protected endpoint, CSRF (missing/forged) and foreign-origin rejection, status unchanged on rejected mutations, uniform login failures, cookie flags, export/announcement authorization, audit entries, no hash/token leakage |
| `email-outbox` | Atomic claiming, transient retry with backoff, permanent failure fast-path, admin retry without duplicates, no re-processing of non-queued jobs |
| `email-smtp` | SMTP retry policy (auth/5xx/envelope permanent, 4xx/network transient), accepted ≠ delivered, credential redaction in errors, missing-credentials disable path with setup instructions, provider factory selection, queue outcomes (`accepted`/`failed`/backoff) — all with injected transports, so no test can reach smtp.gmail.com |
| `status-emails` | Approval/waitlist/decline transitions produce correct templates and queue entries |
| `ui-components` | Form validation messaging, loading/double-submit guard, accessible labeling, hero/FAQ/CTA rendering |
| `success-page` | sessionStorage-based summary, refresh behavior, clean URLs |

Infra: isolated SQLite database per run (`tests/global-setup.ts`), full table wipe
between tests, in-process rate-limit reset, injected email providers — no test ever
touches the network or a shared database.

## 10. Notable engineering decisions

- **SQLite in dev, PostgreSQL in production** with a *generated* PostgreSQL DDL
  (`npm run postgres:schema` uses `prisma migrate diff`) so the dev ergonomics never
  diverge from production semantics; the partial unique index is replicated in raw SQL
  for both dialects.
- **Vitest + Next 15/React 19** required explicit JSX transform config
  (`oxc.jsx` in `vitest.config.ts`) since tsconfig must remain `"jsx": "preserve"` for
  Next.
- **Cookie handling via `NextResponse.cookies`** rather than the `cookies()` store so
  route handlers are directly unit-testable and cookie attributes are explicit.
- **12-hour display formatting** (`formatClockTime`) keeps env storage in 24-hour form
  while showing "7:00 PM" to users.
- **Everything configurable is visible in `.env.example`** with comments explaining
  which values must wait for organizer confirmation.

## 11. Known limitations / future work

- Playwright is installed but no browser-level E2E suite is included; the Vitest
  suites cover handlers and components directly. Adding a smoke E2E (register →
  dashboard) would strengthen release confidence.
- The in-process rate limiter is per-instance; multi-instance deployments should move
  it to a shared store (Redis) or rely on platform-level WAF rules.
- Admin UI is server-rendered with router refreshes; optimistic UI updates would
  improve perceived latency but were skipped to keep mutation flows auditable.
- CSV export loads filtered rows in one query; for very large datasets, switch to a
  streaming cursor.
- The official school and ICT Club logos are installed in `public/images/` and used in
  the UI and transactional emails. Additional photography (if the organizers want it)
  can be added later. No logo artwork was recreated or recolored.

## 12. Visual identity and UI redesign

The public site, registration/success pages, admin shell, and email templates were
redesigned around the supplied official logos.

**Design tokens** (`src/app/globals.css`, Tailwind v4 `@theme`): navy scale anchored on
the club-logo navy (`#1a3a78`), gold scale anchored on the logo yellow (`#f8d828`),
`club-red` (`#c81c1c`) as a restrained secondary accent, plus neutral grays for
borders/dividers/supporting text. Subtle circuit/grid patterns are decorative-only CSS.

**Official assets**: `public/images/mrmnhs-school-logo.png` (503×496) and
`public/images/ict-club-logo.jpg` (1563×1563), rendered at `object-fit: contain` with
meaningful alt text and a neutral fallback if an image fails to load
(`src/components/brand.tsx`). The school logo is always shown first, then the club logo.

**Components**: sticky header with logo lockup, anchor nav (Home, Learning Tracks, How
It Works, FAQ), Register Now button, and an accessible mobile disclosure menu; two-column
hero with logo branding panel and circuit motif; program intro; five learning-track cards
with consistent line icons; numbered "how it works"; new schedule band; accessible FAQ
`<details>`; final CTA; branded footer. The registration section, success page, admin
header/login, and both email templates share the same identity.

**Emails**: navy header with both logos (absolute URLs from `APP_BASE_URL`, white chips
so the artwork is never distorted), gold accent rule, white body, gray supporting text.
All templates keep plain-text alternatives, and content/subject lines are unchanged.

**Verification**: `npx tsc --noEmit`, `npm run lint`, `npm test` (93 tests), and
`npm run build` (23 routes) all pass. Rendered pages were smoke-checked against the dev
server for logo paths, alt text, schedule content, and nav markup.
