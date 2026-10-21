/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single long-running server instance (self-hosted, Render,
 * Railway, VPS). On serverless platforms with many isolated instances this is
 * a per-instance limiter — a best-effort layer, not a perimeter. The README's
 * deployment guide recommends a platform-level WAF/rate limit in front of the
 * app for production.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(windowMs: number, now: number): void {
  // Periodically drop expired buckets to keep memory bounded.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Record a hit for `key` and report whether the request is allowed under
 * `limit` hits per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(windowMs, now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterMs = windowMs - (now - oldest);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Standard limits used across the app. */
export const RATE_LIMITS = {
  register: { limit: 5, windowMs: 60_000 },
  auth: { limit: 5, windowMs: 15 * 60_000 },
  announcementPreview: { limit: 20, windowMs: 60_000 },
  announcementSend: { limit: 5, windowMs: 10 * 60_000 },
} as const;
