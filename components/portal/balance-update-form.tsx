"use client";

import { saveBalanceSnapshot } from "@/app/portal/actions";
import { btnCls, inputCls } from "@/components/portal/ui";
import type { BalanceSnapshot } from "@/app/portal/finance/balances/page";

function pesoInputValue(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BalanceUpdateForm({ current }: { current: BalanceSnapshot[] }) {
  if (current.length === 0) {
    return <p className="text-sm text-gray-500">Magiging available ang form kapag may unang tala na.</p>;
  }
  return (
    <div className="space-y-4">
      {current.map((r) => (
        <form
          key={r.account_key}
          action={saveBalanceSnapshot}
          className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="account_key" value={r.account_key} />
          <input type="hidden" name="account_label" value={r.account_label} />
          <div className="sm:col-span-1">
            <div className="mb-1 text-sm font-semibold text-gray-800">{r.account_label}</div>
            <div className="text-xs text-gray-500">Kasalukuyan: ₱{pesoInputValue(r.balance)}</div>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Bagong balanse (₱)</span>
            <input
              name="balance"
              inputMode="decimal"
              required
              defaultValue={pesoInputValue(r.balance)}
              className={inputCls}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Hanggang petsa</span>
            <input type="date" name="as_of" required defaultValue={r.as_of} className={inputCls} />
          </label>
          <button className={btnCls}>I-save</button>
        </form>
      ))}
    </div>
  );
}
