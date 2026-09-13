"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";

const NAV_LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/receptionist", label: "Intake & Triage", roles: ["receptionist"] },
  { href: "/nurse", label: "Care & Administer", roles: ["nurse"] },
  { href: "/pharmacy", label: "Pharmacy & Stock", roles: ["pharmacy"] },
  { href: "/cashier", label: "Billing & Receipts", roles: ["cashier"] },
  { href: "/admin", label: "Operations Dashboard", roles: ["admin"] },
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

  const baseLinks = user.role === "admin" ? NAV_LINKS : NAV_LINKS.filter((l) => l.roles.includes(user.role));
  const links = user.role === "admin" ? [{ href: "/admin", label: "Operations Dashboard", roles: ["admin"] as Role[] }, ...baseLinks] : baseLinks;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-teal-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-4">
          <Link href="/" className="font-bold text-lg tracking-tight">
            Homecare Clinic
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    active
                      ? "bg-teal-950/60 text-teal-50"
                      : "text-teal-100 hover:bg-teal-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium text-teal-50">
                {user.fullName || user.email}
              </div>
              <div className="text-teal-300 capitalize">
                {ROLE_LABELS[user.role]}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-teal-700 px-3 py-1.5 text-teal-100 hover:bg-teal-800"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        Homecare Hospital Management System - Osogbo, Osun State
      </footer>
    </div>
  );
}