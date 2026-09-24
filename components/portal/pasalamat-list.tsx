"use client";

import { useState, type FormEvent } from "react";
import { PasalamatForm } from "./pasalamat-form";
import { btnCls, btnDangerCls, btnGhostCls } from "./form-bits";
import { updatePasalamat, submitPasalamat, voidPasalamat } from "@/app/portal/finance/pasalamat/actions";
import { fmtPeso } from "@/lib/finance";
import { GIVING_STATUS_LABEL, PASALAMAT_TYPE_LABEL, type GivingStatus, type PasalamatRecord } from "@/lib/giving";

function fmtDatePH(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

function StatusPill({ status }: { status: GivingStatus }) {
  const cls =
    status === "draft"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : status === "submitted"
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-red-50 text-red-700 border-red-100";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{GIVING_STATUS_LABEL[status]}</span>;
}

// mode "local": Local Finance (draft lang ang mae-edit/mapapadala/mave-void nila).
// mode "church": church-wide Finance (maaari ring mag-edit ng naipadala at mag-void nito; ayon sa 011).
export function PasalamatList({
  records,
  names,
  timezone,
  path,
  mode,
}: {
  records: PasalamatRecord[];
  names: Record<string, string>;
  timezone: string;
  path: string;
  mode: "local" | "church";
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (records.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">Wala pang naitatalang Pasalamat.</p>;

  const confirmSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang ipapadala? Hindi na ito puwedeng i-edit ng Local Finance pagkatapos.")) e.preventDefault();
  };
  const confirmVoid = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang i-void ang record na ito? Pinal ito at hindi na maibabalik.")) e.preventDefault();
  };

  return (
    <div className="divide-y divide-gray-100">
      {records.map((r) => {
        const name = names[r.member_id] ?? "(hindi mabasa ang pangalan)";
        const canEdit = r.status === "draft" || (r.status === "submitted" && mode === "church");
        const canSubmit = r.status === "draft";
        const canVoid = r.status === "draft" || (r.status === "submitted" && mode === "church");
        return (
          <div key={r.id} className="py-4">
            {editingId === r.id ? (
              <PasalamatForm
                action={updatePasalamat}
                timezone={timezone}
                path={path}
                edit={{ id: r.id, type: r.type, date: r.date, amount: r.amount, notes: r.notes, memberName: name }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{name}</p>
                  <p className="text-sm text-gray-500">
                    {fmtPeso(r.amount)} · {PASALAMAT_TYPE_LABEL[r.type] ?? r.type} · Ibinigay noong {fmtDatePH(r.date)}
                  </p>
                  {r.notes && <p className="text-sm text-gray-500">Tala: {r.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={r.status} />
                  {canEdit && (
                    <button type="button" className={btnGhostCls} onClick={() => setEditingId(r.id)}>
                      Edit
                    </button>
                  )}
                  {canSubmit && (
                    <form action={submitPasalamat} onSubmit={confirmSubmit}>
                      <input type="hidden" name="path" value={path} />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={btnCls}>
                        Ipadala
                      </button>
                    </form>
                  )}
                  {canVoid && (
                    <form action={voidPasalamat} onSubmit={confirmVoid}>
                      <input type="hidden" name="path" value={path} />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={btnDangerCls}>
                        I-void
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
