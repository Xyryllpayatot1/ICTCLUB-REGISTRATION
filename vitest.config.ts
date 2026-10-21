import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js requires tsconfig `"jsx": "preserve"`, but Vitest's transform
  // pipeline needs JSX compiled — override it here for test files only.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: "forks",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./tests/.tmp/test.db",
      APP_BASE_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret-value-for-automated-tests-0123456789abcdef",
      EMAIL_PROVIDER: "resend",
      EMAIL_PROVIDER_API_KEY: "test-api-key-not-real",
      EMAIL_FROM: "MRMNHS ICT Club <test@example.com>",
      // Deliberately fake Gmail credentials for SMTP provider unit tests.
      // No test ever opens a network connection to smtp.gmail.com (transports
      // are injected), so these can never send a real email.
      GMAIL_USER: "smtp-test@example.com",
      GMAIL_APP_PASSWORD: "not-a-real-app-password",
      CRON_SECRET: "test-cron-secret-0123456789",
      REGISTRATION_STATUS_DEFAULT: "pending_review",
      REGISTRATION_OPEN: "true",
      ADMIN_EMAILS: "admin@example.com",
      PROGRAM_TIMEZONE: "Asia/Manila",
    },
  },
});
