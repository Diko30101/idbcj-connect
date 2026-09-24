"use client";

import { useState, type FormEvent } from "react";
import { AmbaganForm } from "./ambagan-form";
import { btnCls, btnDangerCls, btnGhostCls } from "./form-bits";
import { updateAmbagan } from "@/app/portal/finance/ambagan/actions";
import { fmtPeso, monthLabel } from "@/lib/finance";
import { GIVING_STATUS_LABEL, type AmbaganRecord, type GivingStatus } from "@/lib/giving";

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

// mode "local": Local Finance; mode "church": church-wide Finance.
// Walang indibidwal na Ipadala at walang I-void: draft ang pag-iipon,
// at isang bulk na "Ipadala lahat" ang nagpapadala nang sabay-sabay.
type ActionFn = (fd: FormData) => void | Promise<void>;

// Ginagamit din ng Tulong sa Klase Ministeryal (parehong hugis ng record): ibinibigay ang sariling mga action at label.
export function AmbaganList({
  records,
  names,
  timezone,
  path,
  mode,
  actions,
  labels,
  bulkSubmitAll,
  bulkLocalId,
  bulkItemLabel,
}: {
  records: AmbaganRecord[];
  names: Record<string, string>;
  timezone: string;
  path: string;
  mode: "local" | "church";
  actions?: { update: ActionFn; submit?: ActionFn; void?: ActionFn };
  labels?: { monthPhrase: string; empty: string; periodLabel?: string };
  bulkSubmitAll?: { action: ActionFn; label: string };
  bulkLocalId?: string;
  bulkItemLabel?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const act = actions ?? { update: updateAmbagan };
  const L = labels ?? { monthPhrase: "Ambag para sa", empty: "Wala pang naitatalang Ambagan." };
  const itemLabel = bulkItemLabel ?? "Ambagan";

  if (records.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">{L.empty}</p>;

  const draftCount = records.filter((r) => r.status === "draft").length;

  const confirmSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang ipapadala? Hindi na ito puwedeng i-edit ng Local Finance pagkatapos.")) e.preventDefault();
  };
  const confirmVoid = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang i-void ang record na ito? Pinal ito at hindi na maibabalik.")) e.preventDefault();
  };
  const confirmBulkSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (
      !window.confirm(
        `Sigurado ka bang ipapadala ang lahat ng ${draftCount} draft na ${itemLabel}? Hindi na ito puwedeng i-edit ng Local Finance pagkatapos.`,
      )
    )
      e.preventDefault();
  };

  return (
    <>
      {bulkSubmitAll && draftCount > 0 && (
        <form
          action={bulkSubmitAll.action}
          onSubmit={confirmBulkSubmit}
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3"
        >
          <p className="text-sm text-emerald-800">
            <strong>{draftCount}</strong> draft na {itemLabel} ang naghihintay. Ipadala ang lahat nang sabay-sabay.
          </p>
          <input type="hidden" name="path" value={path} />
          {bulkLocalId && <input type="hidden" name="local_id" value={bulkLocalId} />}
          <button type="submit" className={btnCls}>
            {bulkSubmitAll.label}
          </button>
        </form>
      )}
      <div className="divide-y divide-gray-100">
      {records.map((r) => {
        const name = names[r.member_id] ?? "(hindi mabasa ang pangalan)";
        const canEdit = r.status === "draft" || (r.status === "submitted" && mode === "church");
        const canSubmit = r.status === "draft" && !!act.submit;
        const canVoid = (r.status === "draft" || (r.status === "submitted" && mode === "church")) && !!act.void;
        return (
          <div key={r.id} className="py-4">
            {editingId === r.id ? (
              <AmbaganForm
                action={act.update}
                periodLabel={L.periodLabel}
                timezone={timezone}
                path={path}
                edit={{ id: r.id, period_month: r.period_month, amount: r.amount, date_received: r.date_received, notes: r.notes, memberName: name }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{name}</p>
                  <p className="text-sm text-gray-500">
                    {fmtPeso(r.amount)} · {L.monthPhrase} {monthLabel(r.period_month.slice(0, 7))} · Natanggap noong {fmtDatePH(r.date_received)}
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
                  {canSubmit && act.submit && (
                    <form action={act.submit} onSubmit={confirmSubmit}>
                      <input type="hidden" name="path" value={path} />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={btnCls}>
                        Ipadala
                      </button>
                    </form>
                  )}
                  {canVoid && act.void && (
                    <form action={act.void} onSubmit={confirmVoid}>
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
    </>
  );
}
