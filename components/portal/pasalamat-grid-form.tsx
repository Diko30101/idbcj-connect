"use client";

import { useRef, useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { MemberPicker } from "./member-picker";
import { todayInTimezone } from "@/lib/finance";
import { GIVING_NOTES_MAX, PASALAMAT_CUSTOM_LABEL, PASALAMAT_CUSTOM_TYPE, PASALAMAT_TYPES, PASALAMAT_TYPE_LABEL, type MemberChoice } from "@/lib/giving";

// Talahanayan ng mga blangkong hanay para sa pag-encode ng maraming Pasalamat nang sabay-sabay,
// sundan ang pagkakasunod-sunod ng papel na template (public/Monthly Pasalamat Report.pdf):
// Petsa | Pangalan | Uri/Detalye | Halaga. Iba ito sa grid ng Ambagan/Abuluyan/Tulong dahil
// maaaring maraming beses magbigay ang isang kaanib (Birthday, Extra, atbp.), kaya bawat hanay ay
// may sariling Petsa, kaanib, Uri, at Tala — walang nakalaang cell bawat kaanib. Blangkong hanay
// (walang napiling kaanib) = walang record na gagawin. Gamitin ang "+ Magdagdag ng hanay" kung
// kulang ang blangkong hanay.
export function PasalamatGridForm({
  action,
  path,
  hidden,
  timezone,
  search,
}: {
  action: (fd: FormData) => void;
  path: string;
  hidden?: Record<string, string>;
  timezone: string;
  search: (q: string) => Promise<MemberChoice[]>;
}) {
  const today = todayInTimezone(timezone);
  const [rowKeys, setRowKeys] = useState<number[]>([0, 1, 2, 3, 4]);
  const nextKey = useRef(5);
  const [typeByRow, setTypeByRow] = useState<Record<number, string>>({});

  const addRow = () => setRowKeys((prev) => [...prev, nextKey.current++]);
  const removeRow = (key: number) =>
    setRowKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      return next.length > 0 ? next : prev; // laging may kahit isang hanay
    });

  const th = "border border-gray-300 bg-gray-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600";
  const td = "border border-gray-200 p-1.5 align-top";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="row_keys" value={rowKeys.join(",")} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Petsa</th>
              <th className={th}>Pangalan</th>
              <th className={th}>Uri ng Pasalamat</th>
              <th className={th}>Detalye</th>
              <th className={th}>Halaga</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((key) => (
              <tr key={key}>
                <td className={`${td} w-36`}>
                  <input type="date" name={`row__${key}__date`} defaultValue={today} max={today} className={inputCls} />
                </td>
                <td className={`${td} min-w-[220px]`}>
                  <MemberPicker search={search} name={`row__${key}__member_id`} compact />
                </td>
                <td className={`${td} w-44`}>
                  <select
                    name={`row__${key}__type`}
                    defaultValue=""
                    onChange={(e) => setTypeByRow((prev) => ({ ...prev, [key]: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="" disabled>
                      Pumili ng uri…
                    </option>
                    {PASALAMAT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PASALAMAT_TYPE_LABEL[t]}
                      </option>
                    ))}
                    <option value={PASALAMAT_CUSTOM_TYPE}>{PASALAMAT_CUSTOM_LABEL}</option>
                  </select>
                  {typeByRow[key] === PASALAMAT_CUSTOM_TYPE && (
                    <input
                      type="text"
                      name={`row__${key}__custom_type`}
                      maxLength={80}
                      autoComplete="off"
                      placeholder="Sariling uri…"
                      className={`${inputCls} mt-1.5`}
                    />
                  )}
                </td>
                <td className={`${td} min-w-[160px]`}>
                  <input type="text" name={`row__${key}__notes`} maxLength={GIVING_NOTES_MAX} autoComplete="off" className={inputCls} />
                </td>
                <td className={`${td} w-32`}>
                  <input type="number" step="0.01" min="0.01" name={`row__${key}__amount`} autoComplete="off" className={inputCls} />
                </td>
                <td className={`${td} w-16 text-center`}>
                  {rowKeys.length > 1 && (
                    <button type="button" onClick={() => removeRow(key)} className="text-xs font-medium text-red-600 hover:underline">
                      Alisin
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className={btnGhostCls}>
          + Magdagdag ng hanay
        </button>
        <button type="submit" className={btnCls}>
          I-save ang mga Draft
        </button>
        <p className="text-xs text-gray-500">Blangko (walang napiling kaanib) = walang record na gagawin. Palipasin lang ang hanay na hindi gagamitin.</p>
      </div>
    </form>
  );
}
