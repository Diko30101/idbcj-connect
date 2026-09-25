"use client";

import { useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { MemberPicker } from "./member-picker";
import { todayInTimezone } from "@/lib/finance";
import { GIVING_NOTES_MAX, type MemberChoice } from "@/lib/giving";

// Form ng Ambagan (bago o pag-edit ng draft). Walang default o placeholder na halaga: ang halaga ay malaya (> 0).
export function AmbaganForm({
  action,
  timezone,
  path,
  search,
  hidden,
  edit,
  onCancel,
  periodLabel = "Buwan ng ambag",
}: {
  action: (fd: FormData) => void;
  timezone: string;
  path: string;
  search?: (q: string) => Promise<MemberChoice[]>; // kailangan sa bagong record
  hidden?: Record<string, string>;
  edit?: { id: string; period_month: string; amount: number; date_received: string; notes: string | null; memberName: string };
  onCancel?: () => void;
  periodLabel?: string; // "Buwan ng tulong" sa Tulong sa Klase Ministeryal (parehong hugis ng record)
}) {
  const today = todayInTimezone(timezone);
  const [date, setDate] = useState(edit?.date_received ?? "");
  const future = date !== "" && date > today; // ayon sa oras ng local; ang server at database ang huling harang
  const scope = edit?.id ?? "new";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="path" value={path} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="sm:col-span-2">
        {edit ? (
          <p className="text-sm text-gray-700">
            Kaanib: <span className="font-semibold">{edit.memberName}</span>{" "}
            <span className="text-xs text-gray-500">(para magpalit ng kaanib, gumawa ng bagong record)</span>
          </p>
        ) : (
          search && <MemberPicker search={search} />
        )}
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">{periodLabel}</span>
        <input
          type="month"
          id={`period_month_${scope}`}
          name="period_month"
          defaultValue={edit ? edit.period_month.slice(0, 7) : ""}
          required
          autoComplete="off"
          className={inputCls}
        />
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
        <span className="text-sm font-medium text-gray-700">Petsa ng pagtanggap</span>
        <input
          type="date"
          id={`date_received_${scope}`}
          name="date_received"
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

      {future && <p className="sm:col-span-2 text-sm font-medium text-amber-700">Hindi puwedeng nasa hinaharap ang petsa ng pagtanggap.</p>}

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
