import Link from "next/link";
import { requireRoles, LOCALITIES, LOCALITY_LABEL, FINANCE_CATEGORIES, FINANCE_CATEGORY_LABEL, type FinanceCategory } from "@/lib/portal";
import { currentMonthPH, monthToDate, monthLabel, fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";
import { FinanceGrid } from "@/components/portal/finance-grid";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, month: monthParam, year: yearParam } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary", "treasurer"]);

  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthPH();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : month.slice(0, 4);

  const [monthRows, yearRows] = await Promise.all([
    supabase
      .from("financial_records")
      .select("locality, category, amount, updated_at, profiles(full_name)")
      .eq("record_month", monthToDate(month)),
    supabase
      .from("financial_records")
      .select("record_month, category, amount")
      .gte("record_month", `${year}-01-01`)
      .lt("record_month", `${Number(year) + 1}-01-01`),
  ]);

  // Grid ng buwang pinili: locality x category
  const grid = new Map<string, number>();
  let lastUpdated: { at: string; by: string } | null = null;
  for (const r of (monthRows.data ?? []) as any[]) {
    grid.set(`${r.locality}_${r.category}`, Number(r.amount));
    if (r.updated_at && (!lastUpdated || r.updated_at > lastUpdated.at)) {
      lastUpdated = { at: r.updated_at, by: r.profiles?.full_name ?? "Staff" };
    }
  }
  const initialValues: Record<string, number> = Object.fromEntries(grid);

  // Taunang buod: buwan x kategorya
  const yearGrid = new Map<string, number>(); // key = `${MM}_${category}`
  for (const r of (yearRows.data ?? []) as any[]) {
    const mm = (r.record_month as string).slice(5, 7);
    const key = `${mm}_${r.category}`;
    yearGrid.set(key, (yearGrid.get(key) ?? 0) + Number(r.amount));
  }
  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const yearCatTotal = (category: FinanceCategory) =>
    months12.reduce((s, mm) => s + (yearGrid.get(`${mm}_${category}`) ?? 0), 0);
  const yearMonthTotal = (mm: string) =>
    FINANCE_CATEGORIES.reduce((s, c) => s + (yearGrid.get(`${mm}_${c}`) ?? 0), 0);
  const yearGrandTotal = FINANCE_CATEGORIES.reduce((s, c) => s + yearCatTotal(c), 0);

  return (
    <>
      <PageHeader
        title="Financial Management"
        subtitle="Buwanang koleksyon: Abuluyan, Ambagan, Tulong sa Aral, Pasalamat"
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
        <Panel title={`I-encode: ${monthLabel(month)}`}>
          <FinanceGrid
            month={month}
            localities={LOCALITIES}
            localityLabel={LOCALITY_LABEL}
            categories={FINANCE_CATEGORIES}
            categoryLabel={FINANCE_CATEGORY_LABEL}
            initial={initialValues}
            lastUpdated={lastUpdated}
          />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel
          title={`Taunang Buod (Spreadsheet View) · ${year}`}
          className=""
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="month" value={month} />
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Taon</span>
                <input type="number" name="year" defaultValue={year} className={inputCls + " w-28"} />
              </label>
              <button className={btnGhostCls}>Ipakita</button>
            </form>
            <Link href={`/portal/finance/export?year=${year}`} className={btnCls}>
              I-download bilang CSV ({year})
            </Link>
          </div>

          {(yearRows.data ?? []).length === 0 ? (
            <Empty>Wala pang naitatalang koleksyon para sa {year}.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Buwan</th>
                    {FINANCE_CATEGORIES.map((c) => (
                      <th key={c} className="py-2 pr-3">
                        {FINANCE_CATEGORY_LABEL[c]}
                      </th>
                    ))}
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {months12.map((mm) => (
                    <tr key={mm} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">{monthLabel(`${year}-${mm}`)}</td>
                      {FINANCE_CATEGORIES.map((c) => (
                        <td key={c} className="py-2 pr-3 text-gray-700">
                          {fmtPeso(yearGrid.get(`${mm}_${c}`) ?? 0)}
                        </td>
                      ))}
                      <td className="py-2 pr-3 font-semibold text-gray-700">{fmtPeso(yearMonthTotal(mm))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                    <td className="py-2 pr-3">Total</td>
                    {FINANCE_CATEGORIES.map((c) => (
                      <td key={c} className="py-2 pr-3">
                        {fmtPeso(yearCatTotal(c))}
                      </td>
                    ))}
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
