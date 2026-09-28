// Mga tipo at helper ng Pagsamba (regular na Linggong worship service): Paksa (church-wide, buwanan) + Sugo
// (per local, per Linggo). Pure at walang import na server-only, kaya ligtas sa client. Ang database
// (RLS, validate_pagsamba_sugo) ang huling harang.
//
// Doktrina: ang Paksa ay iisa para sa buong Iglesia bawat Linggo ng buwan (hindi kanya-kanyang local).
// Ang Sugo ay per-local, pinipili ng Leader ng Pastoral Ministry (o Admin) mula sa Pastoral Ministry
// members ng local na iyon. Ang bilang ng dumalo/panauhin ay hindi dito ie-encode — kukunin lang
// (read-only) mula sa attendance_records/attendance_guests, service_type = "Linggo" lang.

export { parsePeriodMonth } from "@/lib/giving";

export const PAGSAMBA_BASE = "/portal/pagsamba";
export const PAGSAMBA_MAX_WEEKS = 5;
export const PAGSAMBA_PAKSA_MAX = 500;
export const PAGSAMBA_NOTES_MAX = 500;
export const PAGSAMBA_DOCX_MAX_BYTES = 15 * 1024 * 1024;

export type PagsambaTopic = {
  id: string;
  period_month: string; // YYYY-MM-01
  week_number: number; // 1..5
  paksa: string;
  source_docx_path: string | null;
};

export type PagsambaRecord = {
  id: string;
  local_id: string;
  service_date: string; // YYYY-MM-DD
  sugo_id: string | null;
  notes: string | null;
};

export type SugoChoice = { id: string; full_name: string };

// Bawat Linggo (Sunday) ng isang buwan, pagkasunod-sunod (Linggo 1..5). "YYYY-MM" -> ["YYYY-MM-DD", ...]
export function sundaysOfMonth(month: string): string[] {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month.trim());
  if (!m) return [];
  const year = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const dates: string[] = [];
  const d = new Date(Date.UTC(year, mon, 1));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); // unang Linggo ng buwan
  while (d.getUTCMonth() === mon) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}
