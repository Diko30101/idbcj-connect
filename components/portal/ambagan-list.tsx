"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AmbaganForm } from "./ambagan-form";
import { btnCls, btnGhostCls } from "./form-bits";
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
// Gaya ng Abuluyan: checkbox sa bawat draft + "piliin lahat" + "ipadala ang napili",
// at indibidwal na Edit at Ipadala sa bawat draft. Walang I-void.
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
  submitMany,
  bulkItemLabel,
}: {
  records: AmbaganRecord[];
  names: Record<string, string>;
  timezone: string;
  path: string;
  mode: "local" | "church";
  actions?: { update: ActionFn; submit?: ActionFn };
  labels?: { monthPhrase: string; empty: string; periodLabel?: string };
  submitMany?: { action: ActionFn };
  bulkItemLabel?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const act = actions ?? { update: updateAmbagan };
  const L = labels ?? { monthPhrase: "Ambag para sa", empty: "Wala pang naitatalang Ambagan." };
  const itemLabel = bulkItemLabel ?? "Ambagan";

  // Maramihang pagpapadala: checkbox sa bawat draft + "piliin lahat" (gaya ng Abuluyan).
  const drafts = records.filter((r) => r.status === "draft");
  const [selected, setSelected] = useState<string[]>([]);
  const draftKey = drafts.map((d) => d.id).join(",");
  useEffect(() => {
    const valid = new Set(draftKey.split(",").filter(Boolean));
    setSelected((prev) => prev.filter((id) => valid.has(id)));
  }, [draftKey]);
  const allSelected = drafts.length > 0 && selected.length === drafts.length;
  const toggleAll = () => setSelected(allSelected ? [] : drafts.map((d) => d.id));
  const toggleOne = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (records.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">{L.empty}</p>;

  const confirmSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang ipapadala? Hindi na ito puwedeng i-edit ng Local Finance pagkatapos.")) e.preventDefault();
  };
  const confirmBulk = (e: FormEvent<HTMLFormElement>) => {
    if (selected.length === 0) {
      e.preventDefault();
      return;
    }
    if (!window.confirm(`Ipapadala ang ${selected.length} ${itemLabel}? Hindi na ang mga ito puwedeng i-edit ng Local Finance pagkatapos.`))
      e.preventDefault();
  };

  return (
    <>
      {submitMany && drafts.length > 0 && (
        <form
          action={submitMany.action}
          onSubmit={confirmBulk}
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-emerald-50/70 px-3 py-2.5"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label={`Piliin lahat ng draft na ${itemLabel}`}
              className="h-4 w-4 accent-emerald-700"
            />
            Piliin lahat ({drafts.length})
          </label>
          <span className="text-xs text-gray-500">{selected.length} napili</span>
          {selected.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <input type="hidden" name="path" value={path} />
          <button type="submit" className={btnCls} disabled={selected.length === 0}>
            Ipadala ang napili{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
        </form>
      )}
      <div className="divide-y divide-gray-100">
      {records.map((r) => {
        const name = names[r.member_id] ?? "(hindi mabasa ang pangalan)";
        const canEdit = r.status === "draft" || (r.status === "submitted" && mode === "church");
        const canSubmit = r.status === "draft" && !!act.submit;
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
                {r.status === "draft" && (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Piliin ang ${itemLabel} ni ${name}`}
                    className="h-4 w-4 shrink-0 accent-emerald-700"
                  />
                )}
                <div className="min-w-0 flex-1">
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
