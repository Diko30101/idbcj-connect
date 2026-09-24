// Ligtas gamitin sa browser at sa server (walang server-only import dito)

export type FinanceCategory = "abuluyan" | "ambagan" | "tulong_sa_aral" | "pasalamat";

export const FINANCE_CATEGORIES: FinanceCategory[] = ["abuluyan", "ambagan", "tulong_sa_aral", "pasalamat"];

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  abuluyan: "Abuluyan",
  ambagan: "Ambagan",
  tulong_sa_aral: "Tulong sa Aral",
  pasalamat: "Pasalamat",
};

const MONTH_NAMES_TL = [
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

// Petsa (Philippine time) sa buwan ngayon, format na "YYYY-MM"
export function currentMonthPH(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
}

// "2026-09" -> "2026-09-01" (unang araw ng buwan, para sa database)
export function monthToDate(month: string): string {
  return `${month}-01`;
}

// "2026-09-01" -> "2026-09"
export function dateToMonth(date: string): string {
  return date.slice(0, 7);
}

// "2026-09" -> "Setyembre 2026"
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES_TL[(m ?? 1) - 1] ?? month} ${y}`;
}

// year="2026", month=9 -> "Enero–Setyembre 2026" (o "Enero 2026" kung Enero pa lang)
export function yearToDateLabel(year: string, month: number): string {
  const from = MONTH_NAMES_TL[0];
  const through = MONTH_NAMES_TL[month - 1] ?? from;
  return month <= 1 ? `${from} ${year}` : `${from}–${through} ${year}`;
}

export function fmtPeso(n: number): string {
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-09-27" -> true kung Linggo. Ginagamit ang UTC parsing (hindi
// browser/server local time) dahil ang service_date ay plain calendar date
// (`date` column, walang oras) — ang araw-ng-linggo ng isang calendar date
// ay hindi nagbabago kahit anong timezone, kaya walang timezone conversion
// na kailangan dito; ang locals.timezone ay para lang sa pag-default ng
// "petsa ngayon" sa form (see todayInTimezone), hindi sa Sunday check mismo.
export function isSunday(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 0;
}

// "Petsa ngayon" (YYYY-MM-DD) base sa timezone ng isang partikular na local
// (mula sa locals.timezone column) — ginagamit para i-default ang date
// picker sa Abuluyan form sa tamang araw ayon sa lokal na iyon.
export function todayInTimezone(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}
