"use client";

import { useMemo, useState } from "react";
import { saveMonthlyFinancials } from "@/app/portal/actions";
import { btnCls, inputCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";

type Props = {
  month: string;
  localities: readonly string[];
  localityLabel: Record<string, string>;
  categories: readonly string[];
  categoryLabel: Record<string, string>;
  initial: Record<string, number>; // key = `${locality}_${category}`
  lastUpdated: { at: string; by: string } | null;
};

export function FinanceGrid({
  month,
  localities,
  localityLabel,
  categories,
  categoryLabel,
  initial,
  lastUpdated,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const l of localities) {
      for (const c of categories) {
        const key = `${l}_${c}`;
        v[key] = initial[key] ? String(initial[key]) : "";
      }
    }
    return v;
  });

  const num = (l: string, c: string) => Number(values[`${l}_${c}`]) || 0;

  const localityTotal = (l: string) => categories.reduce((s, c) => s + num(l, c), 0);
  const categoryTotal = (c: string) => localities.reduce((s, l) => s + num(l, c), 0);
  const grandTotal = useMemo(
    () => localities.reduce((s, l) => s + localityTotal(l), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values],
  );

  function onChange(l: string, c: string, v: string) {
    setValues((prev) => ({ ...prev, [`${l}_${c}`]: v }));
  }

  return (
    <form action={saveMonthlyFinancials}>
      <input type="hidden" name="month" value={month} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3">Lokal</th>
              {categories.map((c) => (
                <th key={c} className="py-2 pr-3">
                  {categoryLabel[c]}
                </th>
              ))}
              <th className="py-2 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {localities.map((l) => (
              <tr key={l} className="border-b border-gray-100">
                <td className="py-2 pr-3 font-medium text-gray-800">{localityLabel[l]}</td>
                {categories.map((c) => (
                  <td key={c} className="py-2 pr-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`amt_${l}_${c}`}
                      value={values[`${l}_${c}`]}
                      onChange={(e) => onChange(l, c, e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </td>
                ))}
                <td className="py-2 pr-3 font-semibold text-gray-700">{fmtPeso(localityTotal(l))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
              <td className="py-2 pr-3">Total</td>
              {categories.map((c) => (
                <td key={c} className="py-2 pr-3">
                  {fmtPeso(categoryTotal(c))}
                </td>
              ))}
              <td className="py-2 pr-3">{fmtPeso(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className={btnCls}>
          I-save
        </button>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Huling na-save ni {lastUpdated.by} · {new Date(lastUpdated.at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
          </span>
        )}
      </div>
    </form>
  );
}
