// Mga constant ng Attendance Record.
//
// WALANG "use server" sa file na ito -- sadyang hiwalay sa actions.ts,
// dahil ang "use server" file ay async functions lang ang pwedeng
// i-export. Dito naka-lagay ang mga constant para magamit ng page,
// form, at actions nang walang paglabag sa patakaran ng Server Actions.
export const ATTENDANCE_RECORD_BASE = "/portal/attendance-record";

// Mga uri ng pagkakatipon: label na Tagalog (gaya ng sa Pasalamat) at ang
// katumbas na value ng finance_service_type enum sa database.
// Tanging ang "Pagsamba" (Linggo) lang ang kailangang tumapat sa araw ng
// Linggo; ang mga Pasalamat at Ibang dahilan ay pwedeng kahit anong araw
// sa kalendaryo. Ang "Ibang dahilan…" ay free-text: ang user ang
// magta-type ng uri ng pagkakatipon (sakop na nito ang Extra/Private).
export const GATHERING_TYPES = [
  { value: "Linggo", label: "Pagsamba", sundayOnly: true, custom: false },
  { value: "Anniversary Thanksgiving", label: "Anniversary Pasalamat", sundayOnly: false, custom: false },
  { value: "Taunang Pasalamat", label: "Taunang Pasalamat", sundayOnly: false, custom: false },
  { value: "Birthday Pasalamat", label: "Birthday Pasalamat", sundayOnly: false, custom: false },
  { value: "Ibang Pasalamat", label: "Ibang dahilan…", sundayOnly: false, custom: true },
] as const;

// Kapareho ng finance_service_type enum sa database (mga value, pang-validate)
export const SERVICE_TYPES = GATHERING_TYPES.map((t) => t.value);

export function gatheringTypeLabel(value: string): string {
  return GATHERING_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function isCustomType(value: string): boolean {
  return GATHERING_TYPES.find((t) => t.value === value)?.custom ?? false;
}

// Buong label na may kasamang custom na dahilan,
// hal. "Ibang dahilan: Paggunita sa mga yumao".
export function gatheringTypeDisplay(value: string, customReason?: string | null): string {
  const t = GATHERING_TYPES.find((t) => t.value === value);
  if (t?.custom) {
    const reason = (customReason ?? "").trim();
    return reason ? `Ibang dahilan: ${reason}` : "Ibang dahilan";
  }
  return t?.label ?? value;
}

export function isSundayOnlyType(value: string): boolean {
  return GATHERING_TYPES.find((t) => t.value === value)?.sundayOnly ?? true;
}

// --- Petsa ---
// Tanging wastong petsa sa kalendaryo (hal. hindi "2026-02-30").
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    !isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// Tanging Linggo lang ang pwedeng pagtalaan ng pagdalo para sa "Linggo".
export function isSunday(dateStr: string): boolean {
  if (!isValidDate(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Pinakahuling Linggo batay sa petsa ngayon (kasama ang ngayon kung Linggo).
export function lastSunday(todayStr: string): string {
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return addDays(todayStr, -dt.getUTCDay());
}

export function fmtSundayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Listahan ng mga Linggo: `past` na nakaraan + `future` na paparating,
// para madaling pumili ng petsa ng pagkakatipon (kasama ang mga dating Linggo).
export function listSundays(todayStr: string, past = 12, future = 4): { value: string; label: string }[] {
  const anchor = lastSunday(todayStr);
  const out: { value: string; label: string }[] = [];
  for (let i = -past; i <= future; i++) {
    const v = addDays(anchor, i * 7);
    out.push({ value: v, label: fmtSundayLabel(v) });
  }
  return out;
}
