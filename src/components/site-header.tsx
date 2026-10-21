"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { TAGLINE } from "@/lib/config/program";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#tracks", label: "Learning Tracks" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Sticky site header: official logos first (school, then club), anchor
 * navigation, and a prominent yellow Register Now button. On small screens the
 * nav links collapse behind an accessible disclosure button.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/95 backdrop-blur">
      {/* Thin gold rule echoing the logo band */}
      <div className="h-1 w-full bg-gold-400" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="rounded-sm"
          aria-label={`MRMNHS ICT Club Teaching Program — home. ${TAGLINE}`}
        >
          <BrandLockup compact />
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 text-sm font-medium text-navy-600 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-navy-900">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href="#register" className="px-4 py-2 text-sm">
            Register Now
          </ButtonLink>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-navy-200 text-navy-700 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="border-t border-navy-100 bg-white px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="flex flex-col gap-1 text-sm font-medium text-navy-700">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md px-3 py-2 hover:bg-navy-50 hover:text-navy-900"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
