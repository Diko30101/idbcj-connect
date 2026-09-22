import { requireExpenseAccess } from "@/lib/portal";
import { currentMonthPH, monthToDate, monthLabel, fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { ExpenseList, type ExpenseRowData } from "@/components/portal/expense-list";
import { FinanceChart } from "@/components/portal/finance-chart";

const EXPENSE_CHART_CATEGORIES = ["total"];
const EXPENSE_CHART_LABEL = { total: "Gastusin" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, month: monthParam, year: yearParam } = await searchParams;
  const { supabase } = await requireExpenseAccess();

  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthPH();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : month.slice(0, 4);

  const [monthRes, yearRes] = await Promise.all([
    supabase
      .from("expense_records")
      .select("id, description, amount, note, updated_at, profiles!expense_records_updated_by_fkey(full_name)")
      .eq("expense_month", monthToDate(month))
      .order("created_at", { ascending: true }),
    supabase
      .from("expense_records")
      .select("expense_month, amount")
      .gte("expense_month", `${year}-01-01`)
      .lt("expense_month", `${Number(year) + 1}-01-01`),
  ]);

  const rows: ExpenseRowData[] = ((monthRes.data ?? []) as any[]).map((r) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    note: r.note,
    updatedAt: r.updated_at,
    updatedByName: r.profiles?.full_name ?? "Staff",
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  // Taunang buod: total ng gastusin bawat buwan
  const yearGrid = new Map<string, number>(); // key = MM
  for (const r of (yearRes.data ?? []) as any[]) {
    const mm = (r.expense_month as string).slice(5, 7);
    yearGrid.set(mm, (yearGrid.get(mm) ?? 0) + Number(r.amount));
  }
  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const chartValues: Record<string, number> = {};
  for (const mm of months12) chartValues[`${mm}_total`] = yearGrid.get(mm) ?? 0;
  const yearGrandTotal = months12.reduce((s, mm) => s + (yearGrid.get(mm) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Gastusin"
        subtitle="Buwanang listahan ng gastusin ng simbahan (buong simbahan, hindi naka-per-lokal)"
      />
      <Notice ok={ok} error={error} />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Buwan</span>
            <input type="month" name="month" defaultValue={month} className={inputCls} />
          </label>
          <button className={btnGhostCls}>Ipakita</button>
        </form>
      </Panel>

      <div className="mt-6">
        <Panel title={`${monthLabel(month)} · Total: ${fmtPeso(total)}`}>
          <ExpenseList month={month} rows={rows} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`Taunang Buod ng Gastusin · ${year}`}>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="month" value={month} />
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Taon</span>
              <input type="number" name="year" defaultValue={year} className={inputCls + " w-28"} />
            </label>
            <button className={btnGhostCls}>Ipakita</button>
          </form>

          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
            <FinanceChart
              year={year}
              months={months12}
              categories={EXPENSE_CHART_CATEGORIES}
              categoryLabel={EXPENSE_CHART_LABEL}
              values={chartValues}
            />
          </div>

          {yearGrandTotal === 0 ? (
            <Empty>Wala pang naitatalang gastos para sa {year}.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Buwan</th>
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {months12.map((mm) => (
                    <tr key={mm} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">{monthLabel(`${year}-${mm}`)}</td>
                      <td className="py-2 pr-3 text-gray-700">{fmtPeso(yearGrid.get(mm) ?? 0)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3">{fmtPeso(yearGrandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
