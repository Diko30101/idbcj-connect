import { requireRoles } from "@/lib/portal";
import { monthLabel, fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { FinanceChart } from "@/components/portal/finance-chart";

const REPORT_CATEGORIES = ["income", "expense"];
const REPORT_CATEGORY_LABEL: Record<string, string> = {
  income: "Pumasok (Koleksyon)",
  expense: "Lumabas (Gastusin)",
};

export default async function FinanceAuditReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, year: yearParam } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary", "treasurer"]);

  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : String(new Date().getFullYear());

  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from("financial_records")
      .select("record_month, amount")
      .gte("record_month", `${year}-01-01`)
      .lt("record_month", `${Number(year) + 1}-01-01`),
    supabase
      .from("expense_records")
      .select("expense_month, amount")
      .gte("expense_month", `${year}-01-01`)
      .lt("expense_month", `${Number(year) + 1}-01-01`),
  ]);

  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

  const incomeByMonth = new Map<string, number>();
  for (const r of (incomeRes.data ?? []) as any[]) {
    const mm = (r.record_month as string).slice(5, 7);
    incomeByMonth.set(mm, (incomeByMonth.get(mm) ?? 0) + Number(r.amount));
  }
  const expenseByMonth = new Map<string, number>();
  for (const r of (expenseRes.data ?? []) as any[]) {
    const mm = (r.expense_month as string).slice(5, 7);
    expenseByMonth.set(mm, (expenseByMonth.get(mm) ?? 0) + Number(r.amount));
  }

  const chartValues: Record<string, number> = {};
  for (const mm of months12) {
    chartValues[`${mm}_income`] = incomeByMonth.get(mm) ?? 0;
    chartValues[`${mm}_expense`] = expenseByMonth.get(mm) ?? 0;
  }

  const totalIncome = months12.reduce((s, mm) => s + (incomeByMonth.get(mm) ?? 0), 0);
  const totalExpense = months12.reduce((s, mm) => s + (expenseByMonth.get(mm) ?? 0), 0);
  const hasData = totalIncome > 0 || totalExpense > 0;

  // Running balance (paisa-isang buwan, patuloy sa buong taon)
  let running = 0;
  const rows = months12.map((mm) => {
    const income = incomeByMonth.get(mm) ?? 0;
    const expense = expenseByMonth.get(mm) ?? 0;
    const net = income - expense;
    running += net;
    return { mm, income, expense, net, running };
  });

  return (
    <>
      <PageHeader
        title="Audit Report"
        subtitle="Buwanang ulat ng kabuuang pumasok (koleksyon, lahat ng lokal) laban sa kabuuang lumabas (gastusin) para sa buong simbahan."
      />
      <Notice ok={ok} error={error} />

      <Panel title={`Buod · ${year}`}>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Taon</span>
            <input type="number" name="year" defaultValue={year} className={inputCls + " w-28"} />
          </label>
          <button className={btnGhostCls}>Ipakita</button>
        </form>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Kabuuang Pumasok</div>
            <div className="mt-1 text-xl font-bold text-emerald-900">{fmtPeso(totalIncome)}</div>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Kabuuang Lumabas</div>
            <div className="mt-1 text-xl font-bold text-red-900">{fmtPeso(totalExpense)}</div>
          </div>
          <div className={`rounded-xl border p-4 ${totalIncome - totalExpense >= 0 ? "border-blue-100 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${totalIncome - totalExpense >= 0 ? "text-blue-700" : "text-amber-700"}`}>
              Balanse ({year})
            </div>
            <div className={`mt-1 text-xl font-bold ${totalIncome - totalExpense >= 0 ? "text-blue-900" : "text-amber-900"}`}>
              {fmtPeso(totalIncome - totalExpense)}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
          <FinanceChart
            year={year}
            months={months12}
            categories={REPORT_CATEGORIES}
            categoryLabel={REPORT_CATEGORY_LABEL}
            values={chartValues}
          />
        </div>

        {!hasData ? (
          <Empty>Wala pang naitatalang koleksyon o gastusin para sa {year}.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Buwan</th>
                  <th className="py-2 pr-3">Pumasok</th>
                  <th className="py-2 pr-3">Lumabas</th>
                  <th className="py-2 pr-3">Net (Buwan)</th>
                  <th className="py-2 pr-3">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.mm} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{monthLabel(`${year}-${r.mm}`)}</td>
                    <td className="py-2 pr-3 text-emerald-700">{fmtPeso(r.income)}</td>
                    <td className="py-2 pr-3 text-red-700">{fmtPeso(r.expense)}</td>
                    <td className={`py-2 pr-3 font-medium ${r.net >= 0 ? "text-gray-700" : "text-amber-700"}`}>
                      {fmtPeso(r.net)}
                    </td>
                    <td className={`py-2 pr-3 font-semibold ${r.running >= 0 ? "text-gray-900" : "text-amber-800"}`}>
                      {fmtPeso(r.running)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-emerald-800">{fmtPeso(totalIncome)}</td>
                  <td className="py-2 pr-3 text-red-800">{fmtPeso(totalExpense)}</td>
                  <td className="py-2 pr-3">{fmtPeso(totalIncome - totalExpense)}</td>
                  <td className="py-2 pr-3">{fmtPeso(rows[rows.length - 1]?.running ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
