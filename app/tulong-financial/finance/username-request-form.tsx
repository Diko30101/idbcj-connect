"use client";

import { useState } from "react";
import { requestTulongUsername, lookupPortalAccount, type UsernameRequestResult } from "@/app/portal/finance/tulong-financial/actions";
import { inputCls, btnGhostCls } from "@/components/portal/form-bits";

type Member = { id: string; full_name: string };
type PortalAccount = { profile_id: string; full_name: string; email: string | null; via: string };

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

// Form ng Finance Ministry: pumili ng kaanib.
// - Tinitiyak muna kung may portal account na: kung meron, gagamitin ang
//   portal login (approval letter lang, walang bagong username/password).
// - Kung wala: awtomatikong malilikha ang username at temporary password
//   (isang beses lang ipapakita ang password).
export default function UsernameRequestForm({ members, hasAccountMemberIds }: { members: Member[]; hasAccountMemberIds: Set<string> }) {
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<UsernameRequestResult | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [portalAccount, setPortalAccount] = useState<PortalAccount | null>(null);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const selectedHasAccount = selectedId ? hasAccountMemberIds.has(selectedId) : false;

  async function onSelect(memberId: string) {
    setSelectedId(memberId);
    setResult(null);
    setPortalAccount(null);
    if (!memberId) return;
    setLooking(true);
    try {
      const found = await lookupPortalAccount(memberId);
      setPortalAccount(found);
    } catch {
      setPortalAccount(null);
    } finally {
      setLooking(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData(e.currentTarget);
      // Kung may portal account ang kaanib: laging gamitin ito —
      // walang bagong username/password (ayon sa utos ng user).
      fd.set("use_portal", portalAccount ? "1" : "");
      const res = await requestTulongUsername(fd);
      setResult(res);
    } catch {
      setResult({ ok: false, error: "Hindi naipadala ang kahilingan. Subukan ulit." });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setSelectedId("");
    setPortalAccount(null);
  }

  if (result?.ok && result.portalUser) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-bold text-emerald-900">
          Naipadala na sa admin ang kahilingan para kay {result.memberName}.
        </p>
        <p className="mt-2 text-sm text-emerald-800">
          May portal account na ang kaanib — <strong>gagamitin niya ang kanyang portal login</strong>.
          Walang bagong username/password na nilikha. Pagkatapos ma-aprubahan ng admin, makikita niya
          ang <strong>Tulong Financial</strong> sa kanyang menu (history ng transactions at balanse).
        </p>
        <button type="button" onClick={reset} className={btnGhostCls + " mt-3"}>
          Gumawa ng isa pang kahilingan
        </button>
      </div>
    );
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
          onClick={reset}
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
        <span className="text-sm font-medium text-gray-700">Kaanib (Active)</span>
        <select
          name="member_id"
          required
          className={inputCls}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" disabled>
            Pumili ng kaanib…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
              {hasAccountMemberIds.has(m.id) ? " ✓ (may account na)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button className={btnGhostCls} disabled={busy || looking || !selectedId || selectedHasAccount}>
          {busy ? "Ipinapadala…" : portalAccount ? "Ipadala ang kahilingan ng pag-apruba" : "Ipadala sa admin"}
        </button>
      </div>
      {selectedHasAccount && selected && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:col-span-2">
          <p className="text-sm font-bold text-emerald-900">
            Si {selected.full_name} ay may username na at kasapi na ng Tulong Financial.
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Hindi na kailangan gumawa ng bagong account para sa kaanib na ito.
          </p>
        </div>
      )}
      {!selectedHasAccount && looking && (
        <p className="text-xs text-gray-400 sm:col-span-2">Tinitiyak kung may portal account na ang kaanib…</p>
      )}
      {!selectedHasAccount && !looking && portalAccount && selected && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
          <p className="text-sm font-bold text-blue-900">
            May portal account na si {selected.full_name}:
          </p>
          <p className="mt-1 text-sm text-blue-800">
            {portalAccount.full_name}
            {portalAccount.email ? ` · ${portalAccount.email}` : ""}
          </p>
          <p className="mt-2 text-sm text-blue-900">
            Gagamitin ang portal account na ito — <strong>approval letter lang</strong> ang kailangan;
            walang bagong username/password na lilikhain. Pagkatapos ma-aprubahan, makikita niya ang
            Tulong Financial sa kanyang menu.
          </p>
        </div>
      )}
      {!selectedHasAccount && !looking && !portalAccount && selected && (
        <p className="text-xs text-gray-400 sm:col-span-2">
          Walang nakitang portal account — awtomatikong malilikha ang username (mula sa pangalan) at
          temporary password.
        </p>
      )}
      {result && !result.ok && (
        <p className="font-semibold text-red-600 text-sm sm:col-span-2">{result.error}</p>
      )}
    </form>
  );
}
