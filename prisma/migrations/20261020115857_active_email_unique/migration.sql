-- Prevent duplicate ACTIVE registrations for the same normalized email address.
-- Partial unique index: declined/cancelled registrations do not block a new
-- registration. Works identically on SQLite and PostgreSQL.
CREATE UNIQUE INDEX "Registration_active_email_key"
ON "Registration" ("emailNormalized")
WHERE "status" IN ('pending_review', 'approved', 'waitlisted');
