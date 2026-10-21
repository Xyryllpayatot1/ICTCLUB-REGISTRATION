import { getEnv } from "@/lib/config/env";
import { processDueEmailJobs } from "@/lib/email/outbox";

/**
 * Email worker loop.
 *
 * On long-running, self-hosted deployments the worker runs inside the Node
 * process (started from `instrumentation.ts`). On serverless platforms
 * (Vercel, Netlify) there is no long-lived process, so schedule the secured
 * endpoint `POST /api/cron/email-worker` with an external scheduler instead
 * (Vercel Cron, cron-job.org, GitHub Actions schedule). See docs/DEPLOYMENT.md.
 */

const globalRef = globalThis as unknown as { __emailWorkerHandle?: NodeJS.Timeout };

export function startEmailWorker(): void {
  if (globalRef.__emailWorkerHandle) return; // already running (dev hot-reload safe)

  let running = false;
  const interval = getEnv().EMAIL_WORKER_INTERVAL_MS;

  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      await processDueEmailJobs({ limit: 20 });
    } catch (error) {
      // Log without personal data; the queue itself is durable.
      console.error("[email-worker] run failed:", (error as Error).message);
    } finally {
      running = false;
    }
  };

  globalRef.__emailWorkerHandle = setInterval(tick, interval);
  // Do not keep the process alive solely for the worker (helps tests/CLI).
  globalRef.__emailWorkerHandle.unref?.();
  console.log(`[email-worker] started (every ${Math.round(interval / 1000)}s)`);
}

export function stopEmailWorker(): void {
  if (globalRef.__emailWorkerHandle) {
    clearInterval(globalRef.__emailWorkerHandle);
    globalRef.__emailWorkerHandle = undefined;
    console.log("[email-worker] stopped");
  }
}
