import Link from "next/link";
import { requireRoles, LOCALITIES, LOCALITY_LABEL, FINANCE_CATEGORIES, FINANCE_CATEGORY_LABEL, type FinanceCategory, type Locality } from "@/lib/portal";
import { monthLabel, fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";
import { YearlyLocalityGrid } from "@/components/portal/yearly-locality-grid";
import { FinanceChart } from "@/components/portal/finance-chart";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; locality?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, year: yearParam, locality: localityParam } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary", "treasurer"]);

  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : String(new Date().getFullYear());
  const localityFilter =
    localityParam && LOCALITIES.includes(localityParam as Locality) ? (localityParam as Locality) : "";

  const { data: yearRows } = await supabase
    .from("financial_records")
    .select("record_month, locality, category, amount")
    .gte("record_month", `${year}-01-01`)
    .lt("record_month", `${Number(year) + 1}-01-01`);

  // Taunang buod: buwan x kategorya (kinukuha ang lahat ng lokal maliban kung may locality filter)
  const yearGrid = new Map<string, number>(); // key = `${MM}_${category}`
  for (const r of (yearRows ?? []) as any[]) {
    if (localityFilter && r.locality !== localityFilter) continue;
    const mm = (r.record_month as string).slice(5, 7);
    const key = `${mm}_${r.category}`;
    yearGrid.set(key, (yearGrid.get(key) ?? 0) + Number(r.amount));
  }
  const yearInitialValues: Record<string, number> = Object.fromEntries(yearGrid);
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
        subtitle="Taunang ulat at graph ng koleksyon (Abuluyan, Ambagan, Tulong sa Aral, Pasalamat). Ang pag-encode buwan-buwan ay sa mga Local Finance Ministry member."
      />
      <Notice ok={ok} error={error} />

      <div className="mt-6">
        <Panel
          title={
            localityFilter
              ? `Taunang Buod · ${LOCALITY_LABEL[localityFilter]} · ${year}`
              : `Taunang Buod (Spreadsheet View) · Lahat ng Lokal · ${year}`
          }
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <form method="get" className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Taon</span>
                <input type="number" name="year" defaultValue={year} className={inputCls + " w-28"} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Lokal</span>
                <select name="locality" defaultValue={localityFilter} className={inputCls}>
                  <option value="">Lahat ng Lokal</option>
                  {LOCALITIES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALITY_LABEL[l]}
                    </option>
                  ))}
                </select>
              </label>
              <button className={btnGhostCls}>Ipakita</button>
            </form>
            <Link href={`/portal/finance/export?year=${year}`} className={btnCls}>
              I-download bilang CSV ({year})
            </Link>
          </div>

          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
            <FinanceChart
              year={year}
              months={months12}
              categories={FINANCE_CATEGORIES}
              categoryLabel={FINANCE_CATEGORY_LABEL}
              values={yearInitialValues}
            />
          </div>

          {localityFilter ? (
            <YearlyLocalityGrid
              year={year}
              locality={localityFilter}
              localityLabel={LOCALITY_LABEL[localityFilter]}
              categories={FINANCE_CATEGORIES}
              categoryLabel={FINANCE_CATEGORY_LABEL}
              initial={yearInitialValues}
            />
          ) : yearGrid.size === 0 ? (
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
