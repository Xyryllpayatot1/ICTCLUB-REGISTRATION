/** Small shared utilities (no framework dependencies). */

/** Join class names, dropping falsy values. A tiny alternative to `clsx`. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Normalize an email address for storage and duplicate detection:
 * trimmed and lowercased. (Display value is stored separately.)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Truncate a string for safe display in logs without exposing full values. */
export function truncate(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/** Format a date for admin UI display (Philippine locale-neutral ISO style). */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Extract a safe client IP hash for rate limiting (never stored raw). */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  // Keep only the network portion for privacy-preserving rate limiting.
  return ip.split(".").length === 4 ? ip.split(".").slice(0, 3).join(".") + ".x" : ip.slice(0, 8) + "…";
}
