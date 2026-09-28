"use client";

import { useRouter } from "next/navigation";

const selectCls =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

// Taon lang ang pinipili -- ginagamit ng Taunang Pasalamat (araw-araw ay Enero 1) at Anniversary
// Pasalamat (Disyembre 1), dahil pangkalahatan ang mga ito at may eksaktong petsa bawat taon
// (hindi tulad ng Extra/Monthly Pasalamat na walang fix na petsa). Isinusulat pa rin bilang
// "?buwan=YYYY-01" o "?buwan=YYYY-12" ang URL (kapalit lang ito ng MonthYearNav) para gumana nang
// walang pagbabago ang natitirang lohika ng pahina (loadPasalamatPage, PasalamatLocalSwitcher).
export function PasalamatYearNav({
  year,
  fixedMonth,
  fixedLabel,
  basePath,
  localId,
  yearsBack = 5,
  yearsForward = 1,
}: {
  year: number;
  fixedMonth: "01" | "12";
  fixedLabel: string; // hal. "Enero 1" o "Disyembre 1"
  basePath: string;
  localId?: string;
  yearsBack?: number;
  yearsForward?: number;
}) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(year, currentYear - yearsBack);
  const maxYear = Math.max(year, currentYear + yearsForward);
  const years: number[] = [];
  for (let yy = minYear; yy <= maxYear; yy++) years.push(yy);

  const go = (newYear: number) => {
    router.push(`${basePath}?buwan=${newYear}-${fixedMonth}${localId ? `&local=${localId}` : ""}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">{fixedLabel} ·</span>
      <select aria-label="Taon" value={year} onChange={(e) => go(Number(e.target.value))} className={selectCls}>
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
    </div>
  );
}
