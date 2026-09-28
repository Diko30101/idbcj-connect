"use client";

import { useRouter } from "next/navigation";

const TAGALOG_MONTHS = [
  "Enero",
  "Pebrero",
  "Marso",
  "Abril",
  "Mayo",
  "Hunyo",
  "Hulyo",
  "Agosto",
  "Setyembre",
  "Oktubre",
  "Nobyembre",
  "Disyembre",
];

const selectCls =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

// Pagpili ng Buwan at Taon (kapalit ng "Nakaraang buwan / Susunod na buwan"), ginagamit sa Ambagan,
// Abuluyan, at Tulong sa Klase Ministeryal. Direktang lumilipat sa piniling buwan sa halip na
// paisa-isang pag-click.
export function MonthYearNav({
  buwan, // YYYY-MM
  basePath,
  localId,
  extraQuery,
  yearsBack = 5,
  yearsForward = 1,
}: {
  buwan: string;
  basePath: string;
  localId?: string;
  // Karagdagang query param na dapat manatili kapag lumipat ng buwan/taon (hal. member_id).
  extraQuery?: Record<string, string | undefined>;
  yearsBack?: number;
  yearsForward?: number;
}) {
  const router = useRouter();
  const [y, m] = buwan.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(y || currentYear, currentYear - yearsBack);
  const maxYear = Math.max(y || currentYear, currentYear + yearsForward);
  const years: number[] = [];
  for (let yy = minYear; yy <= maxYear; yy++) years.push(yy);

  const go = (newYear: number, newMonth: number) => {
    const nb = `${newYear}-${String(newMonth).padStart(2, "0")}`;
    const params = new URLSearchParams({ buwan: nb });
    if (localId) params.set("local", localId);
    for (const [k, v] of Object.entries(extraQuery ?? {})) if (v) params.set(k, v);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Buwan"
        value={m || 1}
        onChange={(e) => go(y || currentYear, Number(e.target.value))}
        className={selectCls}
      >
        {TAGALOG_MONTHS.map((label, i) => (
          <option key={i} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select aria-label="Taon" value={y || currentYear} onChange={(e) => go(Number(e.target.value), m || 1)} className={selectCls}>
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
    </div>
  );
}
