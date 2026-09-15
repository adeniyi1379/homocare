"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";

const NAV_LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/receptionist", label: "Intake & Billing", roles: ["receptionist", "cashier"] },
  { href: "/nurse", label: "Nursing Care", roles: ["nurse"] },
  { href: "/pharmacy", label: "Pharmacy", roles: ["pharmacy"] },
  { href: "/admin", label: "Dashboard", roles: ["admin"] },
];

export function ShellNav({
  user,
  children,
}: {
  user: { email: string; fullName: string; role: Role } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!user || pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const links =
    user.role === "admin"
      ? NAV_LINKS
      : NAV_LINKS.filter((l) => l.roles.includes(user.role));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md">
        <div className="app-header">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 font-display text-lg font-bold leading-none text-white shadow-md shadow-cyan-900/25">
              +
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold tracking-wide text-slate-900">
                Homecare
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-brand-600">
                Gracious Hospital
              </span>
            </span>
          </Link>

          <nav className="nav-scroll">
            <div className="nav-inner text-sm">
              {links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                const className = active
                  ? "rounded-lg bg-brand-50 font-bold text-brand-800 ring-1 ring-inset ring-brand-100"
                  : "rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap px-3 py-1.5 font-medium ${className}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="user-block text-sm">
            <div className="text-right leading-tight">
              <div className="font-semibold text-slate-900">{user.fullName || user.email}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {ROLE_LABELS[user.role]}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        Homecare Gracious Hospital Management System - Osogbo, Osun State
      </footer>
    </div>
  );
}