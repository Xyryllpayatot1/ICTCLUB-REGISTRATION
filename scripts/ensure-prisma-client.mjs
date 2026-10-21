/**
 * Generate the Prisma client that matches the database being used.
 *
 * The Prisma client bakes its provider in at generate time, so the SQLite
 * client (prisma/schema.prisma) cannot talk to Postgres and vice versa.
 * This wrapper picks the right schema automatically so `npm run dev`,
 * `build` and `start` always work regardless of which database .env points at:
 *
 *   DATABASE_URL="file:..."          → SQLite client  (local dev)
 *   DATABASE_URL="postgresql://..."  → Postgres client (Supabase / production)
 *
 * Generation is skipped when the active client already matches — this keeps
 * repeated runs fast and avoids Windows file locks on the query engine while
 * a dev server is running.
 *
 * Flags:
 *   --sqlite   force the SQLite client regardless of DATABASE_URL
 *              (used by `npm test`, which always runs on an isolated SQLite file)
 *
 * Manual switches also exist:
 *   npm run db:use:sqlite
 *   npm run db:use:postgres
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return "";
  const content = readFileSync(envPath, "utf8");
  const match = content.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n#]+)/m);
  return match ? match[1].trim() : "";
}

function currentProvider() {
  const generated = path.join(ROOT, "node_modules", ".prisma", "client", "schema.prisma");
  if (!existsSync(generated)) return null;
  const match = readFileSync(generated, "utf8").match(
    /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/,
  );
  return match ? match[1] : null;
}

const forceSqlite = process.argv.includes("--sqlite");
const url = resolveDatabaseUrl();
const target = forceSqlite ? "sqlite" : /^postgres(ql)?:\/\//i.test(url) ? "postgresql" : "sqlite";
const schema = target === "postgresql" ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma";

const active = currentProvider();
if (active === target) {
  console.log(`[db] Prisma client already targets ${target} — skipping generate.`);
  process.exit(0);
}

console.log(
  `[db] switching Prisma client ${active ?? "unknown"} → ${target} (generating from ${schema})`,
);
execSync(`npx prisma generate --schema "${schema}"`, { cwd: ROOT, stdio: "inherit" });
