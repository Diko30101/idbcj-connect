"use client";

import { useRef, useState } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { MemberPicker } from "./member-picker";
import { PASALAMAT_CUSTOM_TYPE, type MemberChoice } from "@/lib/giving";

// Simpleng grid ng Pasalamat: isang hanay lang sa simula (Petsa + Pangalan mula sa roster/paghahanap
// + Halaga), may "+ Magdagdag ng hanay" kung marami pang magpapasalamat sa parehong buwan. Ginagamit
// ng Monthly Pasalamat (fixedType="birthday" -- walang column ng Dahilan, awtomatiko ang uri) at Extra
// Pasalamat (may column ng Dahilan -- ang tina-type na Dahilan mismo ang magiging pamagat sa resibo).
// Ang Petsa ng bawat hanay ay naka-hangganan sa loob ng napiling buwan (min/max).
export function PasalamatSimpleGridForm({
  action,
  path,
  hidden,
  minDate,
  maxDate,
  defaultDate,
  search,
  mode,
}: {
  action: (fd: FormData) => void;
  path: string;
  hidden?: Record<string, string>;
  minDate: string;
  maxDate: string;
  defaultDate: string;
  search: (q: string) => Promise<MemberChoice[]>;
  mode: { kind: "fixed"; type: string } | { kind: "reason"; placeholder: string };
}) {
  const [rowKeys, setRowKeys] = useState<number[]>([0]);
  const nextKey = useRef(1);

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
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Petsa</th>
              <th className={th}>Pangalan</th>
              {mode.kind === "reason" && <th className={th}>Dahilan</th>}
              <th className={th}>Halaga</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((key) => (
              <tr key={key}>
                <td className={`${td} w-36`}>
                  <input
                    type="date"
                    name={`row__${key}__date`}
                    defaultValue={defaultDate}
                    min={minDate}
                    max={maxDate}
                    className={inputCls}
                  />
                </td>
                <td className={`${td} min-w-[220px]`}>
                  <MemberPicker search={search} name={`row__${key}__member_id`} compact />
                  {mode.kind === "fixed" && <input type="hidden" name={`row__${key}__type`} value={mode.type} />}
                </td>
                {mode.kind === "reason" && (
                  <td className={`${td} min-w-[200px]`}>
                    <input type="hidden" name={`row__${key}__type`} value={PASALAMAT_CUSTOM_TYPE} />
                    <input
                      type="text"
                      name={`row__${key}__custom_type`}
                      maxLength={80}
                      autoComplete="off"
                      placeholder={mode.placeholder}
                      className={inputCls}
                    />
                  </td>
                )}
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
        <p className="text-xs text-gray-500">Blangko (walang napiling kaanib) = walang record na gagawin.</p>
      </div>
    </form>
  );
}
