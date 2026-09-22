"use client";

import { useState } from "react";
import { fmtPeso, monthLabel } from "@/lib/finance";

type Props = {
  year: string;
  months: readonly string[]; // "01".."12"
  categories: readonly string[];
  categoryLabel: Record<string, string>;
  values: Record<string, number>; // key = `${MM}_${category}`
};

// Validated 4-slot categorical palette (dataviz skill reference palette), fixed order
const SERIES_COLORS: Record<number, string> = {
  0: "#2a78d6", // blue
  1: "#eb6834", // orange
  2: "#1baf7a", // aqua
  3: "#eda100", // yellow
};

const MONTH_ABBR_TL = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function FinanceChart({ year, months, categories, categoryLabel, values }: Props) {
  const [hover, setHover] = useState<{ mm: string; x: number; y: number } | null>(null);

  const monthTotal = (mm: string) => categories.reduce((s, c) => s + (values[`${mm}_${c}`] ?? 0), 0);
  const maxTotal = Math.max(...months.map(monthTotal), 0);
  const axisMax = niceMax(maxTotal || 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));

  const W = 760;
  const H = 260;
  const padL = 56;
  const padB = 28;
  const padT = 12;
  const padR = 8;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / months.length;
  const barW = Math.min(24, slot * 0.55);

  const y = (v: number) => padT + plotH - (v / axisMax) * plotH;

  const hasAnyData = maxTotal > 0;

  return (
    <div>
      {/* Legend: kulay ay palaging kasama ng text label, hindi lang kulay */}
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {categories.map((c, i) => (
          <span key={c} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: SERIES_COLORS[i % 4] }}
              aria-hidden
            />
            {categoryLabel[c]}
          </span>
        ))}
      </div>

      {!hasAnyData ? (
        <p className="py-8 text-center text-sm text-gray-500">Wala pang data na ipapakita sa graph para sa {year}.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Buwanang koleksyon, ${year}`} className="w-full min-w-[640px]">
            {/* Gridlines (hairline, recessive) + Y axis labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#e1e0d9"
                  strokeWidth={1}
                />
                <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#898781">
                  {t >= 1000 ? `${Math.round(t / 1000)}K` : t}
                </text>
              </g>
            ))}
            {/* Baseline */}
            <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />

            {months.map((mm, i) => {
              const cx = padL + slot * i + slot / 2;
              let cursorY = y(0);
              const total = monthTotal(mm);
              const segments = categories.map((c, ci) => {
                const v = values[`${mm}_${c}`] ?? 0;
                const top = cursorY - (v / axisMax) * plotH;
                const seg = { c, ci, v, y0: cursorY, y1: v > 0 ? top - 1 : top }; // 1px gap between stacked segments
                cursorY = top - 1;
                return seg;
              });
              const isHover = hover?.mm === mm;
              return (
                <g
                  key={mm}
                  onMouseEnter={(e) => setHover({ mm, x: cx, y: y(total) })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Malapad na hit-area para sa hover, mas malaki sa mismong bar */}
                  <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
                  {segments.map((seg, si) =>
                    seg.v > 0 ? (
                      <rect
                        key={seg.c}
                        x={cx - barW / 2}
                        y={Math.min(seg.y0, seg.y1)}
                        width={barW}
                        height={Math.max(1, Math.abs(seg.y0 - seg.y1))}
                        rx={si === segments.length - 1 || segments.slice(si + 1).every((s) => s.v === 0) ? 4 : 0}
                        fill={SERIES_COLORS[seg.ci % 4]}
                        opacity={isHover ? 1 : 0.92}
                      />
                    ) : null,
                  )}
                  <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="#52514e">
                    {MONTH_ABBR_TL[Number(mm) - 1]}
                  </text>
                </g>
              );
            })}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${(hover.x / W) * 100}%`,
                top: `${(Math.max(hover.y - 10, padT) / H) * 100}%`,
              }}
            >
              <div className="mb-1 font-semibold text-gray-900">{monthLabel(`${year}-${hover.mm}`)}</div>
              <div className="space-y-0.5">
                {categories.map((c, ci) => {
                  const v = values[`${hover.mm}_${c}`] ?? 0;
                  if (v === 0) return null;
                  return (
                    <div key={c} className="flex items-center justify-between gap-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: SERIES_COLORS[ci % 4] }}
                        />
                        {categoryLabel[c]}
                      </span>
                      <span className="font-medium text-gray-800">{fmtPeso(v)}</span>
                    </div>
                  );
                })}
                <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-100 pt-1 font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{fmtPeso(monthTotal(hover.mm))}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
