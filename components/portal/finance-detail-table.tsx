"use client";

import { useMemo, useState } from "react";
import { inputCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";
import type { CollectionRow } from "@/lib/finance-collections";
import type { Locality } from "@/lib/locality";
import type { FinanceCategory } from "@/lib/finance";

const MAX_SHOW = 300;

// "2026-09-06" -> "Sep 6, 2026" (parehong format ng fmtDate sa lib/portal.ts, pero purong client-safe
// -- walang import na server-only, kaya puwedeng gamitin dito).
function fmtDatePH(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Search bar ng Detalyadong talaan (Financial Management): sa halip na palabasin agad ang lahat ng
// naipadalang record ng buong taon (nakakahaba ng page), blangko muna ang listahan hanggang may
// ilagay na paghahanap -- petsa, lokal, at/o kategorya, kahit alin sa tatlo o kombinasyon.
export function FinanceDetailTable({
  rows,
  localityLabel,
  categoryLabel,
}: {
  rows: CollectionRow[];
  localityLabel: Record<Locality, string>;
  categoryLabel: Record<FinanceCategory, string>;
}) {
  const [q, setQ] = useState("");

  const enriched = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category))
        .map((r) => {
          const localText = r.locality ? localityLabel[r.locality] : (r.localKey ?? "—");
          const dateText = fmtDatePH(r.date);
          const catText = categoryLabel[r.category];
          return {
            ...r,
            localText,
            dateText,
            catText,
            search: `${dateText} ${r.date} ${localText} ${catText}`.toLowerCase(),
          };
        }),
    [rows, localityLabel, categoryLabel],
  );

  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matched = tokens.length === 0 ? [] : enriched.filter((r) => tokens.every((t) => r.search.includes(t)));
  const shown = matched.slice(0, MAX_SHOW);
  const total = matched.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <label className="mb-4 block max-w-sm">
        <span className="mb-1 block text-sm font-medium text-gray-700">Maghanap (petsa, lokal, o kategorya)</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="hal. Set 2026, Fort Mcmurray, Ambagan"
          autoComplete="off"
          className={inputCls}
        />
      </label>

      {tokens.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
          Maglagay ng petsa, lokal, o kategorya sa itaas para makita ang detalyadong tala.
        </p>
      ) : matched.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
          Walang natagpuang tala na tumugma sa &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Petsa</th>
                <th className="py-2 pr-3">Lokal</th>
                <th className="py-2 pr-3">Kategorya</th>
                <th className="py-2 pr-3">Halaga</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={`${r.date}-${r.category}-${r.localKey ?? "x"}-${i}`} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-700">{r.dateText}</td>
                  <td className="py-2 pr-3 text-gray-700">{r.localText}</td>
                  <td className="py-2 pr-3 text-gray-700">{r.catText}</td>
                  <td className="py-2 pr-3 text-gray-700">{fmtPeso(r.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                <td className="py-2 pr-3" colSpan={3}>
                  Total ({matched.length} tala
                  {matched.length > MAX_SHOW ? ` · unang ${MAX_SHOW} lang ang ipinapakita` : ""})
                </td>
                <td className="py-2 pr-3">{fmtPeso(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
