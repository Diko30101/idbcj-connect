"use client";

import { useState, type FormEvent } from "react";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";
import { updateMemberName, setMemberStatus, confirmMember } from "@/app/portal/roster/actions";
import { MEMBER_STATUSES, type MemberStatus, type RosterMember } from "@/lib/roster";

type RowMode = "none" | "name" | "status";

export type RosterRowProps = {
  member: RosterMember;
  localName: string;
  isAdmin: boolean;
  path: string;
  index: number;
};

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-red-100 text-red-700",
  "bg-indigo-100 text-indigo-700",
];

export function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function MemberAvatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-bold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {memberInitials(name)}
    </span>
  );
}

export function RosterStatusPill({ status }: { status: MemberStatus }) {
  const cls =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "Inactive"
        ? "bg-gray-100 text-gray-600 border-gray-200"
        : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

const moreCls =
  "rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-emerald-50 hover:text-emerald-700";
const morePrimaryCls =
  "rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100";

function ConfirmButton({ member, path }: { member: RosterMember; path: string }) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Kumpirmahin ang kaanib na ito? Makakatanggap na ito ng handog.")) e.preventDefault();
  }
  return (
    <form action={confirmMember} onSubmit={onSubmit}>
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="id" value={member.id} />
      <button type="submit" className={morePrimaryCls}>
        Kumpirmahin
      </button>
    </form>
  );
}

function InlineForms({
  member,
  isAdmin,
  path,
  mode,
  onClose,
}: {
  member: RosterMember;
  isAdmin: boolean;
  path: string;
  mode: Exclude<RowMode, "none">;
  onClose: () => void;
}) {
  if (mode === "name") {
    return (
      <form action={updateMemberName} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="id" value={member.id} />
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">Pangalan</span>
          <input
            name="full_name"
            defaultValue={member.full_name}
            maxLength={200}
            required
            autoComplete="off"
            className={inputCls}
          />
          {!isAdmin && member.confirmed_at !== null && (
            <span className="text-xs text-amber-700">
              Kung magbabago ang pangalan (hindi lang ang laki ng titik o espasyo), mawawala ang kumpirmasyon at
              kailangang kumpirmahin muli ng Admin.
            </span>
          )}
        </label>
        <div className="flex gap-2">
          <button type="submit" className={btnCls}>
            I-save
          </button>
          <button type="button" className={btnGhostCls} onClick={onClose}>
            Kanselahin
          </button>
        </div>
      </form>
    );
  }
  if (mode === "status" && isAdmin) {
    return (
      <form action={setMemberStatus} className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
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
          <button type="button" className={btnGhostCls} onClick={onClose}>
            Kanselahin
          </button>
        </div>
      </form>
    );
  }
  return null;
}

function ActionButtons({
  member,
  isAdmin,
  path,
  mode,
  toggle,
}: {
  member: RosterMember;
  isAdmin: boolean;
  path: string;
  mode: RowMode;
  toggle: (m: Exclude<RowMode, "none">) => void;
}) {
  const confirmed = member.confirmed_at !== null;
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={moreCls} onClick={() => toggle("name")} aria-expanded={mode === "name"}>
        I-edit
      </button>
      {isAdmin && (
        <button type="button" className={moreCls} onClick={() => toggle("status")} aria-expanded={mode === "status"}>
          Status
        </button>
      )}
      {isAdmin && !confirmed && <ConfirmButton member={member} path={path} />}
    </div>
  );
}

// Isang hilera sa desktop table, may napapalawak na form sa ilalim kapag nag-e-edit.
export function RosterTableRow({ member, localName, isAdmin, path, index }: RosterRowProps) {
  const [mode, setMode] = useState<RowMode>("none");
  const toggle = (m: Exclude<RowMode, "none">) => setMode((cur) => (cur === m ? "none" : m));
  const confirmed = member.confirmed_at !== null;
  return (
    <>
      <tr className="transition-colors hover:bg-gray-50">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <MemberAvatar name={member.full_name} index={index} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{member.full_name}</p>
              {!confirmed && (
                <span className="mt-1 inline-block rounded-full border border-gray-200 bg-gray-100 px-2 py-px text-[11px] font-semibold text-gray-500">
                  Hindi pa kumpirmado
                </span>
              )}
              {member.status_reason && member.status !== "Active" && (
                <p className="mt-0.5 truncate text-xs text-gray-400">Dahilan: {member.status_reason}</p>
              )}
            </div>
          </div>
        </td>
        <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">{localName}</td>
        <td className="whitespace-nowrap px-5 py-3.5">
          <RosterStatusPill status={member.status} />
        </td>
        <td className="px-5 py-3.5">
          <div className="flex justify-end">
            <ActionButtons member={member} isAdmin={isAdmin} path={path} mode={mode} toggle={toggle} />
          </div>
        </td>
      </tr>
      {mode !== "none" && (
        <tr className="bg-emerald-50/40">
          <td colSpan={4} className="px-5 py-4">
            <InlineForms
              member={member}
              isAdmin={isAdmin}
              path={path}
              mode={mode}
              onClose={() => setMode("none")}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Card para sa mobile (table ay nakatago sa maliit na screen).
export function RosterMemberCard({ member, localName, isAdmin, path, index }: RosterRowProps) {
  const [mode, setMode] = useState<RowMode>("none");
  const toggle = (m: Exclude<RowMode, "none">) => setMode((cur) => (cur === m ? "none" : m));
  const confirmed = member.confirmed_at !== null;
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MemberAvatar name={member.full_name} index={index} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{member.full_name}</p>
            <p className="text-xs text-gray-500">{localName}</p>
          </div>
        </div>
        <RosterStatusPill status={member.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
        {!confirmed && (
          <span className="inline-block rounded-full border border-gray-200 bg-gray-100 px-2 py-px text-[11px] font-semibold text-gray-500">
            Hindi pa kumpirmado
          </span>
        )}
        {member.status_reason && member.status !== "Active" && (
          <span className="text-xs text-gray-400">Dahilan: {member.status_reason}</span>
        )}
      </div>
      <div className="mt-2 pl-12">
        <ActionButtons member={member} isAdmin={isAdmin} path={path} mode={mode} toggle={toggle} />
      </div>
      {mode !== "none" && (
        <div className="mt-3 rounded-lg bg-emerald-50/40 p-3 pl-12">
          <InlineForms
            member={member}
            isAdmin={isAdmin}
            path={path}
            mode={mode}
            onClose={() => setMode("none")}
          />
        </div>
      )}
    </article>
  );
}
