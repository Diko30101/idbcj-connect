"use client";

import { useState } from "react";
import { updateMinistry, deleteMinistry } from "@/app/portal/actions";
import { Field, btnCls, btnDangerCls, btnGhostCls, inputCls } from "./form-bits";

type Ministry = { id: string; name: string; name_tl: string | null; description: string | null };

export function MinistryControls({ ministry }: { ministry: Ministry }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <form action={updateMinistry} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="id" value={ministry.id} />
        <Field label="Pangalan (English)">
          <input name="name" defaultValue={ministry.name} required className={inputCls} />
        </Field>
        <Field label="Pangalan (Tagalog, opsyonal)">
          <input name="name_tl" defaultValue={ministry.name_tl ?? ""} className={inputCls} />
        </Field>
        <Field label="Paglalarawan (opsyonal)">
          <textarea name="description" defaultValue={ministry.description ?? ""} rows={3} className={inputCls} />
        </Field>
        <div className="flex gap-2">
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
        I-edit ang ministry
      </button>
      {!confirmingDelete ? (
        <button type="button" onClick={() => setConfirmingDelete(true)} className={btnDangerCls}>
          Burahin ang ministry
        </button>
      ) : (
        <form action={deleteMinistry} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={ministry.id} />
          <span className="text-xs font-medium text-red-700">
            Buburahin din ang mga miyembro, iskedyul, at anunsyo nitong ministry. Sigurado ka ba?
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
