"use client";

import { useState } from "react";
import { updateService, deleteService } from "@/app/portal/actions";
import { Field, btnCls, btnDangerCls, btnGhostCls, inputCls } from "./form-bits";

type Service = { id: string; service_date: string; kind: string; title: string | null };

export function ServiceControls({
  service,
  kindOptions,
}: {
  service: Service;
  kindOptions: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <form action={updateService} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <input type="hidden" name="id" value={service.id} />
        <Field label="Petsa">
          <input type="date" name="service_date" defaultValue={service.service_date.slice(0, 10)} required className={inputCls} />
        </Field>
        <Field label="Uri">
          <select name="kind" defaultValue={service.kind} className={inputCls}>
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pamagat (opsyonal)">
          <input name="title" defaultValue={service.title ?? ""} className={inputCls} />
        </Field>
        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" className={btnCls}>
            I-save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={btnGhostCls}>
            Kanselahin
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className={btnGhostCls}>
        I-edit ang detalye
      </button>
      {!confirmingDelete ? (
        <button type="button" onClick={() => setConfirmingDelete(true)} className={btnDangerCls}>
          Burahin ang serbisyo
        </button>
      ) : (
        <form action={deleteService} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={service.id} />
          <span className="text-xs font-medium text-red-700">
            Buburahin din ang lahat ng naitalang attendance dito. Sigurado ka ba?
          </span>
          <button type="submit" className={btnDangerCls}>
            Oo, burahin
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} className={btnGhostCls}>
            Huwag
          </button>
        </form>
      )}
    </div>
  );
}
