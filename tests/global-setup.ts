import { execSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Vitest global setup: prepares an isolated SQLite test database and pushes
 * the Prisma schema to it. The database file is recreated for every full run.
 */
export function setup(): void {
  const tmpDir = path.join(process.cwd(), "tests", ".tmp");
  mkdirSync(tmpDir, { recursive: true });
  const dbFile = path.join(tmpDir, "test.db");
  if (existsSync(dbFile)) {
    rmSync(dbFile, { force: true });
    rmSync(`${dbFile}-journal`, { force: true });
  }

  // Absolute path, forward slashes (Prisma SQLite requirement on Windows).
  const url = `file:${dbFile.replaceAll("\\", "/")}`;
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

export function teardown(): void {
  // Keep the database file for debugging failed runs; remove on success.
  const dbFile = path.join(process.cwd(), "tests", ".tmp", "test.db");
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${dbFile}${suffix}`, { force: true });
  }
}
