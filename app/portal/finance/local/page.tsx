import {
  requireLocalFinanceAccess,
  LOCALITY_LABEL,
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_LABEL,
} from "@/lib/portal";
import { currentMonthPH, monthToDate, monthLabel } from "@/lib/finance";
import { Notice, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { LocalFinanceGrid } from "@/components/portal/local-finance-grid";
import { LocalYearlyFinanceGrid } from "@/components/portal/local-yearly-finance-grid";
import { FinanceChart } from "@/components/portal/finance-chart";

export default async function LocalFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, month: monthParam, year: yearParam } = await searchParams;
  const { supabase, locality } = await requireLocalFinanceAccess();

  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthPH();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : month.slice(0, 4);

  const [monthRes, yearRes] = await Promise.all([
    supabase
      .from("financial_records")
      .select("category, amount, updated_at, profiles!financial_records_updated_by_fkey(full_name)")
      .eq("record_month", monthToDate(month))
      .eq("locality", locality),
    supabase
      .from("financial_records")
      .select("record_month, category, amount")
      .eq("locality", locality)
      .gte("record_month", `${year}-01-01`)
      .lt("record_month", `${Number(year) + 1}-01-01`),
  ]);

  const initial: Record<string, number> = {};
  let lastUpdated: { at: string; by: string } | null = null;
  for (const r of (monthRes.data ?? []) as any[]) {
    initial[r.category] = Number(r.amount);
    if (r.updated_at && (!lastUpdated || r.updated_at > lastUpdated.at)) {
      lastUpdated = { at: r.updated_at, by: r.profiles?.full_name ?? "Local Treasurer" };
    }
  }

  // Taunang buod: buwan x kategorya, para lang sa sariling lokal
  const yearGrid = new Map<string, number>(); // key = `${MM}_${category}`
  for (const r of (yearRes.data ?? []) as any[]) {
    const mm = (r.record_month as string).slice(5, 7);
    yearGrid.set(`${mm}_${r.category}`, Number(r.amount));
  }
  const yearInitialValues: Record<string, number> = Object.fromEntries(yearGrid);
  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <>
      <PageHeader
        title="Local Finance"
        subtitle="Pag-encode ng buwanang koleksyon para sa sariling lokal: Abuluyan, Ambagan, Tulong sa Aral, Pasalamat"
      />
      <Notice ok={ok} error={error} />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="year" value={year} />
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-gray-700">Buwan</span>
            <input type="month" name="month" defaultValue={month} className={inputCls} />
          </label>
          <button className={btnGhostCls}>Ipakita</button>
        </form>
      </Panel>

      <div className="mt-6">
        <Panel title={`I-encode: ${monthLabel(month)}`}>
          <LocalFinanceGrid
            month={month}
            localityLabel={LOCALITY_LABEL[locality]}
            categories={FINANCE_CATEGORIES}
            categoryLabel={FINANCE_CATEGORY_LABEL}
            initial={initial}
            lastUpdated={lastUpdated}
          />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`Taunang Buod · ${LOCALITY_LABEL[locality]} · ${year}`}>
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
              categories={FINANCE_CATEGORIES}
              categoryLabel={FINANCE_CATEGORY_LABEL}
              values={yearInitialValues}
            />
          </div>

          <LocalYearlyFinanceGrid
            year={year}
            categories={FINANCE_CATEGORIES}
            categoryLabel={FINANCE_CATEGORY_LABEL}
            initial={yearInitialValues}
          />
        </Panel>
      </div>
    </>
  );
}
