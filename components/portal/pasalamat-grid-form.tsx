"use client";

import { useRef, useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { MemberPicker } from "./member-picker";
import { todayInTimezone } from "@/lib/finance";
import { GIVING_NOTES_MAX, PASALAMAT_CUSTOM_LABEL, PASALAMAT_CUSTOM_TYPE, PASALAMAT_TYPES, PASALAMAT_TYPE_LABEL, type MemberChoice } from "@/lib/giving";

// Listahan ng mga blangkong hanay para sa pag-encode ng maraming Pasalamat nang sabay-sabay,
// sundan ang pagkakasunod-sunod ng papel na template (public/Monthly Pasalamat Report.pdf):
// Petsa | Pangalan | Detalye (Uri + Tala) | Halaga. Iba ito sa grid ng Ambagan/Abuluyan/Tulong
// dahil maaaring maraming beses magbigay ang isang kaanib (Birthday, Anniversary, atbp.), kaya
// bawat hanay ay may sariling Petsa, kaanib, Uri, at Tala — walang nakalaang cell bawat kaanib.
// Blangkong hanay (walang napiling kaanib) = walang record na gagawin.
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

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="row_keys" value={rowKeys.join(",")} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="space-y-3">
        {rowKeys.map((key, i) => (
          <div key={key} className="rounded-md border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Hanay {i + 1}</span>
              {rowKeys.length > 1 && (
                <button type="button" onClick={() => removeRow(key)} className="text-xs font-medium text-red-600 hover:underline">
                  Alisin
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Petsa ng pagbibigay</span>
                <input type="date" name={`row__${key}__date`} defaultValue={today} max={today} className={inputCls} />
              </label>

              <div>
                <MemberPicker search={search} name={`row__${key}__member_id`} />
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Uri ng pasalamat</span>
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
              </label>

              {typeByRow[key] === PASALAMAT_CUSTOM_TYPE && (
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-gray-700">Sariling uri</span>
                  <input type="text" name={`row__${key}__custom_type`} maxLength={80} autoComplete="off" className={inputCls} />
                </label>
              )}

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Tala / Detalye (opsyonal)</span>
                <input type="text" name={`row__${key}__notes`} maxLength={GIVING_NOTES_MAX} autoComplete="off" className={inputCls} />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Halaga (₱)</span>
                <input type="number" step="0.01" min="0.01" name={`row__${key}__amount`} autoComplete="off" className={inputCls} />
              </label>
            </div>
          </div>
        ))}
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
