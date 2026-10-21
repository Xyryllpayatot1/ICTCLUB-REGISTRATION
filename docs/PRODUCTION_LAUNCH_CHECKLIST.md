# Production Launch Checklist

Work through this list with the program organizers **before** opening registration
publicly. Items marked ⚙️ are technical; 🗣️ require an organizer decision.

## Configuration (nothing is invented — set only what is confirmed)

- 🗣️ Confirm the program **schedule** (days + start/end time) with organizers →
  `PROGRAM_SCHEDULE`, `PROGRAM_START_TIME`, `PROGRAM_END_TIME`, `PROGRAM_TIMEZONE`.
- 🗣️ Confirm whether registration requires **review** →
  `REGISTRATION_STATUS_DEFAULT` (`pending_review` recommended).
- 🗣️ Confirm a **start date** only if officially approved → `PROGRAM_START_DATE`.
  Leave empty otherwise — the site and emails hide it.
- 🗣️ Confirm an **online meeting link** only if officially approved →
  `PROGRAM_MEETING_URL`. Leave empty otherwise.
- 🗣️ Confirm a public **contact email** → `CONTACT_EMAIL` (or leave empty to hide).
- 🗣️ Confirm **learning tracks** match the actual offering
  (`src/lib/config/program.ts` — Programming/Web Dev, Computer Networking, and any
  others the organizers approve). Edit there if the lineup differs.

## Accounts and access

- ⚙️ Create admin accounts with `npm run admin:create` — **no account exists by
  default**; do not reuse personal emails.
- ⚙️ Set `ADMIN_EMAILS` to the exact list of approved admin addresses.
- ⚙️ Store admin passwords in a password manager; the app only stores scrypt hashes.
- ⚙️ Verify `/admin/login` works and every other `/admin/*` page redirects to it when
  signed out.

## Security review

- ⚙️ `AUTH_SECRET` and `CRON_SECRET` are unique random values (>= 32 chars), stored
  only in the platform's secret manager — never in git.
- ⚙️ Site served over HTTPS only; session cookie carries `Secure` in production.
- ⚙️ Confirm rate limiting responds: five failed logins from one IP return HTTP 429.
- ⚙️ Confirm the registration honeypot silently accepts (fake success) when filled.
- ⚙️ `ADMIN_EMAILS` is set (empty allowlist means any DB-backed admin can log in —
  acceptable in dev, not in production).

## Email

- ⚙️ Resend (or provider) sending domain is **verified** and `EMAIL_FROM` uses it.
- ⚙️ Send one test registration end-to-end; confirm the confirmation email arrives and
  the admin dashboard shows it as `accepted`.
- ⚙️ Email worker is running: in-process (long-running server) or the cron endpoint /
  `npm run email:process` is scheduled (serverless). Verify with a queued job.
- 🗣️ Organizer reviews the wording of all five templates (confirmation, approval,
  waitlist, decline, announcement) in `src/lib/email/templates.ts`.

## Privacy and consent (participants are minors)

- 🗣️ School reviews `/privacy` and confirms the consent process for minors (including
  parental consent where policy/law requires). Adjust the notice text if the school
  requires specific wording.
- 🗣️ Decide the retention period; implement deletion/anonymization requests
  operationally (see `docs/DEPLOYMENT.md` §8).
- ⚙️ Verify the registration form shows essential consent as required and marketing
  consent as separate and optional.

## Content

- 🗣️ Confirm the school has authorized publishing the official school and ICT Club
  logos now used in `public/images/` and `src/components/brand.tsx`. Replace them only
  with approved higher-resolution originals — never recreate or recolor the artwork.
- 🗣️ Review landing-page copy (hero, program intro, FAQ) for accuracy.
- ⚙️ No invented promises (certificates, employment, mastery) exist in copy — keep it
  that way when editing.

## Operations

- ⚙️ Database backups enabled on the managed PostgreSQL instance.
- ⚙️ Uptime monitor pointed at `GET /api/health`.
- ⚙️ `REGISTRATION_OPEN=true` set only when ready; flip to `false` instantly if needed.
- ⚙️ Run the full suite one last time: `npm run lint && npm run typecheck && npm test`.
- ⚙️ Do a full dry run: register → email → dashboard → approve → status email →
  announcement → CSV export → audit log.
