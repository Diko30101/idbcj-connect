"use client";

import type { FormEvent } from "react";
import { btnDangerCls, inputCls } from "./form-bits";
import { revokePermission } from "@/app/portal/giving-permissions/actions";
import { PERMISSION_REASON_MAX, PERMISSION_STATE_LABEL, permissionState, type GivingPermission } from "@/lib/giving";

function fmtDate(d: string): string {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

function StatePill({ state }: { state: keyof typeof PERMISSION_STATE_LABEL }) {
  const cls =
    state === "aktibo"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : state === "lumipas"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-gray-100 text-gray-600 border-gray-200";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{PERMISSION_STATE_LABEL[state]}</span>;
}

// Listahan ng mga pahintulot. canRevoke: Pastoral leader lang (sinusuri rin ng database).
export function GivingPermissionList({
  permissions,
  names,
  today,
  canRevoke,
}: {
  permissions: GivingPermission[];
  names: Record<string, string>;
  today: string;
  canRevoke: boolean;
}) {
  if (permissions.length === 0) return <p className="py-4 text-center text-sm text-gray-500">Wala pang naibigay na pahintulot.</p>;

  const confirmRevoke = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Bawiin ang pahintulot na ito? Hindi na makatatanggap ng handog ang kaanib hangga't walang bagong pahintulot.")) e.preventDefault();
  };

  return (
    <div className="divide-y divide-gray-100">
      {permissions.map((p) => {
        const state = permissionState(p, today);
        return (
          <div key={p.id} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">{names[p.member_id] ?? "(hindi mabasa ang pangalan)"}</p>
                <p className="text-sm text-gray-500">
                  Ibinigay noong {fmtDate(p.granted_at)} · Valid hanggang {fmtDate(p.valid_until)}
                </p>
                <p className="text-sm text-gray-500">Tala ng konsultasyon: {p.consultation_note}</p>
                {state === "nabawi" && (
                  <p className="text-sm text-gray-500">
                    Nabawi{p.revoked_at ? ` noong ${fmtDate(p.revoked_at)}` : ""} · Dahilan: {p.reason}
                  </p>
                )}
              </div>
              <StatePill state={state} />
            </div>
            {canRevoke && state !== "nabawi" && (
              <form action={revokePermission} onSubmit={confirmRevoke} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={p.id} />
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-gray-700">Dahilan ng pagbawi</span>
                  <input name="reason" required maxLength={PERMISSION_REASON_MAX} autoComplete="off" className={inputCls} />
                </label>
                <button type="submit" className={btnDangerCls}>
                  Bawiin
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
