"use client";

import { useState } from "react";
import { requestTulongUsername, type UsernameRequestResult } from "@/app/portal/finance/tulong-financial/actions";
import { inputCls, btnGhostCls } from "@/components/portal/form-bits";

type Member = { id: string; full_name: string };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard hindi available */
        }
      }}
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      {copied ? "Nakopya!" : `Kopyahin ang ${label}`}
    </button>
  );
}

// Form ng Finance Ministry: pumili ng kaanib, awtomatikong malilikha ang
// username at temporary password. Isang beses lang ipapakita ang password.
export default function UsernameRequestForm({ members }: { members: Member[] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UsernameRequestResult | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await requestTulongUsername(new FormData(e.currentTarget));
      setResult(res);
    } catch {
      setResult({ ok: false, error: "Hindi naipadala ang kahilingan. Subukan ulit." });
    } finally {
      setBusy(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-bold text-emerald-900">
          Naipadala na sa admin ang kahilingan para kay {result.memberName}.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="text-base font-bold text-gray-900">{result.username}</code>
              <CopyButton text={result.username ?? ""} label="username" />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Temporary password</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="text-base font-bold text-gray-900">{result.tempPassword}</code>
              <CopyButton text={result.tempPassword ?? ""} label="password" />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold text-amber-900">Ibigay sa kaanib (pagkatapos ma-aprubahan ng admin):</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-amber-900">
            <li>Mag-login sa <strong>idbcj.org/tulong-financial/login</strong> gamit ang username at temporary password sa itaas.</li>
            <li>Pagkatapos mag-login, palitan agad ang password sa <strong>&ldquo;Palitan ang password&rdquo;</strong>.</li>
            <li>Huwag ibahagi kaninuman ang password.</li>
          </ol>
          <p className="mt-2 text-xs text-amber-700">
            Isang beses lang ipapakita ang temporary password na ito — kopyahin bago isara ang pahinang ito.
            Kapag nawala at na-aprubahan na ang account, gamitin ang &ldquo;I-reset&rdquo; sa talahanayan sa ibaba para sa bagong password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className={btnGhostCls + " mt-3"}
        >
          Gumawa ng isa pang kahilingan
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Kaanib (Active, walang account)</span>
        <select name="member_id" required className={inputCls} defaultValue="">
          <option value="" disabled>
            Pumili ng kaanib…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button className={btnGhostCls} disabled={busy}>
          {busy ? "Ipinapadala…" : "Ipadala sa admin"}
        </button>
      </div>
      <p className="text-xs text-gray-400 sm:col-span-2">
        Awtomatikong malilikha ang username (mula sa pangalan) at temporary password.
        {result && !result.ok && (
          <span className="mt-1 block font-semibold text-red-600">{result.error}</span>
        )}
      </p>
    </form>
  );
}
