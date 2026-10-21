/**
 * Manually process the email queue from the CLI (useful on serverless
 * deployments without an external scheduler, or for local testing).
 *
 * Usage: npm run email:process [-- --limit=50]
 */
import { getEnv } from "../src/lib/config/env";
import { processDueEmailJobs } from "../src/lib/email/outbox";

async function main() {
  getEnv();
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = arg ? Number(arg.split("=")[1]) : 50;
  const result = await processDueEmailJobs({ limit: Math.min(100, Math.max(1, limit || 50)) });
  console.log("Email queue run:", result);
  process.exit(0);
}

main().catch((error) => {
  console.error("Email processing failed:", (error as Error).message);
  process.exit(1);
});
