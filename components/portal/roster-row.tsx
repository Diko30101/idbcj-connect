"use client";

import { useState, type FormEvent } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { updateMemberName, setMemberStatus, confirmMember } from "@/app/portal/roster/actions";
import { MEMBER_STATUSES, type RosterMember } from "@/lib/roster";

function StatusPill({ status }: { status: RosterMember["status"] }) {
  const cls =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : status === "Inactive"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-red-50 text-red-700 border-red-100";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{status}</span>;
}

// Isang kaanib sa roster. Ang mga pahintulot (sino ang makapagpapalit ng ano) ay ipinapatupad ng database;
// itinatago lang dito ang mga butones na hindi para sa iyo.
export function RosterRow({
  member,
  localName,
  isAdmin,
  path,
}: {
  member: RosterMember;
  localName: string;
  isAdmin: boolean;
  path: string;
}) {
  const [mode, setMode] = useState<"none" | "name" | "status">("none");
  const confirmed = member.confirmed_at !== null;

  function confirmSubmit(e: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Kumpirmahin ang kaanib na ito? Makakatanggap na ito ng handog.")) e.preventDefault();
  }

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-800">{member.full_name}</p>
          <p className="text-sm text-gray-500">
            {localName}
            {member.status_reason && member.status !== "Active" ? ` · Dahilan: ${member.status_reason}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={member.status} />
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              confirmed ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {confirmed ? "Kumpirmado" : "Hindi pa kumpirmado"}
          </span>
          <button type="button" className={btnGhostCls} onClick={() => setMode(mode === "name" ? "none" : "name")}>
            Edit pangalan
          </button>
          {isAdmin && (
            <button type="button" className={btnGhostCls} onClick={() => setMode(mode === "status" ? "none" : "status")}>
              Palitan ang status
            </button>
          )}
          {isAdmin && !confirmed && (
            <form action={confirmMember} onSubmit={confirmSubmit}>
              <input type="hidden" name="path" value={path} />
              <input type="hidden" name="id" value={member.id} />
              <button type="submit" className={btnCls}>
                Kumpirmahin
              </button>
            </form>
          )}
        </div>
      </div>

      {mode === "name" && (
        <form action={updateMemberName} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="id" value={member.id} />
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Pangalan</span>
            <input name="full_name" defaultValue={member.full_name} maxLength={200} required autoComplete="off" className={inputCls} />
            {!isAdmin && confirmed && (
              <span className="text-xs text-amber-700">
                Kung magbabago ang pangalan (hindi lang ang laki ng titik o espasyo), mawawala ang kumpirmasyon at kailangang kumpirmahin muli ng Admin.
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <button type="submit" className={btnCls}>
              I-save
            </button>
            <button type="button" className={btnGhostCls} onClick={() => setMode("none")}>
              Kanselahin
            </button>
          </div>
        </form>
      )}

      {mode === "status" && isAdmin && (
        <form action={setMemberStatus} className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="id" value={member.id} />
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Bagong status</span>
            <select name="status" defaultValue={member.status} className={inputCls}>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Dahilan (kailangan)</span>
            <input name="reason" required maxLength={300} autoComplete="off" className={inputCls} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={btnCls}>
              Palitan
            </button>
            <button type="button" className={btnGhostCls} onClick={() => setMode("none")}>
              Kanselahin
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
