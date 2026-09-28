"use client";

import { useMemo, useState } from "react";
import { btnCls, inputCls } from "./form-bits";
import { fmtPeso, monthLabel } from "@/lib/finance";
import type { SugoChoice } from "@/lib/abuluyan";

export type AbuluyanGridExisting = {
  service_date: string;
  total_amount: number | null;
  sugo_id: string | null;
  status: string;
};

const TAGALOG_MONTHS_SHORT = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];

function fmtSundayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${TAGALOG_MONTHS_SHORT[(m ?? 1) - 1] ?? ""} ${d ?? ""}`;
}

// Grid na pag-encode ng Abuluyan, sundan ang eksaktong disenyo ng papel na template
// (public/Pagsamba.pdf): LOKAL/BUWAN-TAON na label sa itaas, isang hanay bawat Linggo ng buwan,
// blangkong Halaga at Sugo (parehong nasa orihinal na papel na proseso). Awtomatiko ang Total.
// Ang Linggong may kasama nang naipadalang record ay naka-lock — kulay-abo, hindi na mababago dito.
export function AbuluyanGridForm({
  action,
  path,
  hidden,
  buwan,
  localName,
  sundays,
  existing,
  sugoChoices,
}: {
  action: (fd: FormData) => void;
  path: string;
  hidden?: Record<string, string>;
  buwan: string; // YYYY-MM
  localName: string;
  sundays: string[];
  existing: AbuluyanGridExisting[];
  sugoChoices: SugoChoice[];
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, AbuluyanGridExisting>();
    for (const e of existing) m.set(e.service_date, e);
    return m;
  }, [existing]);

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const d of sundays) {
      const e = byDate.get(d);
      if (e && e.total_amount !== null) init[d] = String(e.total_amount);
    }
    return init;
  });

  const grandTotal = sundays.reduce((s, d) => {
    const v = Number(amounts[d]);
    return s + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  const th = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600";
  const td = "border border-gray-200 px-2 py-1 text-sm text-gray-800";
  const tdInput = "border border-gray-200 p-0.5";

  if (sundays.length === 0) {
    return <p className="text-sm text-gray-500">Walang Linggo sa buwang napili.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="buwan" value={buwan} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="flex flex-wrap gap-x-8 gap-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <div>
          <span className="font-semibold uppercase tracking-wide text-gray-600">Lokal:</span>{" "}
          <span className="font-medium text-gray-900">{localName}</span>
        </div>
        <div>
          <span className="font-semibold uppercase tracking-wide text-gray-600">Buwan/Taon:</span>{" "}
          <span className="font-medium text-gray-900">{monthLabel(buwan)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Linggo</th>
              <th className={th}>Sugo</th>
              <th className={th}>Halaga</th>
            </tr>
          </thead>
          <tbody>
            {sundays.map((d) => {
              const e = byDate.get(d);
              const locked = e && e.status !== "draft";
              return (
                <tr key={d}>
                  <td className={td}>{fmtSundayLabel(d)}</td>
                  <td className={tdInput}>
                    {locked ? (
                      <div className="px-1.5 py-1 text-sm text-gray-500">
                        {sugoChoices.find((s) => s.id === e!.sugo_id)?.full_name ?? "—"}
                      </div>
                    ) : (
                      <select name={`sugo__${d}`} defaultValue={e?.sugo_id ?? ""} className={inputCls}>
                        <option value="">— Walang Sugo —</option>
                        {sugoChoices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className={tdInput}>
                    {locked ? (
                      <div className="px-1.5 py-1 text-right text-sm tabular-nums text-gray-500" title="Naipadala na — hindi na mababago dito">
                        {e!.total_amount === null ? "—" : fmtPeso(e!.total_amount)}
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`amt__${d}`}
                        value={amounts[d] ?? ""}
                        onChange={(ev) => setAmounts((prev) => ({ ...prev, [d]: ev.target.value }))}
                        placeholder="—"
                        autoComplete="off"
                        className="w-full rounded border-0 bg-transparent px-1.5 py-1 text-right text-sm tabular-nums focus:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className={`${td} bg-gray-50 font-semibold`} colSpan={2}>
                TOTAL
              </td>
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
          Blangko = walang record. Ang naka-lock na Linggo (kulay-abo) ay naipadala na — hindi na mababago dito.
        </p>
      </div>
    </form>
  );
}
