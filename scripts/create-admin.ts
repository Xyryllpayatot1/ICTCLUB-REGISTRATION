/**
 * Provision an administrator account.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:create
 *
 * - The account is created only if it does not exist (or --force to rotate).
 * - If ADMIN_EMAILS is configured and non-empty, the email must be on it.
 * - There is NO default password: ADMIN_PASSWORD must be provided, or a strong
 *   random one is generated and printed ONCE for the operator to use.
 */
import { getEnv, getAdminAllowlist } from "../src/lib/config/env";
import { getPrisma } from "../src/lib/db/prisma";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { logAudit } from "../src/lib/admin/audit";
import { randomBytes } from "node:crypto";

async function main() {
  getEnv(); // validate configuration first (clear error messages)
  const prisma = getPrisma();

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.error("ADMIN_EMAIL is required. Example: ADMIN_EMAIL=teacher@example.com npm run admin:create");
    process.exit(1);
  }

  const allowlist = getAdminAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(email)) {
    console.error(
      `Refusing to create "${email}": it is not listed in ADMIN_EMAILS (${allowlist.join(", ")}).`,
    );
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing && !force) {
    console.error(`An admin account for ${email} already exists. Use --force to rotate its password.`);
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD ?? "";
  let generated = false;
  if (!password) {
    // 4 words worth of entropy: 20 chars from an unambiguous alphabet.
    password = randomBytes(15).toString("base64url").slice(0, 20);
    generated = true;
  } else {
    const weak = validatePasswordStrength(password);
    if (weak) {
      console.error(`Password rejected: ${weak}`);
      process.exit(1);
    }
  }

  const passwordHash = await hashPassword(password);

  if (existing && force) {
    await prisma.adminUser.update({ where: { email }, data: { passwordHash } });
  } else {
    await prisma.adminUser.create({
      data: { email, name: process.env.ADMIN_NAME ?? null, passwordHash, role: "admin" },
    });
  }

  await logAudit({
    action: existing && force ? "admin.password_rotated" : "admin.created",
    actor: "cli",
    targetType: "admin_user",
    detail: { email },
  });

  console.log(`\nAdmin account ready: ${email}`);
  if (generated) {
    console.log(`
A strong password was generated for you. It is shown ONCE and not stored:
  ${password}

Use it to sign in at /admin/login, then change it through your password manager.
`);
  } else {
    console.log("The provided password has been set.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to create admin:", (error as Error).message);
  process.exit(1);
});
