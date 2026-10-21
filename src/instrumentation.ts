/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Starts the in-process email queue worker on long-running deployments
 * (self-hosted, Render, Railway, VPS). On serverless platforms this may never
 * run or may be short-lived; schedule POST /api/cron/email-worker instead
 * (see docs/DEPLOYMENT.md).
 *
 * The dynamic import MUST be nested inside a positive `=== "nodejs"` check:
 * webpack constant-folds that condition per compilation target and skips the
 * block entirely for the edge runtime. An early `return` followed by a
 * top-level import would still be bundled into the edge compilation, which
 * cannot resolve the worker's Node-only dependencies (node:fs, node:crypto).
 */
export async function register() {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.EMAIL_WORKER_DISABLED === "true") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startEmailWorker } = await import("@/lib/email/worker");
      startEmailWorker();
    } catch (error) {
      console.error(
        "[instrumentation] email worker not started (check environment configuration):",
        (error as Error).message,
      );
    }
  }
}
