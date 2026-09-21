"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Field, btnCls, btnGhostCls, inputCls } from "./form-bits";

type Member = { id: string; full_name: string | null };

// Tanggalin ang accent at gawing maliit ang letra para madaling mahanap ("Peña" = "pena")
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function AttendanceList({
  members,
  presentIds,
  visitorsDefault,
}: {
  members: Member[];
  presentIds: string[];
  visitorsDefault: number;
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(presentIds));

  const words = norm(query).split(/\s+/).filter(Boolean);
  const isShown = (m: Member) => {
    if (words.length === 0) return true;
    const name = norm(m.full_name ?? "");
    return words.every((w) => name.includes(w));
  };
  const shownIds = useMemo(
    () => members.filter(isShown).map((m) => m.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, query],
  );

  function toggle(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setShown(on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of shownIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const searching = words.length > 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="member-search" className="mb-1.5 block text-sm font-medium text-gray-700">
            Hanapin ang member
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            {/* Walang "name" ito kaya hindi ito kasama sa isasave */}
            <input
              id="member-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Huwag i-submit ang form kapag pinindot ang Enter sa paghahanap
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="I-type ang pangalan…"
              autoComplete="off"
              className={`${inputCls} pl-9 pr-9`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Burahin ang hinahanap"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="w-40">
          <Field label="Bilang ng bisita">
            <input type="number" min={0} name="visitors_count" defaultValue={visitorsDefault} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600" aria-live="polite">
          Naka-tsek: <strong>{checked.size}</strong> sa {members.length} na aktibong member
          {searching && <span className="text-gray-400"> · {shownIds.length} ang lumabas sa paghahanap</span>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShown(true)} disabled={shownIds.length === 0} className={`${btnGhostCls} disabled:opacity-50`}>
            {searching ? "Tsekan ang lumabas" : "Tsekan lahat"}
          </button>
          <button type="button" onClick={() => setShown(false)} disabled={shownIds.length === 0} className={`${btnGhostCls} disabled:opacity-50`}>
            {searching ? "Alisin ang tsek (lumabas)" : "Alisin lahat"}
          </button>
        </div>
      </div>

      {searching && shownIds.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">Walang member na may ganyang pangalan.</p>
      )}

      {/* Itinatago lang (hindi inaalis) ang hindi tugma, kaya kasama pa rin sila sa isasave */}
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.id} hidden={!isShown(m)} className="border-b border-gray-100">
            <input type="hidden" name="all" value={m.id} />
            <label className="flex cursor-pointer items-center gap-3 py-3">
              <input
                type="checkbox"
                name="present"
                value={m.id}
                checked={checked.has(m.id)}
                onChange={(e) => toggle(m.id, e.target.checked)}
                className="h-5 w-5 accent-emerald-700"
              />
              <span className="text-sm font-medium text-gray-900">{m.full_name || "(walang pangalan)"}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-gray-100 bg-white/95 px-5 py-3">
        <button type="submit" className={btnCls}>
          Save Attendance ({checked.size})
        </button>
      </div>
    </>
  );
}
