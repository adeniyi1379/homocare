import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) redirect(homeForRole(current.profile.role));

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-800">
            HC
          </div>
          <h1 className="text-xl font-bold text-slate-900">Homecare Clinic</h1>
          <p className="mt-1 text-sm text-slate-500">
            Medical &amp; Maternity Services - Osogbo, Osun State
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          Staff login only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}