import {
  requireLocalFinanceAccess,
  LOCALITY_LABEL,
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_LABEL,
} from "@/lib/portal";
import { currentMonthPH, monthLabel, fmtPeso } from "@/lib/finance";
import { pasalamatTypeLabel } from "@/lib/giving";
import { getYearlyCollections, LOCALITY_TO_LOCAL_KEY } from "@/lib/finance-collections";
import { Notice, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { FinanceChart } from "@/components/portal/finance-chart";

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type GiverRow = { memberId: string; extra: string; date: string; amount: number };

// Hilaw na row mula sa tatlong giving table (pare-pareho ang hugis na kailangan).
type GiverDbRow = {
  member_id?: string | null;
  amount?: number | string | null;
  date?: string | null;
  date_received?: string | null;
  type?: string | null;
  period_month?: string | null;
};

// Table sheet ng mga nagkaloob (naipadala na) sa isang kategorya.
function GiverTable({
  title,
  extraHeader,
  rows,
  names,
  emptyText,
}: {
  title: string;
  extraHeader: string;
  rows: GiverRow[];
  names: Record<string, string>;
  emptyText: string;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <section className="mb-8 last:mb-0">
      <h3 className="mb-2 text-base font-semibold text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Kaanib</th>
                <th className="py-2 pr-3">{extraHeader}</th>
                <th className="py-2 pr-3">Petsa</th>
                <th className="py-2 text-right">Halaga</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.memberId}-${r.date}-${i}`} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-800">
                    {names[r.memberId] ?? "(hindi mabasa ang pangalan)"}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{r.extra}</td>
                  <td className="py-2 pr-3 text-gray-700">{fmtDate(r.date)}</td>
                  <td className="py-2 text-right text-gray-700">{fmtPeso(r.amount)}</td>
                </tr>
              ))}
              <tr className="bg-emerald-700 font-bold text-white [print-color-adjust:exact]">
                <td className="px-2 py-2" colSpan={3}>
                  Kabuuan
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtPeso(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Local Finance: read-only na buod ng koleksyon ng sariling lokal.
// Ang data ay galing LAMANG sa apat na pinagmumulan na in-encode ng
// Local Finance Ministry: Abuluyan, Ambagan, Tulong sa Aral, Pasalamat
// (mga naipadala na; hindi kasama ang draft at void). Walang manu-manong
// pag-encode dito.
export default async function LocalFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ok?: string; error?: string }>;
}) {
  const { ok, error, month: monthParam, year: yearParam } = await searchParams;
  const { supabase, locality } = await requireLocalFinanceAccess();

  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthPH();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : month.slice(0, 4);
  const mm = month.slice(5, 7);
  const localKey = LOCALITY_TO_LOCAL_KEY[locality];

  const collections = await getYearlyCollections(supabase, year);
  const mine = collections.filter((r) => r.localKey === localKey);

  // Buwanang buod (napiling buwan)
  const monthTotals = new Map<string, number>();
  for (const r of mine) {
    if (r.month !== mm) continue;
    monthTotals.set(r.category, (monthTotals.get(r.category) ?? 0) + r.amount);
  }
  const monthGrand = FINANCE_CATEGORIES.reduce((s, c) => s + (monthTotals.get(c) ?? 0), 0);

  // Taunang buod: buwan x kategorya
  const yearGrid = new Map<string, number>();
  for (const r of mine) {
    const key = `${r.month}_${r.category}`;
    yearGrid.set(key, (yearGrid.get(key) ?? 0) + r.amount);
  }
  const yearValues: Record<string, number> = Object.fromEntries(yearGrid);
  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const yearCatTotal = (c: string) => months12.reduce((s, m) => s + (yearGrid.get(`${m}_${c}`) ?? 0), 0);
  const yearMonthTotal = (m: string) => FINANCE_CATEGORIES.reduce((s, c) => s + (yearGrid.get(`${m}_${c}`) ?? 0), 0);
  const yearGrandTotal = FINANCE_CATEGORIES.reduce((s, c) => s + yearCatTotal(c), 0);

  // Mga nagkaloob (naipadala na; hindi kasama ang draft at void) sa napiling taon,
  // ayon sa local ng gumagamit — table sheet sa ibaba ng taunang buod.
  const { data: localsList } = await supabase.from("locals").select("id, key");
  const localId =
    ((localsList ?? []) as { id: string; key: string }[]).find((l) => l.key === localKey)?.id ?? null;

  async function fetchGivers(
    table: "pasalamat_records" | "tulong_klase_records" | "ambagan_records",
  ): Promise<GiverRow[]> {
    const out: GiverRow[] = [];
    if (!localId) return out;
    const dateCol = table === "pasalamat_records" ? "date" : "date_received";
    const extraCol = table === "pasalamat_records" ? "type" : "period_month";
    const PAGE = 1000;
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from(table)
        .select(`member_id, ${dateCol}, amount, ${extraCol}`)
        .eq("local_id", localId)
        .eq("status", "submitted")
        .gte(dateCol, `${year}-01-01`)
        .lt(dateCol, `${Number(year) + 1}-01-01`)
        .order(dateCol, { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      const rows = (data ?? []) as unknown as GiverDbRow[];
      for (const r of rows) {
        out.push({
          memberId: String(r.member_id ?? ""),
          extra: String(r[extraCol] ?? ""),
          date: String(r[dateCol] ?? "").slice(0, 10),
          amount: Number(r.amount) || 0,
        });
      }
      if (rows.length < PAGE) break;
    }
    return out;
  }

  const [pasalamatRaw, tulongRaw, ambaganRaw] = await Promise.all([
    fetchGivers("pasalamat_records"),
    fetchGivers("tulong_klase_records"),
    fetchGivers("ambagan_records"),
  ]);
  const pasalamatGivers = pasalamatRaw.map((r) => ({ ...r, extra: pasalamatTypeLabel(r.extra) }));
  const tulongGivers = tulongRaw.map((r) => ({ ...r, extra: monthLabel(r.extra.slice(0, 7)) }));
  const ambaganGivers = ambaganRaw.map((r) => ({ ...r, extra: monthLabel(r.extra.slice(0, 7)) }));

  const giverIds = [
    ...new Set(
      [...pasalamatGivers, ...tulongGivers, ...ambaganGivers].map((r) => r.memberId).filter(Boolean),
    ),
  ];
  const giverNames: Record<string, string> = {};
  if (giverIds.length > 0) {
    const { data: nm } = await supabase.rpc("member_display_names", { p_ids: giverIds });
    for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) giverNames[n.member_id] = n.full_name;
  }

  return (
    <>
      <PageHeader
        title="Local Finance"
        subtitle={`Koleksyon ng ${LOCALITY_LABEL[locality]} mula sa Abuluyan, Ambagan, Tulong sa Aral at Pasalamat na na-encode ng Local Finance Ministry`}
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
        <Panel title={`Buod · ${monthLabel(month)}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FINANCE_CATEGORIES.map((c) => (
              <div key={c} className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {FINANCE_CATEGORY_LABEL[c]}
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">{fmtPeso(monthTotals.get(c) ?? 0)}</div>
              </div>
            ))}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Kabuuang Pumasok</div>
              <div className="mt-1 text-xl font-bold text-emerald-900">{fmtPeso(monthGrand)}</div>
            </div>
          </div>
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
              values={yearValues}
            />
          </div>

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
                {months12.map((m) => (
                  <tr key={m} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{monthLabel(`${year}-${m}`)}</td>
                    {FINANCE_CATEGORIES.map((c) => (
                      <td key={c} className="py-2 pr-3 text-gray-700">
                        {fmtPeso(yearGrid.get(`${m}_${c}`) ?? 0)}
                      </td>
                    ))}
                    <td className="py-2 pr-3 font-semibold text-gray-700">{fmtPeso(yearMonthTotal(m))}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-700 font-bold text-white [print-color-adjust:exact]">
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
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`Mga Nagkaloob · ${LOCALITY_LABEL[locality]} · ${year}`}>
          <GiverTable
            title="Pasalamat"
            extraHeader="Uri"
            rows={pasalamatGivers}
            names={giverNames}
            emptyText="Wala pang naipadalang Pasalamat sa taong ito."
          />
          <GiverTable
            title="Tulong sa Aral"
            extraHeader="Buwan"
            rows={tulongGivers}
            names={giverNames}
            emptyText="Wala pang naipadalang Tulong sa Aral sa taong ito."
          />
          <GiverTable
            title="Ambagan"
            extraHeader="Buwan"
            rows={ambaganGivers}
            names={giverNames}
            emptyText="Wala pang naipadalang Ambagan sa taong ito."
          />
        </Panel>
      </div>
    </>
  );
}
