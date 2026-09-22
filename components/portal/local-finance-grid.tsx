"use client";

import { useState } from "react";
import { saveLocalFinancials } from "@/app/portal/actions";
import { btnCls, inputCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";

type Props = {
  month: string;
  localityLabel: string;
  categories: readonly string[];
  categoryLabel: Record<string, string>;
  initial: Record<string, number>; // key = category
  lastUpdated: { at: string; by: string } | null;
};

export function LocalFinanceGrid({ month, localityLabel, categories, categoryLabel, initial, lastUpdated }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of categories) v[c] = initial[c] ? String(initial[c]) : "";
    return v;
  });

  const total = categories.reduce((s, c) => s + (Number(values[c]) || 0), 0);

  return (
    <form action={saveLocalFinancials}>
      <input type="hidden" name="month" value={month} />
      <p className="mb-3 text-sm text-gray-500">
        Lokal: <span className="font-semibold text-gray-700">{localityLabel}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <label key={c} className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">{categoryLabel[c]}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name={`amt_${c}`}
              value={values[c]}
              onChange={(e) => setValues((prev) => ({ ...prev, [c]: e.target.value }))}
              placeholder="0.00"
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold text-gray-800">Total: {fmtPeso(total)}</span>
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
