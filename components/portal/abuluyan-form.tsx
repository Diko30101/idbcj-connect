"use client";

import { useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { isSunday, todayInTimezone } from "@/lib/finance";

type Props = {
  action: (fd: FormData) => void;
  timezone: string;
  path: string; // saan babalik pagkatapos (sinusuri ng server)
  id?: string;
  defaultDate?: string;
  defaultAmount?: string;
  lockDate?: boolean; // para sa kapalit na record: ang Linggo ay ang sa void
  hidden?: Record<string, string>; // hal. local_id, replaces_id
  submitLabel?: string;
  onCancel?: () => void;
};

export function AbuluyanForm({
  action,
  timezone,
  path,
  id,
  defaultDate,
  defaultAmount,
  lockDate,
  hidden,
  submitLabel = "I-save bilang Draft",
  onCancel,
}: Props) {
  const today = todayInTimezone(timezone);
  const [date, setDate] = useState(defaultDate ?? "");
  const [amount, setAmount] = useState(defaultAmount ?? "");
  const sunday = date === "" || isSunday(date);
  const future = date !== "" && date > today; // ayon sa oras ng local; ang database ang huling harang
  // `id` HTML attribute (hindi `name`) para hindi mapagkamalan ng autofill ang field ng ibang instance sa page.
  const scope = id ?? hidden?.replaces_id ?? "new";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,auto)_minmax(0,auto)_auto] sm:items-end">
      <input type="hidden" name="path" value={path} />
      {id && <input type="hidden" name="id" value={id} />}
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Petsa ng Paglilingkod (Linggo)</span>
        <input
          type="date"
          id={`service_date_${scope}`}
          name="service_date"
          autoComplete="off"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          readOnly={lockDate}
          className={inputCls}
          required
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Kabuuang Abuluyan (₱)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          id={`total_amount_${scope}`}
          name="total_amount"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCls}
        />
        <span className="text-xs text-gray-400">Puwedeng blangko sa draft; kailangan bago i-submit (0 ay wasto).</span>
      </label>
      <div className="flex gap-2">
        <button type="submit" className={btnCls} disabled={!sunday || future || date === ""}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhostCls}>
            Kanselahin
          </button>
        )}
      </div>
      {!sunday && (
        <p className="sm:col-span-3 text-sm font-medium text-amber-700">
          Ang Abuluyan ay ini-e-encode lamang tuwing Linggo, araw ng pagsamba — ang napiling petsa (
          {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "long" })}) ay hindi
          Linggo. Pumili ng petsang Linggo para makapag-save.
        </p>
      )}
      {future && (
        <p className="sm:col-span-3 text-sm font-medium text-amber-700">
          Hindi puwedeng nasa hinaharap ang petsa (ayon sa oras ng local).
        </p>
      )}
    </form>
  );
}
