"use client";

import { useState } from "react";
import Link from "next/link";
import { SCHOOL_SHORT, TAGLINE } from "@/lib/config/program";
import { cn } from "@/lib/utils";

/**
 * Official branding — the real, supplied logo artwork.
 *
 * Integrity rules (see docs/PRODUCTION_LAUNCH_CHECKLIST.md):
 * - The official school and ICT Club logos are used exactly as supplied
 *   (public/images/) — never recreated, recolored, stretched, or cropped.
 * - Rendered with `object-fit: contain` inside fixed boxes.
 * - If an image fails to load, a clearly-labeled neutral fallback is shown
 *   instead of breaking the layout.
 */

export const SCHOOL_LOGO_SRC = "/images/mrmnhs-school-logo.png";
export const CLUB_LOGO_SRC = "/images/ict-club-logo.jpg";

const SCHOOL_LOGO_ALT = "Marciano Del Rosario Memorial National High School (MRMNHS) official logo";
const CLUB_LOGO_ALT = "MRMNHS ICT Club official logo";

function LogoFallback({
  label,
  size,
  shape = "square",
  className,
}: {
  label: string;
  size: number;
  shape?: "square" | "circle";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-navy-200 bg-navy-50 code-decoration font-bold text-navy-700",
        shape === "circle" ? "rounded-full" : "rounded-md",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.28) }}
    >
      {SCHOOL_SHORT.slice(0, 3)}
    </span>
  );
}

/** A single official logo with an `onError` fallback (never distorted). */
export function Logo({
  src,
  alt,
  size = 40,
  shape = "square",
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  /** Club logo is presented in a circular frame; school logo stays square. */
  shape?: "square" | "circle";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <LogoFallback label={alt} size={size} shape={shape} className={className} />;
  }
  return (
    // ESLint rule disabled: the fallback above is the deliberate `onError`
    // safety net required for official logo artwork.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn(
        "shrink-0 object-contain",
        shape === "circle" && "rounded-full bg-white ring-1 ring-navy-200",
        className,
      )}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

/** Both official logos side by side (school first, then club) — as supplied. */
export function OfficialLogos({
  size = 40,
  gap = "gap-3",
  className,
}: {
  size?: number;
  gap?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", gap, className)}>
      <Logo src={SCHOOL_LOGO_SRC} alt={SCHOOL_LOGO_ALT} size={size} />
      <span
        aria-hidden="true"
        className="h-8 w-px shrink-0 bg-navy-200"
        style={{ height: Math.max(20, size * 0.7) }}
      />
      <Logo src={CLUB_LOGO_SRC} alt={CLUB_LOGO_ALT} size={size} shape="circle" />
    </span>
  );
}

/** Header/footer lockup: official logos + program name and tagline. */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <OfficialLogos size={compact ? 36 : 44} />
      <span className={cn("flex-col leading-tight", compact ? "hidden sm:flex" : "flex")}>
        <span className={cn("font-bold text-navy-900", compact ? "text-sm" : "text-base")}>
          MRMNHS ICT Club
        </span>
        {compact ? null : (
          <span className="text-xs text-navy-500">
            {TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
}

/** Compact footer lockup for dark surfaces (logos on a white chip, text inverted). */
export function DarkBrandLockup() {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="MRMNHS ICT Club Teaching Program — home">
      <span className="inline-flex shrink-0 rounded-lg bg-white p-1.5">
        <OfficialLogos size={32} gap="gap-2" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-white">MRMNHS ICT Club</span>
        <span className="text-xs text-navy-200">Teaching Program · {TAGLINE}</span>
      </span>
    </Link>
  );
}
