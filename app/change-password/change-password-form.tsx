"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, null);

  return (
    <form action={action} className="space-y-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Bagong password</span>
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputCls} />
        <span className="text-xs text-gray-400">Hindi bababa sa 8 na karakter.</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Ulitin ang bagong password</span>
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={inputCls} />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Sine-save..." : "I-save ang bagong password"}
      </button>
    </form>
  );
}
