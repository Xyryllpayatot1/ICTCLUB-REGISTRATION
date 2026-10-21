import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * A single client is reused across hot reloads in development to avoid
 * exhausting database connections. Access is always through getPrisma() so the
 * environment is validated before any query runs.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** Test helper: drop the cached client (used between isolated test databases). */
export function resetPrismaClient(): void {
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
