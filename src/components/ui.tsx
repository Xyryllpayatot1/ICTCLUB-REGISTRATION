import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Small shared UI primitives with accessibility built in:
 * buttons (link/button variants), section headings, badge, field wrappers.
 * Design tokens come from globals.css (@theme).
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-400 text-navy-900 hover:bg-gold-500 active:bg-gold-600 shadow-sm font-semibold",
  secondary:
    "bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-600 shadow-sm font-semibold",
  ghost:
    "bg-white text-navy-800 border border-navy-200 hover:border-navy-400 hover:bg-navy-50",
  /** Light outline for navy/dark surfaces (secondary CTA). */
  outline:
    "bg-transparent text-white border border-white/60 hover:border-white hover:bg-white/10 font-semibold",
  danger: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 font-semibold",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={cn(baseClasses, variantClasses[variant], className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button type={type} className={cn(baseClasses, variantClasses[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  /** `dark` keeps accessible contrast when placed on a navy surface. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      {eyebrow ? (
        <p
          className={cn(
            "code-decoration mb-2 text-xs font-semibold uppercase tracking-[0.2em]",
            dark ? "text-gold-400" : "text-gold-600",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "text-2xl font-bold tracking-tight sm:text-3xl",
          dark ? "text-white" : "text-navy-900",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-3 text-base leading-relaxed",
            dark ? "text-navy-100" : "text-navy-600",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    pending_review: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    waitlisted: "bg-sky-100 text-sky-800 border-sky-200",
    declined: "bg-rose-100 text-rose-800 border-rose-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
      )}
    >
      {label}
    </span>
  );
}
