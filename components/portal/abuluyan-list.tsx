"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AbuluyanForm } from "./abuluyan-form";
import { AbuluyanVoidForm } from "./abuluyan-void-form";
import { updateAbuluyanDraft, submitAbuluyan, submitManyAbuluyan, deleteAbuluyanDraft, createAbuluyan } from "@/app/portal/finance/abuluyan/actions";
import { btnCls, btnDangerCls, btnGhostCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";
import { ABULUYAN_STATUS_LABEL, type AbuluyanRecord, type AbuluyanStatus } from "@/lib/abuluyan";

function fmtDatePH(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusPill({ status }: { status: AbuluyanStatus }) {
  const cls =
    status === "draft"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : status === "submitted"
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : "bg-red-50 text-red-700 border-red-100";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {ABULUYAN_STATUS_LABEL[status]}
    </span>
  );
}

// mode "local": Local Finance (draft nila lang ang mae-edit/mabubura; ang kapalit na draft ay read-only).
// mode "church": church-wide Finance (edit/submit/bura ng draft, i-void ang naipadala, gumawa ng kapalit sa void).
export function AbuluyanList({
  records,
  timezone,
  path,
  mode,
}: {
  records: AbuluyanRecord[];
  timezone: string;
  path: string;
  mode: "local" | "church";
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Maramihang pagpapadala: checkbox sa bawat draft na puwedeng ipadala + "piliin lahat".
  // Ang kapalit na draft ay church-wide Finance lang ang makapagpapadala (gaya ng isahang Ipadala).
  const canSubmitRow = (r: AbuluyanRecord) => r.status === "draft" && (mode === "church" || r.replaces_id === null);
  const submittable = records.filter(canSubmitRow);
  const [selected, setSelected] = useState<string[]>([]);
  const draftKey = submittable.map((d) => d.id).join(",");
  useEffect(() => {
    const valid = new Set(draftKey.split(",").filter(Boolean));
    setSelected((prev) => prev.filter((id) => valid.has(id)));
  }, [draftKey]);
  const allSelected = submittable.length > 0 && selected.length === submittable.length;
  const toggleAll = () => setSelected(allSelected ? [] : submittable.map((d) => d.id));
  const toggleOne = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (records.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">Wala pang naitatalang Abuluyan.</p>;

  function confirmSubmit(e: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Sigurado ka bang ipapadala? Hindi na ito puwedeng i-edit pagkatapos.")) {
      e.preventDefault();
    }
  }

  function confirmDelete(e: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Sigurado ka bang buburahin ang draft na ito? Hindi na ito maibabalik.")) {
      e.preventDefault();
    }
  }

  function confirmBulk(e: FormEvent<HTMLFormElement>) {
    if (selected.length === 0) {
      e.preventDefault();
      return;
    }
    if (!window.confirm(`Ipapadala ang ${selected.length} Abuluyan record? Hindi na ang mga ito puwedeng i-edit pagkatapos.`)) {
      e.preventDefault();
    }
  }

  const activeAt = (r: AbuluyanRecord) =>
    records.some((x) => x.local_id === r.local_id && x.service_date === r.service_date && x.status !== "void");

  return (
    <>
      {submittable.length > 0 && (
        <form
          action={submitManyAbuluyan}
          onSubmit={confirmBulk}
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-emerald-50/70 px-3 py-2.5"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Piliin lahat ng draft na Abuluyan"
              className="h-4 w-4 accent-emerald-700"
            />
            Piliin lahat ({submittable.length})
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
        const isReplacement = r.replaces_id !== null;
        const canEdit = r.status === "draft" && (mode === "church" || !isReplacement);
        const canDelete = canEdit;
        return (
          <div key={r.id} className="py-4">
            {editingId === r.id ? (
              <AbuluyanForm
                action={updateAbuluyanDraft}
                timezone={timezone}
                path={path}
                id={r.id}
                defaultDate={r.service_date}
                defaultAmount={r.total_amount === null ? "" : String(r.total_amount)}
                lockDate={isReplacement}
                submitLabel="I-update"
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {canSubmitRow(r) && (
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Piliin ang Abuluyan noong ${r.service_date}`}
                      className="h-4 w-4 shrink-0 accent-emerald-700"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800">{fmtDatePH(r.service_date)}</p>
                    <p className="text-sm text-gray-500">
                      {r.total_amount === null ? "Wala pang halaga" : fmtPeso(r.total_amount)}
                      {isReplacement && " · Kapalit ng na-void na record"}
                    </p>
                    {r.status === "void" && r.void_reason && (
                      <p className="text-sm text-red-600">Dahilan ng void: {r.void_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    {canEdit && (
                      <>
                        <button type="button" className={btnGhostCls} onClick={() => setEditingId(r.id)}>
                          Edit
                        </button>
                        <form action={submitAbuluyan} onSubmit={confirmSubmit}>
                          <input type="hidden" name="path" value={path} />
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className={btnCls}>
                            Ipadala
                          </button>
                        </form>
                        {canDelete && (
                          <form action={deleteAbuluyanDraft} onSubmit={confirmDelete}>
                            <input type="hidden" name="path" value={path} />
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className={btnDangerCls}>
                              Burahin
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {r.status === "draft" && isReplacement && mode === "local" && (
                  <p className="text-sm text-gray-500">Church-wide Finance ang nag-e-edit at nagpapadala ng kapalit na record.</p>
                )}
                {mode === "church" && r.status === "submitted" && (
                  <AbuluyanVoidForm path={path} localId={r.local_id} serviceDate={r.service_date} />
                )}
                {r.status === "void" && !activeAt(r) && (
                  <div>
                    {mode === "church" ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-emerald-700">Gumawa ng kapalit na record</summary>
                        <div className="mt-3">
                          <AbuluyanForm
                            action={createAbuluyan}
                            timezone={timezone}
                            path={path}
                            defaultDate={r.service_date}
                            lockDate
                            hidden={{ local_id: r.local_id, replaces_id: r.id }}
                            submitLabel="I-save ang kapalit (Draft)"
                          />
                        </div>
                      </details>
                    ) : (
                      <p className="text-sm text-gray-500">Na-void ang record na ito. Hintayin ang church-wide Finance para sa kapalit.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
