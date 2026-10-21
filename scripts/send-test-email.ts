/**
 * Manual SMTP test email — an operator tool, NEVER run automatically.
 *
 * Usage:
 *   npm run email:test                        sends to the configured Gmail
 *                                              account itself (safest default)
 *   npm run email:test -- you@example.com      sends to an explicit address
 *
 * Guard rails:
 * - Only runs when invoked; nothing in the app calls it.
 * - Never sends to registration participants — the default recipient is the
 *   sending account, and any other address must be typed explicitly.
 * - Reads configuration from server-side environment variables / .env
 *   (the password is never printed or written anywhere).
 * - Reports SMTP acceptance accurately: "accepted by the server" is NOT the
 *   same as "delivered to the inbox".
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getEnv, isSmtpConfigured, SMTP_SETUP_INSTRUCTIONS } from "../src/lib/config/env";
import { getEmailProvider, EmailSendError } from "../src/lib/email/provider";

/**
 * Minimal .env loader (tsx does not load .env itself). Values already present
 * in process.env (platform-injected) always win.
 */
function loadLocalEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && !(match[1] in process.env)) process.env[match[1]] = value;
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const env = getEnv();

  if (env.EMAIL_PROVIDER !== "smtp") {
    console.error(
      `This command tests Gmail SMTP, but EMAIL_PROVIDER="${env.EMAIL_PROVIDER}".\n` +
        'Set EMAIL_PROVIDER="smtp" in .env first.',
    );
    process.exit(1);
  }
  if (!isSmtpConfigured(env)) {
    console.error(SMTP_SETUP_INSTRUCTIONS);
    process.exit(1);
  }

  const explicitRecipient = process.argv[2]?.trim();
  const recipient = explicitRecipient || env.GMAIL_USER;
  if (explicitRecipient) {
    console.log(`Sending a test email to the address you provided: ${explicitRecipient}`);
  } else {
    console.log("Sending a test email to the configured sending account itself.");
  }

  const provider = getEmailProvider(env);
  try {
    const { providerMessageId } = await provider.send(
      {
        to: recipient,
        subject: "MRMNHS ICT Club — SMTP test email",
        text: [
          "This is a manual SMTP configuration test from the MRMNHS ICT Club registration platform.",
          "It is NOT a registration or program announcement.",
          "",
          `Sent at ${new Date().toISOString()}.`,
        ].join("\n"),
        html: `
          <p>This is a <strong>manual SMTP configuration test</strong> from the MRMNHS ICT Club
          registration platform. It is <strong>not</strong> a registration or program announcement.</p>
          <p>Sent at ${new Date().toISOString()}.</p>`,
      },
      env,
    );
    console.log("SMTP server ACCEPTED the message.");
    console.log(`  provider:  ${provider.name}`);
    if (providerMessageId) console.log(`  message id: ${providerMessageId}`);
    console.log(
      "\nAccepted by smtp.gmail.com means the server took responsibility for the message —" +
        "\ncheck the destination inbox (and spam) to confirm actual delivery.",
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof EmailSendError) {
      console.error(`\nTest FAILED [${error.code}] ${error.transient ? "(transient)" : "(permanent — will not be retried)"}:`);
      console.error(error.message);
      process.exit(1);
    }
    console.error("\nTest FAILED:", (error as Error).message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Failed to run the SMTP test:", (error as Error).message);
  process.exit(1);
});
