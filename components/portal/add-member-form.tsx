"use client";

import { useActionState, useState } from "react";
import { createMember, type CreateMemberState } from "@/app/portal/members/member-actions";
import { CATEGORY_LABEL } from "@/lib/categories";
import { Field, inputCls, btnCls, btnGhostCls } from "@/components/portal/form-bits";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<CreateMemberState, FormData>(createMember, null);
  const [copied, setCopied] = useState(false);

  if (state?.created) {
    const c = state.created;
    const slip = [
      "IDBCJ Connect",
      "Website: https://www.idbcj.org  (pindutin ang 'Login to Connect')",
      `Username: ${c.username}`,
      `Temporary password: ${c.tempPassword}`,
      "Pagkatapos mong mag-login, papalitan mo ang password.",
    ].join("\n");

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Nagawa ang account ni {c.name} ({CATEGORY_LABEL[c.category]}).
        </div>

        <dl className="grid gap-3 rounded-lg border border-gray-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</dt>
            <dd className="mt-1 font-mono text-base text-gray-900">{c.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Temporary password</dt>
            <dd className="mt-1 font-mono text-base text-gray-900">{c.tempPassword}</dd>
          </div>
        </dl>

        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ngayon lang ito makikita. Ibigay ito sa member nang pribado (hindi sa public na group chat). Kapag nawala,
          gamitin ang "Mag-reset ng password" sa profile niya. Papalitan niya ang password sa unang login.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnCls}
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
          <a href="/portal/members/new" className={btnGhostCls}>
            Magdagdag ng isa pa
          </a>
          <a href="/portal/members" className={btnGhostCls}>
            Bumalik sa Members
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Buong Pangalan (Full Name)" hint="Ang username ay bubuuin dito: unang pangalan + apelyido.">
        <input name="full_name" required minLength={3} maxLength={100} className={inputCls} autoComplete="off" />
      </Field>
      <Field label="Category">
        <select name="category" required defaultValue="adult" className={inputCls}>
          <option value="adult">{CATEGORY_LABEL.adult}</option>
          <option value="young">{CATEGORY_LABEL.young}</option>
          <option value="child">{CATEGORY_LABEL.child}</option>
        </select>
      </Field>
      <Field label="Phone (opsyonal)">
        <input name="phone_number" inputMode="tel" className={inputCls} autoComplete="off" />
      </Field>
      <Field label="City or Town (opsyonal)">
        <input name="city" className={inputCls} autoComplete="off" />
      </Field>

      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-slate-50 p-3 text-sm text-gray-700 sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4" />
        <span>
          Nakuha ko na ang pahintulot ng member na gawan siya ng account at itala ang kaniyang impormasyon. Para sa
          Young at Child, pahintulot ito ng magulang o guardian.
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "Ginagawa..." : "Gumawa ng Account"}
        </button>
      </div>
    </form>
  );
}
