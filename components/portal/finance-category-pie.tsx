import { fmtPeso, FINANCE_CATEGORIES, FINANCE_CATEGORY_LABEL, type FinanceCategory } from "@/lib/finance";

// Parehong 4-slot categorical palette ng FinanceChart (Audit Report), ayon sa
// pagkakasunod ng FINANCE_CATEGORIES: Abuluyan, Ambagan, Tulong sa Aral, Pasalamat.
export const FINANCE_CATEGORY_COLORS: Record<FinanceCategory, string> = {
  abuluyan: "#2a78d6", // blue
  ambagan: "#eb6834", // orange
  tulong_sa_aral: "#1baf7a", // aqua
  pasalamat: "#eda100", // yellow
};

export type PieSlice = { label: string; value: number; color: string };

function polarToXY(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(cx, cy, r, endAngle);
  const end = polarToXY(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function buildCategorySlices(totals: Map<FinanceCategory, number>): PieSlice[] {
  return FINANCE_CATEGORIES.map((c) => ({
    label: FINANCE_CATEGORY_LABEL[c],
    value: totals.get(c) ?? 0,
    color: FINANCE_CATEGORY_COLORS[c],
  }));
}

// Pie chart ng koleksyon ayon sa kategorya (SVG, walang dependency).
export function FinanceCategoryPie({
  year,
  title,
  slices,
}: {
  year: string;
  title: string;
  slices: PieSlice[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = 60;
  const cy = 60;
  const r = 56;

  let angle = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = angle;
      angle += (s.value / total) * 360;
      return { ...s, path: arcPath(cx, cy, r, start, angle) };
    });

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-gray-900">{title}</h3>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Wala pang data para sa {year}.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={`${title}, ${year}`}
            className="h-36 w-36 shrink-0"
          >
            {arcs.length === 1 ? (
              <circle cx={cx} cy={cy} r={r} fill={arcs[0].color} />
            ) : (
              arcs.map((a) => <path key={a.label} d={a.path} fill={a.color} />)
            )}
          </svg>
          <div className="min-w-[190px] flex-1 space-y-1.5 text-sm">
            {slices.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.label}
                </span>
                <span className="font-medium text-gray-900">
                  {fmtPeso(s.value)}{" "}
                  <span className="font-normal text-gray-400">
                    ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
