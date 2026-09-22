"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { completePasswordChange } from "./actions";
import { btnCls, inputCls } from "@/components/portal/ui";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Ulitin ang Bagong Password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
          autoComplete="new-password"
          className={inputCls}
        />
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
