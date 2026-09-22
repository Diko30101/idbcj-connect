import Link from "next/link";
import { fmtPeso } from "@/lib/finance";

type Props = {
  year: string;
  income: number;
  expense: number;
};

// Income/expense ay hindi generic na categories — may nakabaon nang kahulugan (pumasok vs lumabas),
// kaya sinusundan ang parehong emerald/red convention na ginagamit na ng Audit Report cards,
// imbes na ang neutral na 4-slot categorical palette ng FinanceChart.
const INCOME_COLOR = "#1baf7a";
const EXPENSE_COLOR = "#e0483e";

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

export function FinanceSummaryPie({ year, income, expense }: Props) {
  const total = income + expense;
  const balance = income - expense;
  const cx = 60;
  const cy = 60;
  const r = 56;

  let slices: { color: string; label: string; value: number; path: string }[] = [];
  if (total > 0) {
    const incomeAngle = (income / total) * 360;
    slices = [
      { color: INCOME_COLOR, label: "Pumasok", value: income, path: arcPath(cx, cy, r, 0, incomeAngle) },
      { color: EXPENSE_COLOR, label: "Lumabas", value: expense, path: arcPath(cx, cy, r, incomeAngle, 360) },
    ].filter((s) => s.value > 0);
  }

  return (
    <div>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Wala pang data ng finance para sa {year}.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <svg viewBox="0 0 120 120" role="img" aria-label={`Pumasok vs lumabas, ${year}`} className="h-32 w-32 shrink-0">
            {slices.length === 1 ? (
              <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
            ) : (
              slices.map((s) => <path key={s.label} d={s.path} fill={s.color} />)
            )}
          </svg>

          <div className="min-w-[160px] flex-1 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} aria-hidden />
                Pumasok
              </span>
              <span className="font-medium text-gray-900">{fmtPeso(income)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} aria-hidden />
                Lumabas
              </span>
              <span className="font-medium text-gray-900">{fmtPeso(expense)}</span>
            </div>
            <div
              className={`flex items-center justify-between gap-3 border-t border-gray-100 pt-2 font-semibold ${
                balance >= 0 ? "text-blue-700" : "text-amber-700"
              }`}
            >
              <span>Balanse</span>
              <span>{fmtPeso(balance)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-right">
        <Link href={`/portal/finance/report?year=${year}`} className="text-sm font-semibold text-emerald-700 hover:underline">
          Tingnan ang buong ulat →
        </Link>
      </div>
    </div>
  );
}
