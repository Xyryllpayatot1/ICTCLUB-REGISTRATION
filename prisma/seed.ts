/**
 * Development seed data — FAKE registrations for local work only.
 *
 * - Refuses to run when NODE_ENV=production.
 * - Emails use the reserved "example.com" domain so nothing can be delivered.
 * - No real student data is ever used here.
 *
 * Usage: npm run db:seed
 */
import { getEnv } from "../src/lib/config/env";
import { getPrisma } from "../src/lib/db/prisma";
import { TRACK_IDS, GRADE_LEVEL_IDS, EXPERIENCE_LEVELS } from "../src/lib/config/program";
import { generateUniqueReference } from "../src/lib/registration/reference";
import { hashPassword } from "../src/lib/auth/password";
import { normalizeEmail } from "../src/lib/utils";

const FAKE_NAMES = [
  "Juan Dela Cruz",
  "Maria Santos",
  "Paolo Reyes",
  "Angela Ramos",
  "Miguel Torres",
  "Bea Gonzales",
  "Carlo Mendoza",
  "Sofia Bautista",
  "Ryan Aquino",
  "Hannah Villanueva",
  "Joshua Flores",
  "Mika Navarro",
];

const STATUSES = ["pending_review", "approved", "waitlisted", "declined"] as const;

async function main() {
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    console.error("Refusing to seed: this script is for development/test databases only.");
    process.exit(1);
  }

  const prisma = getPrisma();
  const count = await prisma.registration.count();
  if (count > 0) {
    console.log(`Database already has ${count} registrations — skipping seed.`);
    return;
  }

  const now = Date.now();
  for (let i = 0; i < FAKE_NAMES.length; i++) {
    const fullName = FAKE_NAMES[i];
    const email = `student${i + 1}@example.com`;
    const reference = await generateUniqueReference(async (candidate) =>
      Boolean(await prisma.registration.findUnique({ where: { reference: candidate }, select: { id: true } })),
    );

    await prisma.registration.create({
      data: {
        reference,
        email,
        emailNormalized: normalizeEmail(email),
        fullName,
        preferredName: i % 3 === 0 ? fullName.split(" ")[0] : null,
        gradeLevel: GRADE_LEVEL_IDS[i % GRADE_LEVEL_IDS.length],
        section: i % 2 === 0 ? `ICT-${(i % 4) + 1}` : null,
        track: TRACK_IDS[i % TRACK_IDS.length],
        experienceLevel: i % 4 === 0 ? EXPERIENCE_LEVELS[i % EXPERIENCE_LEVELS.length].id : null,
        learningGoals: i % 2 === 0 ? "I want to build my own website and learn programming." : null,
        additionalInterests: i % 3 === 0 ? "Robotics and computer hardware" : null,
        status: STATUSES[i % STATUSES.length],
        essentialConsent: true,
        essentialConsentAt: new Date(now - i * 3600_000),
        marketingConsent: i % 2 === 0,
        marketingConsentAt: i % 2 === 0 ? new Date(now - i * 3600_000) : null,
        confirmationEmailStatus: i % 5 === 0 ? "failed" : "accepted",
        createdAt: new Date(now - i * 7200_000),
      },
    });
  }

  // Dev admin (only when explicitly configured — never a hardcoded password).
  const devEmail = (process.env.DEV_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const devPassword = process.env.DEV_ADMIN_PASSWORD ?? "";
  if (devEmail && devPassword) {
    const existing = await prisma.adminUser.findUnique({ where: { email: devEmail } });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          email: devEmail,
          name: "Dev Admin",
          passwordHash: await hashPassword(devPassword),
        },
      });
      console.log(`Created dev admin account: ${devEmail}`);
    }
  } else {
    console.log("No DEV_ADMIN_EMAIL/DEV_ADMIN_PASSWORD set — skipping dev admin creation.");
    console.log("Create one with: npm run admin:create");
  }

  console.log(`Seeded ${FAKE_NAMES.length} fake registrations (example.com emails, fake data).`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", (error as Error).message);
  process.exit(1);
});
