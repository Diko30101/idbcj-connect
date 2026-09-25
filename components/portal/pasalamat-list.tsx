"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PasalamatForm } from "./pasalamat-form";
import { btnCls, btnGhostCls } from "./form-bits";
import { updatePasalamat, submitPasalamat, submitManyPasalamat } from "@/app/portal/finance/pasalamat/actions";
import { fmtPeso } from "@/lib/finance";
import { GIVING_STATUS_LABEL, pasalamatTypeLabel, type GivingStatus, type PasalamatRecord } from "@/lib/giving";

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

// mode "local": Local Finance (draft lang ang mae-edit/mapapadala nila).
// mode "church": church-wide Finance (maaari ring mag-edit ng naipadala).
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

  // Maramihang pagpapadala: checkbox sa bawat draft + "piliin lahat".
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

  if (records.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">Wala pang naitatalang Pasalamat.</p>;

  const confirmSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Sigurado ka bang ipapadala? Hindi na ito puwedeng i-edit ng Local Finance pagkatapos.")) e.preventDefault();
  };
  const confirmBulk = (e: FormEvent<HTMLFormElement>) => {
    if (selected.length === 0) {
      e.preventDefault();
      return;
    }
    if (!window.confirm(`Ipapadala ang ${selected.length} Pasalamat? Hindi na ang mga ito puwedeng i-edit ng Local Finance pagkatapos.`))
      e.preventDefault();
  
};

  return (
    <>
      {drafts.length > 0 && (
        <form
          action={submitManyPasalamat}
          onSubmit={confirmBulk}
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-emerald-50/70 px-3 py-2.5"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Piliin lahat ng draft na Pasalamat"
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
        const canSubmit = r.status === "draft";
      
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
                {r.status === "draft" && (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Piliin ang Pasalamat ni ${name}`}
                    className="h-4 w-4 shrink-0 accent-emerald-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800">{name}</p>
                  <p className="text-sm text-gray-500">
                    {fmtPeso(r.amount)} · {pasalamatTypeLabel(r.type)} · Ibinigay noong {fmtDatePH(r.date)}
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
