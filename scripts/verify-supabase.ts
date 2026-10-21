/** Verify the Supabase schema: tables, partial unique index, migration row. */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({ log: [] });
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log("tables:", tables.map((t) => t.tablename).join(", "));

  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Registration' ORDER BY indexname`;
  console.log("registration indexes:", indexes.map((i) => i.indexname).join(", "));

  const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`;
  console.log("applied migrations:", JSON.stringify(migrations));

  const counts = await prisma.$queryRaw<Array<{ n: string }>>`SELECT count(*)::text AS n FROM "Registration"`;
  console.log("registration rows:", counts[0].n);
  await prisma.$disconnect();
}
void main();
