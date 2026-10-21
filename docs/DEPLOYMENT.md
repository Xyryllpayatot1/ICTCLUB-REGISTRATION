# Deployment Guide

This guide covers deploying the registration platform to a production environment with
managed PostgreSQL, real email delivery, and HTTPS.

## 1. Prerequisites

- Node.js >= 20.9
- A managed PostgreSQL database (Neon, Supabase, Render, Railway, Azure, etc.)
- A domain with HTTPS (required for secure cookies and CSRF origin checks)
- An email provider: a Gmail account with **2-Step Verification + App Password** for
  Gmail SMTP (`EMAIL_PROVIDER="smtp"`, no extra account needed), or a
  [Resend](https://resend.com) account with a verified sending domain
  (`EMAIL_PROVIDER="resend"`). The provider layer is pluggable in
  `src/lib/email/provider.ts`

## 2. Environment variables

Copy `.env.example` and set every value. The app validates configuration at startup and
**refuses to boot** in production if a value is missing or unsafe.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/db?sslmode=require`. A SQLite URL in production causes a hard startup failure. **Supabase:** use the IPv4 *pooler* in session mode (`aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>`) — the direct `db.<ref>.supabase.co` endpoint is IPv6-only and unreachable from IPv4-only machines/networks. |
| `APP_BASE_URL` | yes | Public HTTPS origin, no trailing slash. Used for email links, CSRF origin checks, cookie `Secure` flag. |
| `AUTH_SECRET` | yes | >= 32 chars in production. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Rotating it invalidates all admin sessions and CSRF tokens (safe operation). |
| `CRON_SECRET` | yes | Bearer token for `/api/cron/email-worker`. Same generation method. |
| `EMAIL_PROVIDER` | yes | `"smtp"` (Gmail SMTP) or `"resend"` in production. `"dev-outbox"` is hard-rejected in production. |
| `EMAIL_PROVIDER_API_KEY` | conditional | Resend API key (`re_...`). Required when `EMAIL_PROVIDER="resend"`, unused for `"smtp"`. |
| `EMAIL_FROM` | yes | Sender, e.g. `"MRMNHS ICT Club <registrations@your-domain.test>"`. For Gmail SMTP it must be the Gmail address itself (or a verified alias). |
| `GMAIL_USER` | conditional | Gmail address for `EMAIL_PROVIDER="smtp"` — **required in production** (boot fails if empty), optional in development (sending is then disabled with setup instructions on the console and in the job's `lastError`). Server-side only: no `NEXT_PUBLIC_` prefix, never logged, `.env` is git-ignored. |
| `GMAIL_APP_PASSWORD` | conditional | Gmail App password (16 chars, spaces tolerated) for `EMAIL_PROVIDER="smtp"`. Same server-side-only rules as `GMAIL_USER`. |
| `EMAIL_ADMIN_NOTIFY` | no | Receives failure notifications. |
| `EMAIL_WORKER_INTERVAL_MS` | no | In-process worker interval (long-running servers only). |
| `ADMIN_EMAILS` | strongly recommended | Comma-separated allowlist. Accounts must also exist in the DB. |
| `PROGRAM_TIMEZONE` | yes | e.g. `Asia/Manila`. |
| `PROGRAM_START_TIME` / `PROGRAM_END_TIME` | yes | 24-hour format (`19:00`); displayed as 12-hour. |
| `PROGRAM_SCHEDULE` | yes | Free-text schedule label. |
| `REGISTRATION_STATUS_DEFAULT` | yes | `pending_review` (recommended), `approved`, or `waitlisted`. |
| `REGISTRATION_OPEN` | yes | `false` closes the form without a redeploy. |
| `CONTACT_EMAIL` | no | Shown on site + emails when set. |
| `PROGRAM_MEETING_URL` | no | **Only set once confirmed by organizers.** Included in approval emails when present. |
| `PROGRAM_START_DATE` | no | **Only set once confirmed.** Hidden everywhere when empty.. |

## 3. Database setup

### 3.1 Create the database

Create an empty PostgreSQL database and note the connection string.

### 3.2 Apply the PostgreSQL schema

The repository ships a permanent PostgreSQL Prisma schema at
`prisma/postgres/schema.prisma` and its migrations at
`prisma/postgres/migrations/` (including `0001_init`, which contains the partial
unique index that allows re-registering only after a previous registration is declined).

Apply them with a single command:

```bash
npm run db:use:postgres
```

This generates the Prisma client for PostgreSQL **and** runs
`prisma migrate deploy --schema prisma/postgres/schema.prisma`, which applies
`0001_init` and records it in the `_prisma_migrations` bookkeeping table (so
re-running is a no-op and future migrations stack cleanly).

> The Prisma client bakes its provider in at generate time, so the SQLite client
> cannot talk to Postgres and vice versa. The `dev`/`build`/`start` scripts call
> `scripts/ensure-prisma-client.mjs`, which auto-selects the right schema from
> `DATABASE_URL` — you normally never have to think about this. To force a
> switch: `npm run db:use:sqlite` (local dev + tests) or
> `npm run db:use:postgres` (Supabase/production).

**Fallback — plain SQL (no Prisma bookkeeping):**

```bash
psql "$DATABASE_URL" -f prisma/postgres/migrations/0001_init/migration.sql
```

### 3.3 Regenerating the PostgreSQL schema and DDL

After changing `prisma/schema.prisma` (the SQLite development schema), regenerate
the PostgreSQL equivalent:

```bash
npm run postgres:schema
```

This rewrites both `prisma/postgres/schema.prisma` and
`prisma/postgres/migrations/0001_init/migration.sql`. Review the diff before
applying it in production.

## 4. Build and start

```bash
npm ci                 # installs deps (postinstall generates the SQLite client)
npm run db:use:postgres # generate the PostgreSQL client + apply migrations
npm run build          # re-selects the correct client from DATABASE_URL
npm start
```

For PaaS platforms (Render, Railway, Vercel, Fly.io): build command
`npm run db:use:postgres && npm run build`, start command `npm start`, Node 20+.
(`build` also auto-selects the client from `DATABASE_URL`, so the explicit switch
is only needed for the migrations.)

## 5. Create the first admin account

There is no default password and no public registration. The script reads
`ADMIN_EMAIL`, optional `ADMIN_NAME`, and optional `ADMIN_PASSWORD`
(a strong password is generated and printed once if omitted), and enforces the
`ADMIN_EMAILS` allowlist:

```bash
# on a server where environment variables are injected by the platform:
ADMIN_EMAIL=you@example.com npm run admin:create

# locally, where config lives in .env (tsx does not read .env by itself):
$env:ADMIN_EMAIL='you@example.com'   # PowerShell
npx tsx --env-file=.env scripts/create-admin.ts
# bash: ADMIN_EMAIL=you@example.com npx tsx --env-file=.env scripts/create-admin.ts
```

Add the account to `ADMIN_EMAILS` so only listed accounts can sign in.

## 6. Email delivery

### 6.1 Configure the provider

**Gmail SMTP (`EMAIL_PROVIDER="smtp"`):**

1. On the Google account, enable **2-Step Verification** (Security settings).
2. Create an **App Password**: myaccount.google.com/security/apppasswords
   (regular account passwords are rejected by Gmail SMTP).
3. Set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM="MRMNHS ICT Club <GMAIL_USER>"`.
4. Verify manually — this command runs only when you invoke it and defaults to sending
   the test to the Gmail account itself, so a participant can never receive it:

   ```bash
   npm run email:test
   ```

   It reports **"SMTP server accepted"** — acceptance is not delivery; also check the
   inbox/spam folder. Missing credentials print the setup instructions instead of
   sending, and authentication failures are recorded as permanent errors (no retries).

**Resend (`EMAIL_PROVIDER="resend"`):** set `EMAIL_PROVIDER_API_KEY` and a verified
`EMAIL_FROM`.

Queued jobs and their error codes (`smtp_auth_failed`, `smtp_not_configured`, …) are
visible in the admin dashboard under email queue/logs.

### 6.2 Long-running server (VPS, Render, Fly.io)

The in-process email worker starts automatically (see `src/instrumentation.ts`) and polls
the queue every `EMAIL_WORKER_INTERVAL_MS`. No cron needed.

### 6.3 Serverless (Vercel, Netlify, Netlify Functions)

There is no long-lived process. Schedule the secured endpoint:

```
POST /api/cron/email-worker
Authorization: Bearer $CRON_SECRET
```

Every 1–5 minutes, e.g. with Vercel Cron:

```json
{ "crons": [{ "path": "/api/cron/email-worker", "schedule": "*/5 * * * *" }] }
```

and pass the header from environment config. A standalone shell script
(`scripts/process-email-queue.ts`) also exists for classic crontab setups:

```
*/5 * * * * cd /opt/app && npm run email:process
```

## 7. HTTPS, cookies, and CSRF

- Serve exclusively over HTTPS. In production the session cookie is issued with
  `Secure`; over plain HTTP browsers will reject it.
- `APP_BASE_URL` must match the public origin exactly — the login endpoint verifies the
  `Origin` header against it.
- Do not put the app behind a path prefix without adjusting `next.config.ts`.

## 8. Backups and retention

- Enable automated backups on the database (most managed providers do this by default).
- The privacy notice promises deletion/anonymization on request; implement that process
  operationally (delete the `Registration` row — email jobs reference it with
  `ON DELETE SET NULL`).
- `AuditLog` rows intentionally survive registration deletion (they store action metadata,
  not student PII beyond the reference).

## 9. Health checks

`GET /api/health` returns 200 with database connectivity status — use it for uptime
monitoring and load-balancer health checks.

## 10. Updating

```bash
git pull
npm ci
npm run db:use:postgres   # apply any new migrations (also selects the PG client)
npm run build
# restart the process manager
```

Admin sessions survive deploys (they live in the database). Email jobs in flight are
re-claimed safely thanks to atomic queue claiming and dedupe keys.
