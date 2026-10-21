import { getPrisma } from "@/lib/db/prisma";

/**
 * Administrative audit log.
 *
 * Records who did what and when, without storing unnecessary personal data.
 * Details should contain identifiers (references, counts, statuses) rather
 * than full student records.
 */

export interface AuditEntry {
  action: string;
  actor: string; // admin email, "system", or "anonymous"
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actor: entry.actor,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        detail: entry.detail ? JSON.stringify(entry.detail) : null,
      },
    });
  } catch (error) {
    // Auditing must never break the primary operation, but failures are loud.
    console.error("[audit] failed to write audit log:", (error as Error).message);
  }
}

export const AUDIT_ACTIONS = {
  ADMIN_LOGIN: "admin.login",
  ADMIN_LOGIN_FAILED: "admin.login_failed",
  ADMIN_LOGOUT: "admin.logout",
  STATUS_CHANGE: "registration.status_change",
  ADMIN_NOTE: "registration.note",
  EXPORT_CSV: "registration.export_csv",
  EMAIL_RETRY: "email.retry",
  ANNOUNCEMENT_CREATED: "announcement.created",
  ANNOUNCEMENT_RETRIED: "announcement.retried",
} as const;
