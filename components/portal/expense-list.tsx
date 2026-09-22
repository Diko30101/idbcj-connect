"use client";

import { useState } from "react";
import { addExpense, updateExpense, deleteExpense } from "@/app/portal/actions";
import { btnCls, btnDangerCls, btnGhostCls, inputCls } from "./form-bits";
import { fmtPeso } from "@/lib/finance";

export type ExpenseRowData = {
  id: string;
  description: string;
  amount: number;
  note: string | null;
  updatedAt: string | null;
  updatedByName: string;
};

function ExpenseRow({ month, row }: { month: string; row: ExpenseRowData }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <tr className="border-b border-gray-100 bg-emerald-50/40">
        <td colSpan={4} className="py-3 pr-3">
          <form action={updateExpense} className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="month" value={month} />
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Gastos</span>
              <input name="description" defaultValue={row.description} required className={inputCls} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Halaga</span>
              <input type="number" step="0.01" min="0" name="amount" defaultValue={row.amount} required className={inputCls} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Tala (opsyonal)</span>
              <input name="note" defaultValue={row.note ?? ""} className={inputCls} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className={btnCls}>
                I-save
              </button>
              <button type="button" onClick={() => setEditing(false)} className={btnGhostCls}>
                Kanselahin
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-3 text-gray-800">
        {row.description}
        {row.note && <div className="text-xs text-gray-400">{row.note}</div>}
      </td>
      <td className="py-2 pr-3 font-medium text-gray-800">{fmtPeso(row.amount)}</td>
      <td className="py-2 pr-3 text-xs text-gray-400">
        {row.updatedAt ? `${row.updatedByName} · ${new Date(row.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "-"}
      </td>
      <td className="py-2 pr-3">
        {!confirmingDelete ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className={btnGhostCls}>
              I-edit
            </button>
            <button type="button" onClick={() => setConfirmingDelete(true)} className={btnDangerCls}>
              Burahin
            </button>
          </div>
        ) : (
          <form action={deleteExpense} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="month" value={month} />
            <span className="text-xs font-medium text-red-700">Sigurado ka ba?</span>
            <button type="submit" className={btnDangerCls}>
              Oo, burahin
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className={btnGhostCls}>
              Huwag
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}

export function ExpenseList({ month, rows }: { month: string; rows: ExpenseRowData[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <form action={addExpense} className="mb-5 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
        <input type="hidden" name="month" value={month} />
        <label className="grid gap-1">
          <span className="text-xs font-medium text-gray-600">Gastos</span>
          <input name="description" placeholder="Hal. Renta, Kuryente" required className={inputCls} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-gray-600">Halaga</span>
          <input type="number" step="0.01" min="0" name="amount" placeholder="0.00" required className={inputCls} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-gray-600">Tala (opsyonal)</span>
          <input name="note" className={inputCls} />
        </label>
        <button type="submit" className={btnCls}>
          Idagdag
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">Wala pang naitatalang gastos para sa buwang ito.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Gastos</th>
                <th className="py-2 pr-3">Halaga</th>
                <th className="py-2 pr-3">Huling na-save</th>
                <th className="py-2 pr-3">Aksyon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ExpenseRow key={r.id} month={month} row={r} />
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3">{fmtPeso(total)}</td>
                <td className="py-2 pr-3" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
