"use client";

import { useActionState, useState } from "react";
import { resetMemberPassword, type ResetPasswordState } from "@/app/portal/members/member-actions";
import { btnDangerCls, btnGhostCls } from "@/components/portal/form-bits";

export function ResetPasswordButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(resetMemberPassword, null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  if (state?.done) {
    const d = state.done;
    const slip = [
      "IDBCJ Connect",
      "Website: https://www.idbcj.org  (pindutin ang 'Login to Connect')",
      `Username: ${d.username}`,
      `Bagong temporary password: ${d.tempPassword}`,
      "Pagkatapos mong mag-login, papalitan mo ang password.",
    ].join("\n");
    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-800">
          Na-reset ang password.
        </div>
        <div className="rounded-md border border-gray-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bagong temporary password</div>
          <div className="mt-1 font-mono text-base text-gray-900">{d.tempPassword}</div>
        </div>
        <p className="text-xs text-amber-800">
          Ngayon lang ito makikita. Ibigay sa member nang pribado. Papalitan niya ito sa susunod na login.
        </p>
        <button
          type="button"
          className={btnGhostCls}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(slip);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Na-copy" : "Copy ang login details"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {!confirming ? (
        <button type="button" disabled={disabled} className={btnDangerCls} onClick={() => setConfirming(true)}>
          Mag-reset ng password
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            Gagawa ng bagong temporary password at hindi na gagana ang luma. Sigurado ka ba?
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={btnDangerCls}>
              {pending ? "Nire-reset..." : "Oo, i-reset"}
            </button>
            <button type="button" className={btnGhostCls} onClick={() => setConfirming(false)}>
              Huwag
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
