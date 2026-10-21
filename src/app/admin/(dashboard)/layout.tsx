import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { OfficialLogos } from "@/components/brand";
import { LogoutButton } from "../admin-client";

export const dynamic = "force-dynamic";

/**
 * Admin area shell.
 *
 * The authorization check lives server-side in the layout: every page under
 * /admin renders inside it, so an unauthenticated user is redirected to the
 * login page regardless of what URLs they try. Individual API routes perform
 * their own server-side checks as well (defense in depth).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        {/* Gold rule echoing the public site branding. */}
        <div className="h-1 w-full bg-gold-400" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-sm"
              aria-label="MRMNHS ICT Club admin — overview"
            >
              {/* Compact official branding: school logo first, club logo second. */}
              <OfficialLogos size={30} gap="gap-2" />
              <span className="text-sm font-bold text-navy-900">
                MRMNHS ICT Club <span className="text-slate-400">/</span> Admin
              </span>
            </Link>
            <nav aria-label="Admin navigation" className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <Link href="/admin" className="hover:text-navy-900">
                Overview
              </Link>
              <Link href="/admin/registrations" className="hover:text-navy-900">
                Registrations
              </Link>
              <Link href="/admin/announcements" className="hover:text-navy-900">
                Announcements
              </Link>
              <Link href="/admin/audit" className="hover:text-navy-900">
                Audit log
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
