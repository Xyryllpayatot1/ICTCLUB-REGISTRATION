import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SCHOOL_SHORT, CLUB_NAME, PROGRAM_NAME, TAGLINE } from "@/lib/config/program";
import { DarkBrandLockup } from "@/components/brand";

export const metadata: Metadata = {
  title: {
    default: `${CLUB_NAME} — ${PROGRAM_NAME}`,
    template: `%s — ${CLUB_NAME}`,
  },
  description:
    "Learn programming, web development, networking, databases, and cybersecurity through collaborative online sessions with the MRMNHS ICT Club. Learn. Build. Advance.",
  keywords: ["MRMNHS", "ICT Club", "teaching program", "programming", "networking", "cybersecurity"],
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-navy-900 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy-800 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        {children}
        <footer className="border-t-4 border-gold-400 bg-navy-900 py-10 text-sm text-navy-100">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6">
            <DarkBrandLockup />
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                <li>
                  <Link href="/" className="text-navy-100 hover:text-gold-400">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/#tracks" className="text-navy-100 hover:text-gold-400">
                    Learning Tracks
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="text-navy-100 hover:text-gold-400">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="text-navy-100 hover:text-gold-400">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/#register" className="font-semibold text-gold-400 hover:text-gold-300">
                    Register Now
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-navy-100 hover:text-gold-400">
                    Privacy notice
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="text-center">
              <p className="text-navy-100">
                © {new Date().getFullYear()} {SCHOOL_SHORT} ICT Club — {TAGLINE}
              </p>
              <p className="mt-1 text-xs text-navy-300">
                Official school branding and program operation are subject to authorization by the
                relevant school personnel.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
