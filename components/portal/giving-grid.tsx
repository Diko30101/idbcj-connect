"use client";

import { fmtPeso } from "@/lib/finance";
import type { AmbaganRecord } from "@/lib/giving";

// Linggo I–V ng buwan batay sa araw: 1–7=I, 8–14=II, 15–21=III, 22–28=IV, 29+=V.
// Parehong batayan ng grid sa Buwanang Resibo (lib/resibo.ts groupAmbaganByMember).
function weekIndexOfMonth(dateStr: string): number {
  const day = Number(dateStr.slice(8, 10));
  return Math.min(5, Math.max(1, Math.ceil(day / 7))) - 1;
}

// Buod na view (Pangalan × Linggo I–V, o Pangalan | Halaga) sa ibabaw ng detalyadong listahan,
// para makita agad ng Local Finance ang hitsura ng datos tulad ng opisyal na papel na Ambagan/Aral
// habang nag-e-encode. Kasama ang draft at naipadala (hindi kasama ang void). Ang mga aksyon
// (edit/ipadala/i-void) ay nasa detalyadong listahan pa rin sa ibaba.
export function GivingGrid({
  records,
  names,
  mode,
}: {
  records: AmbaganRecord[];
  names: Record<string, string>;
  mode: "weekly" | "simple";
}) {
  const active = records.filter((r) => r.status !== "void");
  if (active.length === 0) return null;

  const byMember = new Map<string, { name: string; weeks: number[]; total: number; hasDraft: boolean }>();
  for (const r of active) {
    const name = names[r.member_id] ?? "(hindi mabasa ang pangalan)";
    const entry = byMember.get(r.member_id) ?? { name, weeks: [0, 0, 0, 0, 0], total: 0, hasDraft: false };
    if (mode === "weekly") entry.weeks[weekIndexOfMonth(r.date_received)] += r.amount;
    entry.total += r.amount;
    if (r.status === "draft") entry.hasDraft = true;
    byMember.set(r.member_id, entry);
  }
  const rows = [...byMember.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name, "fil"));

  const th = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
  const thRight = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600";
  const td = "border border-gray-200 px-2 py-1 text-sm text-gray-800";
  const tdRight = "border border-gray-200 px-2 py-1 text-right text-sm tabular-nums text-gray-800";

  return (
    <div className="mb-5 overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Pangalan</th>
            {mode === "weekly" ? (
              ["I", "II", "III", "IV", "V"].map((l) => (
                <th key={l} className={thRight}>
                  {l}
                </th>
              ))
            ) : (
              <th className={thRight}>Halaga</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                {r.name}
                {r.hasDraft && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">may draft</span>}
              </td>
              {mode === "weekly"
                ? r.weeks.map((w, i) => (
                    <td key={i} className={tdRight}>
                      {w === 0 ? "—" : fmtPeso(w)}
                    </td>
                  ))
                : (
                    <td className={tdRight}>{fmtPeso(r.total)}</td>
                  )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
        Buod lang ito (draft + naipadala, tulad ng opisyal na form) — tingnan sa ibaba ang detalyadong listahan para sa edit/ipadala/i-void.
      </p>
    </div>
  );
}
