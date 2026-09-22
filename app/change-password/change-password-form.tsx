"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { completePasswordChange } from "./actions";
import { btnCls, inputCls } from "@/components/portal/ui";

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M10 3.5c-4.1 0-7.6 2.6-9 6.5 1.4 3.9 4.9 6.5 9 6.5s7.6-2.6 9-6.5c-1.4-3.9-4.9-6.5-9-6.5zm0 10.8a4.3 4.3 0 110-8.6 4.3 4.3 0 010 8.6z" />
        <path d="M10 8.3a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M2.7 2.3a.75.75 0 00-1.06 1.06l3.2 3.2C2.9 7.9 1.6 9.4 1 10c1.4 3.9 4.9 6.5 9 6.5 1.5 0 2.9-.35 4.2-1l2.9 2.9a.75.75 0 101.06-1.06L2.7 2.3zM10 14.3c-.5 0-.97-.08-1.42-.22l-1.4-1.4a2.85 2.85 0 003.93-3.93l1.4 1.4c.14.45.22.92.22 1.42a4.3 4.3 0 01-2.73 2.73zm-4.24-1.2L4.4 11.75A9.9 9.9 0 012.9 10c1.14-2.35 3.15-4.1 5.6-4.86l1.3 1.3a4.3 4.3 0 00-3.9 5.9c.05.12.1.24.16.36z" />
      <path d="M17.6 10a8.9 8.9 0 00-2.2-3.36l-1.06 1.06A7.4 7.4 0 0116 10c-.32.7-.73 1.34-1.22 1.92l1.06 1.06A8.9 8.9 0 0017.6 10z" />
    </svg>
  );
}

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Kailangan ng hindi bababa sa 6 na letra/numero ang password.");
      return;
    }
    if (password !== confirm) {
      setError("Hindi magkatugma ang dalawang password.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Hindi na-save: " + updateError.message);
      return;
    }

    startTransition(() => {
      completePasswordChange();
    });
  }

  const busy = loading || isPending;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Bagong Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            className={inputCls + " pr-11"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Itago ang password" : "Ipakita ang password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Ulitin ang Bagong Password</span>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
            className={inputCls + " pr-11"}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Itago ang password" : "Ipakita ang password"}
            aria-pressed={showConfirm}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <EyeIcon visible={showConfirm} />
          </button>
        </div>
      </label>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={btnCls}>
        {busy ? "Nagse-save..." : "I-save ang Bagong Password"}
      </button>
    </form>
  );
}
