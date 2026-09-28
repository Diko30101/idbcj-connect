"use client";

import { useMemo, useState } from "react";
import { btnCls, inputCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";

export type PasalamatRosterExisting = { member_id: string; amount: number; status: string };

function fmtDatePH(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

// Grid ng Taunang Pasalamat o Anniversary Pasalamat: nakalista na agad ang lahat ng kaanib (gaya ng
// grid ng Ambagan), Halaga na lang ang ie-encode ng Local. Ang "type" (annual o anniversary) ay
// nakatakda na sa panel na ito — hindi na pinipili. Blangkong cell = walang record na gagawin.
// Naka-lock na ang cell na may kasama nang naipadalang record sa buwang ito.
//
// Ang Petsa ay eksaktong araw bawat taon (pangkalahatan): Enero 1 para sa Taunang Pasalamat,
// Disyembre 1 para sa Anniversary Pasalamat -- kaya "fixedDate" (hindi na napipili, ipinapakita
// lang bilang teksto + hidden input). Kung walang "fixedDate", babalik sa editable na petsa
// (defaultDate) -- pangkaraniwang hindi na ginagamit ngayon dahil parehong may fixedDate na ang
// Taunang at Anniversary, pero pinapanatili bilang fallback.
export function PasalamatRosterGridForm({
  action,
  path,
  hidden,
  pasalamatType,
  defaultDate,
  fixedDate,
  members,
  existing,
}: {
  action: (fd: FormData) => void;
  path: string;
  hidden?: Record<string, string>;
  pasalamatType: string; // "annual" | "anniversary"
  defaultDate?: string; // YYYY-MM-DD -- ginagamit lang kung walang fixedDate
  fixedDate?: string; // YYYY-MM-DD -- eksaktong araw, hindi na napipili
  members: { id: string; full_name: string }[];
  existing: PasalamatRosterExisting[];
}) {
  const byMember = useMemo(() => {
    const m = new Map<string, PasalamatRosterExisting>();
    for (const e of existing) m.set(e.member_id, e);
    return m;
  }, [existing]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of members) {
      const e = byMember.get(m.id);
      if (e) init[m.id] = String(e.amount);
    }
    return init;
  });

  const grandTotal = members.reduce((s, m) => {
    const v = Number(values[m.id]);
    return s + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  const th = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600";
  const td = "border border-gray-200 px-1.5 py-1 text-sm text-gray-800";
  const tdInput = "border border-gray-200 p-0.5";

  if (members.length === 0) {
    return <p className="text-sm text-gray-500">Walang kaanib na tumatanggap ng Pasalamat sa local na ito.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="pasalamat_type" value={pasalamatType} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      {fixedDate ? (
        <div className="max-w-xs text-sm">
          <span className="mb-1 block font-medium text-gray-700">Petsa ng pagbibigay</span>
          <input type="hidden" name="date" value={fixedDate} />
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">{fmtDatePH(fixedDate)}</p>
        </div>
      ) : (
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium text-gray-700">Petsa ng pagbibigay</span>
          <input type="date" name="date" defaultValue={defaultDate} required className={inputCls} />
        </label>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[360px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Pangalan</th>
              <th className={th}>Halaga</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const e = byMember.get(m.id);
              const locked = e && e.status !== "draft";
              return (
                <tr key={m.id}>
                  <td className={td}>{m.full_name}</td>
                  <td className={tdInput}>
                    {locked ? (
                      <div className="px-1.5 py-1 text-right text-sm tabular-nums text-gray-500" title="Naipadala na — hindi na mababago dito">
                        {fmtPeso(e!.amount)}
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`amt__${m.id}`}
                        value={values[m.id] ?? ""}
                        onChange={(ev) => setValues((prev) => ({ ...prev, [m.id]: ev.target.value }))}
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
              <td className={`${td} bg-gray-50 font-semibold`}>TOTAL</td>
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
