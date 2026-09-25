"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import { Field, btnCls, btnGhostCls, inputCls } from "./form-bits";
import {
  saveAttendanceRecord,
  exportAttendanceCsv,
  importAttendanceCsv,
  searchOtherLocalMembers,
} from "@/app/portal/attendance-record/actions";
import { isCustomType } from "@/app/portal/attendance-record/constants";

type RosterMember = { id: string; full_name: string | null };
type Guest = { name: string; kind: "visitor" | "other_local"; memberId?: string; homeLocalId?: string; homeLocalName?: string };
type LocalOpt = { id: string; name: string };

// Tanggalin ang accent at gawing maliit ang letra para madaling mahanap ("Peña" = "pena")
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function AttendanceRecordForm({  localId,
  localName,
  serviceDate,
  serviceType,
  customReasonDefault,
  members,
  presentIds,
  visitorsDefault,
  otherLocalsDefault,
  allLocals,
}: {
  localId: string;
  localName: string;
  serviceDate: string;
  serviceType: string;
  customReasonDefault: string;
  members: RosterMember[];
  presentIds: string[];
  visitorsDefault: string[];
  otherLocalsDefault: { name: string; memberId: string; homeLocalId: string; homeLocalName: string }[];
  allLocals: LocalOpt[];
}) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(presentIds));
  const [visitors, setVisitors] = useState<string[]>(() => visitorsDefault);
  const [visitorInput, setVisitorInput] = useState("");
  const [otherLocals, setOtherLocals] = useState<Guest[]>(
    () => otherLocalsDefault.map((o) => ({ name: o.name, kind: "other_local" as const, memberId: o.memberId, homeLocalId: o.homeLocalId, homeLocalName: o.homeLocalName })),
  );
  const [otherName, setOtherName] = useState("");
  const [otherLocalId, setOtherLocalId] = useState("");
  const [otherResults, setOtherResults] = useState<{ id: string; full_name: string }[]>([]);
  const [otherSearching, setOtherSearching] = useState(false);
  const [customReason, setCustomReason] = useState(customReasonDefault);

  // Paghahanap ng pangalan sa roster ng ibang local (autocomplete) --
  // tinitiyak na nakatala talaga ang kaanib sa local na iyon.
  useEffect(() => {
    const q = otherName.trim();
    if (!otherLocalId || q.length < 2) {
      setOtherResults([]);
      setOtherSearching(false);
      return;
    }
    setOtherSearching(true);
    const t = setTimeout(async () => {
      try {
        setOtherResults(await searchOtherLocalMembers(otherLocalId, q));
      } finally {
        setOtherSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [otherName, otherLocalId]);

  const words = norm(query).split(/\s+/).filter(Boolean);
  const shown = useMemo(
    () =>
      members.filter((m) => {
        if (words.length === 0) return true;
        return words.every((w) => norm(m.full_name ?? "").includes(w));
      }),
    [members, query, words],
  );
  const shownIds = useMemo(() => shown.map((m) => m.id), [shown]);

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

  function addVisitor() {
    const name = visitorInput.trim();
    if (!name || visitors.includes(name)) return;
    setVisitors((v) => [...v, name]);
    setVisitorInput("");
  }

  function pickOtherLocal(member: { id: string; full_name: string }) {
    if (!otherLocalId) return;
    const home = allLocals.find((l) => l.id === otherLocalId);
    if (otherLocals.some((o) => o.memberId === member.id && o.homeLocalId === otherLocalId)) return;
    setOtherLocals((v) => [...v, { name: member.full_name, kind: "other_local", memberId: member.id, homeLocalId: otherLocalId, homeLocalName: home?.name ?? "" }]);
    setOtherName("");
    setOtherResults([]);
  }

  const searching = words.length > 0;
  const totalGuests = visitors.length + otherLocals.length;

  return (
    <form action={saveAttendanceRecord}>
      <input type="hidden" name="local_id" value={localId} />
      <input type="hidden" name="service_date" value={serviceDate} />
      <input type="hidden" name="service_type" value={serviceType} />

      {isCustomType(serviceType) && (
        <div className="mb-4">
          <Field label="Dahilan ng pagkakatipon">
            <input
              type="text"
              name="custom_reason"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              maxLength={120}
              required
              placeholder="I-type ang dahilan, hal. Paggunita sa mga yumao"
              className={inputCls}
            />
          </Field>
        </div>
      )}

      <div className="mb-4">
        <AttendanceCsvButtons localId={localId} serviceDate={serviceDate} serviceType={serviceType} customReasonDefault={customReasonDefault} />
      </div>

      {/* Roster checklist */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="roster-search" className="mb-1.5 block text-sm font-medium text-gray-700">
            Hanapin sa roster ng {localName}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="roster-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
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
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600" aria-live="polite">
          Naka-tsek: <strong>{checked.size}</strong> sa {members.length} na kaanib ng roster
          {searching && <span className="text-gray-400"> · {shownIds.length} ang lumabas sa filter</span>}
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

      {members.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Walang aktibong kaanib sa roster ng local na ito.</p>
      ) : (
        <ul className="mb-6 grid max-h-72 gap-x-6 overflow-y-auto sm:grid-cols-2">
          {members.map((m) => {
            const isShown = words.length === 0 || words.every((w) => norm(m.full_name ?? "").includes(w));
            return (
              <li key={m.id} hidden={!isShown} className="border-b border-gray-100">
                <input type="hidden" name="all" value={m.id} />
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
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
            );
          })}
        </ul>
      )}

      {/* Bisita */}
      <div className="mb-6">
        <Field label="Bisita — maglagay ng pangalan">
          <div className="flex gap-2">
            <input
              value={visitorInput}
              onChange={(e) => setVisitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVisitor();
                }
              }}
              placeholder="Pangalan ng bisita…"
              autoComplete="off"
              className={inputCls}
            />
            <button type="button" onClick={addVisitor} className={btnGhostCls}>
              Idagdag
            </button>
          </div>
        </Field>
        {visitors.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {visitors.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 py-1 pl-3 pr-1.5 text-sm font-medium text-amber-800"
              >
                <input type="hidden" name="visitor" value={v} />
                {v}
                <button
                  type="button"
                  onClick={() => setVisitors((list) => list.filter((x) => x !== v))}
                  aria-label={`Alisin si ${v}`}
                  className="rounded-full p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Galing ibang local -- hinahanap ang pangalan sa roster ng ibang
          local upang matiyak na nakatala talaga ang kaanib doon */}
      <div className="mb-6">
        <Field label="Dumalo mula sa ibang local">
          <div className="flex flex-wrap gap-2">
            <select
              value={otherLocalId}
              onChange={(e) => {
                setOtherLocalId(e.target.value);
                setOtherResults([]);
              }}
              className={`${inputCls} w-auto`}
              aria-label="Local na pinanggalingan"
            >
              <option value="">Piliin ang local…</option>
              {allLocals
                .filter((l) => l.id !== localId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
            <div className="relative min-w-40 flex-1">
              <input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                  if (e.key === "Escape") setOtherResults([]);
                }}
                placeholder={otherLocalId ? "I-type ang pangalan sa roster…" : "Piliin muna ang local…"}
                autoComplete="off"
                disabled={!otherLocalId}
                className={`${inputCls} w-full disabled:opacity-50`}
                aria-label="Hanapin ang pangalan sa roster"
              />
              {(otherSearching || otherResults.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {otherSearching && <div className="px-3 py-2 text-sm text-gray-400">Hinahanap…</div>}
                  {!otherSearching && otherResults.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">Walang nahanap sa roster ng local na ito.</div>
                  )}
                  {otherResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => pickOtherLocal(r)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-emerald-50"
                    >
                      {r.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Ang pangalan ay dapat mahanap sa roster ng napiling local — tinitiyak nito na nakatala talaga ang dadalong kaanib.
          </p>
        </Field>
        {otherLocals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {otherLocals.map((o) => (
              <span
                key={`${o.homeLocalId}-${o.memberId ?? o.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-sm font-medium text-blue-800"
              >
                <input type="hidden" name="other_local" value={`${o.homeLocalId}|${o.memberId ?? ""}`} />
                {o.name} <span className="font-normal text-blue-500">({o.homeLocalName})</span>
                <button
                  type="button"
                  onClick={() => setOtherLocals((list) => list.filter((x) => !(x.memberId === o.memberId && x.homeLocalId === o.homeLocalId)))}
                  aria-label={`Alisin si ${o.name}`}
                  className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-gray-100 bg-white/95 px-5 py-3">
        <button type="submit" className={btnCls}>
          I-save bilang draft ({checked.size + totalGuests})
        </button>
      </div>
    </form>
  );
}

// Mga pindutan para sa CSV export at import ng pagdalo sa isang pagkakatipon.
// Ginagamit sa form at sa talaan (review bago i-submit).
export function AttendanceCsvButtons({
  localId,
  serviceDate,
  serviceType,
  customReasonDefault,
}: {
  localId: string;
  serviceDate: string;
  serviceType: string;
  customReasonDefault: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [customReason, setCustomReason] = useState(customReasonDefault);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportAttendanceCsv(localId, serviceDate, serviceType);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm(`I-import ang "${file.name}"? Papalitan nito ang kasalukuyang tala ng pagtitipong ito.`)) return;
    setImporting(true);
    try {
      const text = await file.text();
      const fd = new FormData();
      fd.set("local_id", localId);
      fd.set("service_date", serviceDate);
      fd.set("service_type", serviceType);
      if (isCustomType(serviceType)) {
        if (!customReason.trim()) {
          alert("I-type muna ang dahilan ng pagkakatipon bago mag-import.");
          setImporting(false);
          return;
        }
        fd.set("custom_reason", customReason.trim().slice(0, 120));
      }
      fd.set("csv", text);
      await importAttendanceCsv(fd);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      {isCustomType(serviceType) && (
        <div className="mb-2">
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            maxLength={120}
            placeholder="I-type ang dahilan, hal. Paggunita sa mga yumao"
            className={inputCls}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || importing}
          className={`${btnGhostCls} disabled:opacity-50`}
        >
          {exporting ? "Inihahanda…" : "I-export ang CSV"}
        </button>
        <label className={`${btnGhostCls} cursor-pointer ${(exporting || importing) ? "opacity-50" : ""}`}>
          {importing ? "Ini-import…" : "Mag-import ng CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
            disabled={exporting || importing}
          />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">
        Format ng CSV: pangalan, kategorya (kaanib / bisita / ibang_local), home_local — ang ibang_local ay bineberipika sa roster ng kanilang local
      </p>
    </div>
  );
}
