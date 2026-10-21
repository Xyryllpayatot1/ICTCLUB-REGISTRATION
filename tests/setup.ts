import path from "node:path";
import { beforeAll, beforeEach } from "vitest";
// Registers jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...) on vitest's expect.
import "@testing-library/jest-dom/vitest";

/**
 * Per-file test setup:
 * - points DATABASE_URL at the isolated test database (absolute path),
 * - clears all tables between test files for isolation,
 * - resets the in-process rate limiter.
 */

process.env.DATABASE_URL = `file:${path.join(process.cwd(), "tests", ".tmp", "test.db").replaceAll("\\", "/")}`;

beforeAll(async () => {
  const { getPrisma, resetPrismaClient } = await import("@/lib/db/prisma");
  resetPrismaClient();
  const prisma = getPrisma();
  // Empty all tables (order respects FK constraints).
  await prisma.auditLog.deleteMany();
  await prisma.emailJob.deleteMany();
  await prisma.announcementBatch.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.adminUser.deleteMany();
});

beforeEach(async () => {
  const { resetRateLimits } = await import("@/lib/security/rate-limit");
  resetRateLimits();

  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma();
  await prisma.auditLog.deleteMany();
  await prisma.emailJob.deleteMany();
  await prisma.announcementBatch.deleteMany();
  await prisma.session.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.adminUser.deleteMany();
});
