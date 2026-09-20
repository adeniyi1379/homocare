import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import { LoginForm } from "./login-form";

const FEATURES = [
  {
    title: "Patient Intake",
    body: "Search patients, open encounters and keep the front desk moving.",
  },
  {
    title: "Pharmacy & Stock",
    body: "Dispense medication, track hand-offs to nurses and monitor stock levels.",
  },
  {
    title: "Billing & Records",
    body: "Carbon-copy receipts with privacy-safe internals — audit ready.",
  },
];

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) redirect(homeForRole(current.profile.role));

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(38rem 26rem at 115% -10%, rgba(45,212,191,.22), transparent 60%), radial-gradient(30rem 22rem at -8% 110%, rgba(8,145,178,.3), transparent 55%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 font-display text-xl font-bold leading-none text-white shadow-lg shadow-cyan-900/40">
            +
          </span>
          <span>
            <span className="block font-display text-xl font-bold tracking-wide">Homocare</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-teal-200">
              Gracious Hospital
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Hospital management,
            <br />
            built around care.
          </h1>
          <p className="mt-3 text-teal-100">
            One quiet, fast system for intake, nursing, dispensing and billing at
            Homocare Gracious Hospital, Osogbo.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-teal-300">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.8a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>
                  <span className="block font-semibold text-white">{f.title}</span>
                  <span className="block text-sm text-teal-100/80">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-teal-100/60">
          Homocare Gracious Hospital Management System — Osogbo, Osun State
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 font-display text-xl font-bold leading-none text-white shadow-md shadow-cyan-900/20">
                +
              </span>
              <span>
                <span className="block font-display text-xl font-bold tracking-wide text-slate-900">
                  Homocare
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-teal-600">
                  Gracious Hospital
                </span>
              </span>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-900">Staff sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use your hospital account to access your workspace.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Staff login only. Unauthorized access is prohibited.
          </p>
        </div>
      </section>
    </div>
  );
}