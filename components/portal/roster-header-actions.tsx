"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addMember, importMembers } from "@/app/portal/roster/actions";
import { ROSTER_BASE } from "@/lib/roster";
import type { RosterLocal } from "@/lib/portal";
import { btnCls, btnGhostCls, inputCls } from "./form-bits";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M12 15V3m0 0 4 4m-4-4L8 7M5 20h14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const TEMPLATE_CSV =
  "data:text/csv;charset=utf-8,full_name%2Clocale%0AJuan%20Dela%20Cruz%2CMedina";

// Mga aksyon sa itaas ng roster: Import CSV (napapalawak na panel), Export (link na may kasalukuyang filter),
// at Magdagdag (slide-over drawer na may add-member form).
export function RosterHeaderActions({
  locals,
  isAdmin,
  exportHref,
}: {
  locals: RosterLocal[];
  isAdmin: boolean;
  exportHref: string;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className={btnGhostCls}
          aria-expanded={importOpen}
        >
          <UploadIcon /> Import CSV
        </button>
        <Link href={exportHref} className={btnGhostCls}>
          <DownloadIcon /> Export
        </Link>
        <button type="button" onClick={() => setDrawerOpen(true)} className={btnCls}>
          <PlusIcon /> Magdagdag
        </button>
      </div>

      {importOpen && (
        <form
          action={importMembers}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800">Mag-import ng CSV</h3>
          <p className="mt-1 text-sm text-gray-500">
            Ang file ay dapat may mga column na <code className="rounded bg-gray-100 px-1">full_name</code> at{" "}
            <code className="rounded bg-gray-100 px-1">locale</code> (pangalan ng locale; hindi case-sensitive). Ang mga
            row na may maling pangalan o hindi kilalang locale ay nilalaktawan.{" "}
            <a
              href={TEMPLATE_CSV}
              download="roster-template.csv"
              className="font-medium text-emerald-700 hover:underline"
            >
              Kumuha ng template
            </a>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="path" value={ROSTER_BASE} />
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
            />
            <button type="submit" className={btnCls}>
              I-import
            </button>
          </div>
        </form>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Magdagdag ng kaanib">
          <div className="absolute inset-0 bg-gray-900/45" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bagong Kaanib</h2>
                <p className="mt-0.5 text-xs text-gray-500">Ang may * ay kailangang sagutan.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className={btnGhostCls}
                aria-label="Isara"
              >
                ✕
              </button>
            </div>
            <form action={addMember} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-5">
                <input type="hidden" name="path" value={ROSTER_BASE} />
                <div className="grid gap-4">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-gray-700">Buong pangalan *</span>
                    <input name="full_name" required maxLength={200} autoComplete="off" className={inputCls} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium text-gray-700">Local *</span>
                    <select
                      name="local_id"
                      required
                      defaultValue={locals.length === 1 ? locals[0].id : ""}
                      className={inputCls}
                    >
                      {locals.length > 1 && (
                        <option value="" disabled>
                          Pumili…
                        </option>
                      )}
                      {locals.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-gray-500">
                    {isAdmin
                      ? "Kumpirmado agad ang idadagdag ng Admin."
                      : "Ang idadagdag mo ay Active pero hindi pa kumpirmado; kailangang kumpirmahin ng Admin bago ito makatanggap ng handog."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
                <button type="button" onClick={() => setDrawerOpen(false)} className={btnGhostCls}>
                  Kanselahin
                </button>
                <button type="submit" className={btnCls}>
                  Idagdag
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
