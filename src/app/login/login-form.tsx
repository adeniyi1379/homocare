"use client";

import { useActionState } from "react";
import { signIn, type ActionResult } from "@/lib/actions/auth";
import { inputClass } from "@/components/ui";

const initialState: ActionResult = undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder="Enter Your Email"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={inputClass}
          placeholder="••••••••"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-block"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}