# MRMNHS ICT Club Teaching Program — Registration Platform

A production-minded registration funnel and management platform for the MRMNHS ICT Club
Teaching Program. Students register through a public form; organizers manage applications
through a secure admin dashboard.

## What's included

**Public funnel**
- Landing page (program overview, learning tracks, FAQ) styled in navy/white/yellow with
  subtle circuit-board accents — fully responsive and accessible (keyboard navigation,
  focus states, reduced-motion support).
- Validated registration form (client + server Zod validation) with honeypot spam
  protection, per-IP rate limiting, and idempotency keys so network retries never create
  duplicates.
- Success page showing a non-sequential registration reference (e.g. `MRMNHS-XK4TQ9ZM`).
  References never expose database IDs and are passed via `sessionStorage`, never URLs.
- Confirmation email queued through a durable outbox (retries with backoff, dedupe keys).
- Privacy notice written for a program where many participants are minors: essential and
  optional consent are separate, and nothing sensitive is ever placed in URLs, logs, or
  the client bundle.

**Admin dashboard** (`/admin`)
- Login with server-managed sessions: scrypt password hashing, HttpOnly + SameSite=Lax
  session cookies, HMAC CSRF tokens, Origin checks, per-IP and per-account rate limiting,
  and an optional `ADMIN_EMAILS` allowlist. There is **no public admin registration** and
  **no default password** — accounts are created with `npm run admin:create`.
- Registrations list with search, status/track/grade filters, sorting, and pagination.
- Detail view with status changes (approved / waitlisted / declined / cancelled), internal
  notes, and status-change notification emails.
- Bounded announcement composer (essential vs. optional — optional announcements only go
  to students who opted in) with per-status audience selection and retry controls.
- CSV export (streams from the database; audited).
- Audit log of every admin action.

**Operations**
- Health endpoint (`/api/health`), secured cron endpoint for the email worker
  (`/api/cron/email-worker`), and an in-process worker for long-running servers
  (`src/instrumentation.ts`).
- SQLite for zero-setup development; managed PostgreSQL for production. The app refuses
  to boot in production with a SQLite URL.
- Email providers: **Resend** for production, **dev-outbox** for development (messages
  written to `.email-outbox/` and clearly flagged as simulated — the app never pretends
  a message was delivered).

## Quick start (development)

```bash
npm install
cp .env.example .env          # then edit — see notes below
npm run db:migrate            # creates SQLite dev.db and applies migrations
npm run dev                   # http://localhost:3000
```

Minimum `.env` changes for local development:
- `AUTH_SECRET` — any value longer than 32 chars (the example placeholder is rejected).
- `CRON_SECRET` — same rule.
- Everything else has working development defaults (`EMAIL_PROVIDER="dev-outbox"`).

**Using a PostgreSQL database instead (e.g. Supabase)?** Set `DATABASE_URL` to your
connection string and run `npm run db:use:postgres` — it applies the migrations and
generates the matching Prisma client. `npm run dev`/`build`/`start` detect the provider
from `DATABASE_URL` automatically; only `npm test` needs the SQLite client (the `test`
script switches it for you). Use `npm run db:use:sqlite` to point back at the local file.

Create your admin account (no default credentials exist):

```bash
# config comes from environment variables — see docs/DEPLOYMENT.md §5
$env:ADMIN_EMAIL='you@example.com'    # PowerShell
npx tsx --env-file=.env scripts/create-admin.ts
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm test` / `npm run test:watch` | Run the test suite (Vitest) |
| `npm run db:migrate` | Apply Prisma migrations (dev, SQLite) |
| `npm run db:deploy` | Apply Prisma migrations (SQLite schema) |
| `npm run db:use:sqlite` | Switch to the local SQLite database (client + `file:./dev.db`) |
| `npm run db:use:postgres` | Switch to PostgreSQL: generate client + `migrate deploy` |
| `npm run db:seed` | Seed demo program config data |
| `npm run admin:create` | Provision an admin account (env-var driven) |
| `npm run email:process` | Run the email queue once (for cron) |
| `npm run email:test` | Send one manual SMTP test email (never automatic) |
| `npm run postgres:schema` | Regenerate `prisma/postgres/schema.prisma` + migrations |

## Database

- **Development/test:** SQLite (`file:./dev.db`), managed by Prisma migrations in
  `prisma/migrations/`. The test suite always runs against an isolated SQLite file.
- **Production (and optional cloud development):** managed PostgreSQL — Supabase,
  Neon, Render, ... with a permanent Prisma schema at `prisma/postgres/schema.prisma`
  and migrations at `prisma/postgres/migrations/` (including the partial unique index
  that blocks duplicate *active* registrations per email).
- The Prisma client bakes in its provider at generate time. `npm run dev`/`build`/`start`
  run `scripts/ensure-prisma-client.mjs`, which picks the schema matching `DATABASE_URL`;
  `npm test` always regenerates the SQLite client first. Manual switch:
  `npm run db:use:sqlite` / `npm run db:use:postgres`.

See `docs/DEPLOYMENT.md` for the full production workflow (including Supabase's
IPv4 pooler requirement).

## Email

The outbox is durable: every message is a database row (`EmailJob`) claimed atomically by
the worker, retried up to 5 times with exponential backoff, and deduplicated by key.
Registration never depends on email delivery — if the provider is down, registrations are
still saved and emails are retried. A job is marked **accepted** only when the provider
actually accepted the message — SMTP/API acceptance is never reported as inbox
**delivery**.

Providers (`EMAIL_PROVIDER`):

- **`smtp`** — Gmail SMTP (`smtp.gmail.com:465`, implicit TLS) via Nodemailer. Requires
  `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google account → Security → 2-Step Verification →
  App passwords), read server-side only (no `NEXT_PUBLIC_` prefix, never logged, `.env`
  is git-ignored). If the credentials are missing in development, sending is **disabled
  with clear setup instructions** instead of pretending a message was sent; authentication
  and other permanent errors are not retried (recorded as `failed` with the error code).
- `EMAIL_PROVIDER="resend"` + `EMAIL_PROVIDER_API_KEY` + verified `EMAIL_FROM` → real
  delivery via [Resend](https://resend.com).
- `EMAIL_PROVIDER="dev-outbox"` → files written to `.email-outbox/` (git-ignored) and
  clearly labeled simulated. Hard-rejected in production.

Manual SMTP check (runs only when you invoke it; the default recipient is the sending
account itself, so no participant can ever receive a test email):

```bash
npm run email:test                     # test email to the sending account
npm run email:test -- you@example.com  # test email to an address you type
```

## Project layout

```
src/app            Pages + API routes (public funnel, admin, cron, health)
src/components     UI components (landing sections, registration form, admin widgets)
src/lib            Domain logic: config, db, validation, registration, auth, email,
                   admin services, security, utils
prisma             Schema, migrations (SQLite), PostgreSQL DDL, seed
scripts            Admin provisioning, one-shot email processing, PG migration generator
tests              Vitest suites: validation, registration, API, admin security,
                   email outbox, status emails, UI components, success page
```

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying to production (env vars, DB,
  cron, email, SSL/cookies).
- [`docs/PRODUCTION_LAUNCH_CHECKLIST.md`](docs/PRODUCTION_LAUNCH_CHECKLIST.md) —
  pre-launch steps with the program organizers.
- [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md) — design decisions,
  security posture, and test coverage details.

## Honesty notes

Program details that the organizers have not yet confirmed (start dates, deadlines,
meeting links, instructor names, contact email) are **configuration, not code**. They stay
hidden on the site and in emails until set in `.env`. The platform does not promise
certificates, employment, or mastery. The official school and ICT Club logos are used
exactly as supplied, in `public/images/`.
