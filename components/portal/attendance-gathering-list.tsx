"use client";

import { useEffect, useState, type FormEvent } from "react";
import { submitManyAttendanceRecords } from "@/app/portal/attendance-record/actions";
import { btnCls } from "./form-bits";

export type GatheringRowView = { name: string; kind: string; local: string };
export type GatheringView = {
  key: string;
  label: string;
  status: "draft" | "submitted";
  countLabel: string;
  summary: string;
  rows: GatheringRowView[];
};

function StatusBadge({ status }: { status: "draft" | "submitted" }) {
  return status === "submitted" ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Na-submit</span>
  ) : (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Draft</span>
  );
}

// Listahan ng mga pagkakatipon sa tab na "Mga dumalo": may checkbox sa
// bawat draft + "I-submit ang napili sa Administrative Ministry".
export function AttendanceGatheringList({
  gatherings,
  localId,
}: {
  gatherings: GatheringView[];
  localId: string;
}) {
  const submittable = gatherings.filter((g) => g.status === "draft");
  const [selected, setSelected] = useState<string[]>([]);
  const draftKey = submittable.map((d) => d.key).join("~");
  useEffect(() => {
    const valid = new Set(draftKey.split("~").filter(Boolean));
    setSelected((prev) => prev.filter((k) => valid.has(k)));
  }, [draftKey]);
  const allSelected = submittable.length > 0 && selected.length === submittable.length;
  const toggleAll = () => setSelected(allSelected ? [] : submittable.map((d) => d.key));
  const toggleOne = (k: string) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  function confirmBulk(e: FormEvent<HTMLFormElement>) {
    if (selected.length === 0) {
      e.preventDefault();
      return;
    }
    if (
      !window.confirm(
        `I-submit ang ${selected.length} pagdalo sa Administrative Ministry? Hindi na ang mga ito pwedeng baguhin pagkatapos.`,
      )
    ) {
      e.preventDefault();
    }
  }

  if (gatherings.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-500">Wala pang naka-talang pagdalo para sa local na ito.</p>;
  }

  return (
    <>
      {submittable.length > 0 && (
        <form
          action={submitManyAttendanceRecords}
          onSubmit={confirmBulk}
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-emerald-50/70 px-3 py-2.5"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Piliin lahat ng draft na pagdalo"
              className="h-4 w-4 accent-emerald-700"
            />
            Piliin lahat ({submittable.length})
          </label>
          <span className="text-xs text-gray-500">{selected.length} napili</span>
          {selected.map((k) => (
            <input key={k} type="hidden" name="gatherings" value={k} />
          ))}
          <input type="hidden" name="local_id" value={localId} />
          <button type="submit" className={btnCls} disabled={selected.length === 0}>
            I-submit ang napili sa Administrative Ministry{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
        </form>
      )}
      <div className="space-y-2">
        {gatherings.map((g) => (
          <div key={g.key} className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-2">
            {g.status === "draft" && (
              <input
                type="checkbox"
                checked={selected.includes(g.key)}
                onChange={() => toggleOne(g.key)}
                aria-label={`Piliin ang pagdalo noong ${g.label}`}
                className="mt-4 h-4 w-4 shrink-0 accent-emerald-700"
              />
            )}
            <details className="min-w-0 flex-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 hover:bg-emerald-50/40">
                <span className="text-sm">
                  <strong className="font-semibold text-gray-900">{g.label}</strong>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={g.status} />
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {g.countLabel}
                  </span>
                </span>
              </summary>
              <div className="border-t border-gray-100 py-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-3">Pangalan</th>
                        <th className="py-2 pr-3">Uri</th>
                        <th className="py-2">Local</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {g.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 font-medium text-gray-900">{r.name}</td>
                          <td
                            className={`py-2 pr-3 ${r.kind === "Bisita" ? "font-semibold text-amber-700" : r.kind === "Ibang local" ? "font-semibold text-blue-700" : "text-gray-600"}`}
                          >
                            {r.kind}
                          </td>
                          <td className="py-2 text-gray-600">{r.local}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">{g.summary}</p>
              </div>
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
