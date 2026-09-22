"use client";

import { useState } from "react";
import { saveYearlyLocalityFinancials } from "@/app/portal/actions";
import { btnCls, inputCls } from "./form-bits";
import { fmtPeso, monthLabel } from "@/lib/finance";

type Props = {
  year: string;
  locality: string;
  localityLabel: string;
  categories: readonly string[];
  categoryLabel: Record<string, string>;
  initial: Record<string, number>; // key = `${MM}_${category}`
};

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function YearlyLocalityGrid({ year, locality, localityLabel, categories, categoryLabel, initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const mm of MONTHS) {
      for (const c of categories) {
        const key = `${mm}_${c}`;
        v[key] = initial[key] ? String(initial[key]) : "";
      }
    }
    return v;
  });

  const num = (mm: string, c: string) => Number(values[`${mm}_${c}`]) || 0;
  const monthTotal = (mm: string) => categories.reduce((s, c) => s + num(mm, c), 0);
  const catTotal = (c: string) => MONTHS.reduce((s, mm) => s + num(mm, c), 0);
  const grandTotal = MONTHS.reduce((s, mm) => s + monthTotal(mm), 0);

  function onChange(mm: string, c: string, v: string) {
    setValues((prev) => ({ ...prev, [`${mm}_${c}`]: v }));
  }

  return (
    <form action={saveYearlyLocalityFinancials}>
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="locality" value={locality} />
      <p className="mb-3 text-sm text-gray-500">
        Ina-edit: <span className="font-semibold text-gray-700">{localityLabel}</span> · {year}. I-edit ang alinmang
        buwan kung may mali, tapos i-save.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3">Buwan</th>
              {categories.map((c) => (
                <th key={c} className="py-2 pr-3">
                  {categoryLabel[c]}
                </th>
              ))}
              <th className="py-2 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mm) => (
              <tr key={mm} className="border-b border-gray-100">
                <td className="py-2 pr-3 font-medium text-gray-800">{monthLabel(`${year}-${mm}`)}</td>
                {categories.map((c) => (
                  <td key={c} className="py-2 pr-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`amt_${mm}_${c}`}
                      value={values[`${mm}_${c}`]}
                      onChange={(e) => onChange(mm, c, e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </td>
                ))}
                <td className="py-2 pr-3 font-semibold text-gray-700">{fmtPeso(monthTotal(mm))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
              <td className="py-2 pr-3">Total</td>
              {categories.map((c) => (
                <td key={c} className="py-2 pr-3">
                  {fmtPeso(catTotal(c))}
                </td>
              ))}
              <td className="py-2 pr-3">{fmtPeso(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <button type="submit" className={btnCls}>
          I-save ang mga pagbabago
        </button>
      </div>
    </form>
  );
}
