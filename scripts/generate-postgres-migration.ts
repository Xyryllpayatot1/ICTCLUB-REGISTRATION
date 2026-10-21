/**
 * Regenerate the PostgreSQL schema + migration SQL for production deployments.
 *
 * The Prisma schema targets SQLite for zero-setup development. Production
 * uses managed PostgreSQL (Supabase, Neon, ...). This script derives the
 * permanent PostgreSQL schema from prisma/schema.prisma, then produces the
 * equivalent PostgreSQL DDL via `prisma migrate diff`, including the partial
 * unique index that prevents duplicate active registrations.
 *
 * Outputs:
 *   prisma/postgres/schema.prisma                 (postgresql provider)
 *   prisma/postgres/migrations/0001_init/migration.sql
 *
 * Apply it in production with:
 *   npm run db:use:postgres
 *   (= prisma generate + prisma migrate deploy against prisma/postgres)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const PG_SCHEMA = path.join(ROOT, "prisma", "postgres", "schema.prisma");
const PG_MIGRATION_DIR = path.join(ROOT, "prisma", "postgres", "migrations", "0001_init");

function main() {
  const sqliteSchema = readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
  const postgresSchema = sqliteSchema.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`,
  );

  mkdirSync(path.dirname(PG_SCHEMA), { recursive: true });
  writeFileSync(PG_SCHEMA, postgresSchema, "utf8");
  // Clean up the temporary file used by earlier versions of this script.
  rmSync(path.join(path.dirname(PG_SCHEMA), "schema.tmp.prisma"), { force: true });

  const sql = execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      // Quote for shells (the project path may contain spaces).
      `"${PG_SCHEMA}"`,
      "--script",
    ],
    { cwd: ROOT, encoding: "utf8", shell: true },
  );

  // Partial unique index: one ACTIVE registration per normalized email.
  const partialIndex = `
-- Prevent duplicate active registrations for the same normalized email.
CREATE UNIQUE INDEX IF NOT EXISTS "Registration_active_email_key"
  ON "Registration" ("emailNormalized")
  WHERE "status" IN ('pending_review', 'approved', 'waitlisted');
`;

  rmSync(PG_MIGRATION_DIR, { recursive: true, force: true });
  mkdirSync(PG_MIGRATION_DIR, { recursive: true });
  writeFileSync(path.join(PG_MIGRATION_DIR, "migration.sql"), sql + partialIndex, "utf8");

  console.log(`PostgreSQL schema written to ${PG_SCHEMA}`);
  console.log(`PostgreSQL migration written to ${PG_MIGRATION_DIR}/migration.sql`);
  console.log("Apply with: npm run db:use:postgres");
}

main();
