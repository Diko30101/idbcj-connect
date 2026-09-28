"use client";

import { useMemo, useState } from "react";
import { btnCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";

export type GridExisting = { member_id: string; date_received: string; amount: number; status: string };

const TAGALOG_MONTHS_SHORT = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];

// "Set 6" mula sa "2026-09-06"
function fmtSundayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${TAGALOG_MONTHS_SHORT[(m ?? 1) - 1] ?? ""} ${d ?? ""}`;
}

// Grid na pag-encode ng Ambagan: Pangalan (unang column, laman na agad mula sa roster ng local) ×
// Linggo I–V (blangkong column, direktang i-type ang halaga). Awtomatiko ang Total bawat kaanib at
// bawat Linggo. Blangkong cell = walang record na gagawin (hindi paglabag). Ang cell na may kasama
// nang naipadalang record (hindi na "draft") ay naka-lock — kulay-abo, hindi na mababago dito.
export function AmbaganGridForm({
  action,
  path,
  hidden,
  periodMonth,
  members,
  sundays,
  existing,
}: {
  action: (fd: FormData) => void;
  path: string;
  hidden?: Record<string, string>;
  periodMonth: string; // YYYY-MM
  members: { id: string; full_name: string }[];
  sundays: string[];
  existing: GridExisting[];
}) {
  const byKey = useMemo(() => {
    const m = new Map<string, GridExisting>();
    for (const e of existing) m.set(`${e.member_id}::${e.date_received}`, e);
    return m;
  }, [existing]);

  // Estado ng mga cell (client lang, para sa live na Total) — sinisimulan mula sa existing na datos.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of members) {
      for (const d of sundays) {
        const key = `${m.id}::${d}`;
        const e = byKey.get(key);
        if (e) init[key] = String(e.amount);
      }
    }
    return init;
  });

  const setCell = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const rowTotal = (memberId: string) =>
    sundays.reduce((s, d) => {
      const v = Number(values[`${memberId}::${d}`]);
      return s + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  const colTotal = (date: string) =>
    members.reduce((s, m) => {
      const v = Number(values[`${m.id}::${date}`]);
      return s + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  const grandTotal = members.reduce((s, m) => s + rowTotal(m.id), 0);

  const th = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600";
  const thRight =
    "border border-gray-300 bg-gray-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap";
  const td = "border border-gray-200 px-1.5 py-1 text-sm text-gray-800";
  const tdInput = "border border-gray-200 p-0.5";
  const tdRight = "border border-gray-200 px-2 py-1 text-right text-sm tabular-nums text-gray-800";

  if (members.length === 0) {
    return <p className="text-sm text-gray-500">Walang kaanib na tumatanggap ng Ambagan sa local na ito.</p>;
  }
  if (sundays.length === 0) {
    return <p className="text-sm text-gray-500">Walang Linggo sa buwang napili.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="period_month" value={periodMonth} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Pangalan</th>
              {sundays.map((d, i) => (
                <th key={d} className={thRight}>
                  {["I", "II", "III", "IV", "V"][i] ?? i + 1}
                  <span className="block font-normal normal-case text-[10px] text-gray-400">{fmtSundayLabel(d)}</span>
                </th>
              ))}
              <th className={thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className={td}>{m.full_name}</td>
                {sundays.map((d) => {
                  const key = `${m.id}::${d}`;
                  const e = byKey.get(key);
                  const locked = e && e.status !== "draft";
                  return (
                    <td key={d} className={tdInput}>
                      {locked ? (
                        <div
                          className="px-1.5 py-1 text-right text-sm tabular-nums text-gray-500"
                          title="Naipadala na — hindi na mababago dito"
                        >
                          {fmtPeso(e!.amount)}
                        </div>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name={`amt__${key}`}
                          value={values[key] ?? ""}
                          onChange={(ev) => setCell(key, ev.target.value)}
                          placeholder="—"
                          autoComplete="off"
                          className="w-full rounded border-0 bg-transparent px-1.5 py-1 text-right text-sm tabular-nums focus:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      )}
                    </td>
                  );
                })}
                <td className={tdRight}>{rowTotal(m.id) > 0 ? fmtPeso(rowTotal(m.id)) : "—"}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} bg-gray-50 font-semibold`}>Kabuuan bawat Linggo</td>
              {sundays.map((d) => (
                <td key={d} className={`${tdRight} bg-gray-50 font-semibold`}>
                  {fmtPeso(colTotal(d))}
                </td>
              ))}
              <td className="border border-gray-200 bg-emerald-100 px-2 py-1 text-right text-sm font-bold tabular-nums text-emerald-950 [print-color-adjust:exact]">
                {fmtPeso(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnCls}>
          I-save ang mga Draft
        </button>
        <p className="text-xs text-gray-500">
          Blangko = walang record. Ang naka-lock na cell (kulay-abo) ay naipadala na — hindi na ito mababago dito.
        </p>
      </div>
    </form>
  );
}
