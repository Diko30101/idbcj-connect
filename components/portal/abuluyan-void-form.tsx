"use client";

import type { FormEvent } from "react";
import { btnDangerCls, inputCls } from "./form-bits";
import { voidAbuluyan } from "@/app/portal/finance/abuluyan/actions";

// Pag-void ng naipadalang Abuluyan. Pinal ito (walang un-void); kailangan ng dahilan.
// Dumadaan ito sa void_abuluyan() ng database; ang Admin o church-wide Finance lang ang tatanggapin doon.
export function AbuluyanVoidForm({
  path,
  localId,
  serviceDate,
  locals,
  dateLabel,
}: {
  path: string;
  localId?: string; // kung alam na (church-wide page)
  serviceDate?: string;
  locals?: { id: string; name: string }[]; // kung kailangang pumili (form ng Admin)
  dateLabel?: string;
}) {
  function confirmVoid(e: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Sigurado ka bang i-void? Pinal ito at hindi na maibabalik. Kailangan ng bagong kapalit na record.")) {
      e.preventDefault();
    }
  }
  return (
    <form action={voidAbuluyan} onSubmit={confirmVoid} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="path" value={path} />
      {localId && <input type="hidden" name="local_id" value={localId} />}
      {serviceDate && <input type="hidden" name="service_date" value={serviceDate} />}
      {locals && (
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">Local</span>
          <select name="local_id" className={inputCls} required defaultValue="">
            <option value="" disabled>
              Pumili…
            </option>
            {locals.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!serviceDate && (
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">{dateLabel ?? "Linggo"}</span>
          <input type="date" name="service_date" className={inputCls} required autoComplete="off" />
        </label>
      )}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Dahilan ng pag-void</span>
        <input type="text" name="reason" className={inputCls} required maxLength={300} autoComplete="off" />
      </label>
      <button type="submit" className={btnDangerCls}>
        I-void
      </button>
    </form>
  );
}
