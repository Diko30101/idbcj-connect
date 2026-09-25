"use client";

import { useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { MemberPicker } from "./member-picker";
import { todayInTimezone } from "@/lib/finance";
import { GIVING_NOTES_MAX, PASALAMAT_CUSTOM_LABEL, PASALAMAT_CUSTOM_TYPE, PASALAMAT_TYPES, PASALAMAT_TYPE_LABEL, PASALAMAT_TYPE_MAX, type MemberChoice, type PasalamatType } from "@/lib/giving";

// Form ng Pasalamat (bago o pag-edit ng draft). Walang default na halaga at walang paunang napiling uri.
export function PasalamatForm({
  action,
  timezone,
  path,
  search,
  hidden,
  edit,
  onCancel,
}: {
  action: (fd: FormData) => void;
  timezone: string;
  path: string;
  search?: (q: string) => Promise<MemberChoice[]>; // kailangan sa bagong record
  hidden?: Record<string, string>;
  edit?: { id: string; type: PasalamatType; date: string; amount: number; notes: string | null; memberName: string };
  onCancel?: () => void;
}) {
  const today = todayInTimezone(timezone);
  const [date, setDate] = useState(edit?.date ?? "");
  const future = date !== "" && date > today; // ayon sa oras ng local; ang server at database ang huling harang
  const scope = edit?.id ?? "new";
  // Uri: preset, o "ako ang maglalagay" (custom) na may sariling text input.
  const editIsPreset = edit ? PASALAMAT_TYPES.includes(edit.type) : true;
  const [typeSel, setTypeSel] = useState(edit ? (editIsPreset ? edit.type : PASALAMAT_CUSTOM_TYPE) : "");
  const [customType, setCustomType] = useState(edit && !editIsPreset ? edit.type : "");
  const showCustom = typeSel === PASALAMAT_CUSTOM_TYPE;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="path" value={path} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="sm:col-span-2">
        {edit ? (
          <p className="text-sm text-gray-700">
            Kaanib: <span className="font-semibold">{edit.memberName}</span>{" "}
            <span className="text-xs text-gray-500">(hindi na puwedeng palitan ang kaanib pagkatapos ma-save)</span>
          </p>
        ) : (
          search && <MemberPicker search={search} />
        )}
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Uri ng pasalamat</span>
        <select
          id={`type_${scope}`}
          name="type"
          value={typeSel}
          onChange={(e) => setTypeSel(e.target.value)}
          required
          className={inputCls}
        >
          <option value="" disabled>
            Pumili ng uri…
          </option>
          {PASALAMAT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PASALAMAT_TYPE_LABEL[t]}
            </option>
          ))}
          <option value={PASALAMAT_CUSTOM_TYPE}>{PASALAMAT_CUSTOM_LABEL}…</option>
        </select>
        {showCustom && (
          <input
            type="text"
            id={`custom_type_${scope}`}
            name="custom_type"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            maxLength={PASALAMAT_TYPE_MAX}
            required
            autoComplete="off"
            placeholder="I-type ang uri ng pasalamat"
            className={inputCls}
          />
        )}
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Halaga (₱)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          id={`amount_${scope}`}
          name="amount"
          defaultValue={edit ? String(edit.amount) : undefined}
          required
          autoComplete="off"
          className={inputCls}
        />
        <span className="text-xs text-gray-400">Malaya ang halaga; kahit anong halagang higit sa 0.</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Petsa ng pagbibigay</span>
        <input
          type="date"
          id={`date_${scope}`}
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={today}
          required
          autoComplete="off"
          className={inputCls}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Tala (opsyonal)</span>
        <input
          type="text"
          id={`notes_${scope}`}
          name="notes"
          defaultValue={edit?.notes ?? undefined}
          maxLength={GIVING_NOTES_MAX}
          autoComplete="off"
          className={inputCls}
        />
      </label>

      {future && <p className="sm:col-span-2 text-sm font-medium text-amber-700">Hindi puwedeng nasa hinaharap ang petsa ng pagbibigay.</p>}

      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={btnCls} disabled={future}>
          {edit ? "I-update" : "I-save bilang Draft"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhostCls}>
            Kanselahin
          </button>
        )}
      </div>
    </form>
  );
}
