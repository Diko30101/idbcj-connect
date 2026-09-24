// Mga helper ng pagpapakita ng finance_audit_log (010). Pure at walang import (ligtas sa client at masusubok sa Node).
// Ang log ay nababasa lang ng church-wide Finance (RLS); ang mga helper na ito ay para sa pagbabasa ng nakasulat na.

export const AUDIT_TABLE_LABEL: Record<string, string> = {
  abuluyan_totals: "Abuluyan",
  attendance_records: "Attendance",
  ambagan_records: "Ambagan",
  tulong_klase_records: "Tulong sa Klase Ministeryal",
  pasalamat_records: "Pasalamat",
  giving_permissions: "Pahintulot",
  members: "Roster (kaanib)",
  ministry_members: "Miyembro ng Ministry",
};

export function auditTableLabel(table: string): string {
  return AUDIT_TABLE_LABEL[table] ?? table;
}

export const AUDIT_FIELD_LABEL: Record<string, string> = {
  status: "Status",
  amount: "Halaga",
  total_amount: "Halaga",
  service_date: "Linggo",
  period_month: "Buwan",
  date_received: "Petsa ng pagtanggap",
  date: "Petsa",
  type: "Uri",
  notes: "Tala",
  local_id: "Local",
  member_id: "Kaanib",
  full_name: "Pangalan",
  status_reason: "Dahilan ng status",
  confirmed_at: "Kumpirmasyon",
  confirmed_by: "Kinumpirma ni",
  valid_until: "Valid hanggang",
  consultation_note: "Tala ng konsultasyon",
  revoked_at: "Nabawi noong",
  revoked_by: "Binawi ni",
  reason: "Dahilan",
  finance_scope: "Saklaw ng Finance",
  is_leader: "Lider",
  submitted_at: "Naipadala noong",
  submitted_by: "Ipinadala ni",
  submitted_date: "Petsa ng pagpapadala",
  voided_at: "Na-void noong",
  voided_by: "Na-void ni",
  void_reason: "Dahilan ng void",
  replaces_id: "Kapalit ng",
  present: "Dumalo",
  profile_id: "Naka-link na profile",
};

// Mga field na nagbabago sa bawat pag-update at walang saysay sa pagbabasa ng audit
// (status_changed_at/by ay inuulit lang ang changed_by at ang oras ng tala)
const IGNORED_FIELDS = new Set(["updated_at", "created_at", "status_changed_at", "status_changed_by"]);

export type AuditChange = { field: string; label: string; from: string; to: string };

export function fmtAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "oo" : "hindi";
  const s = typeof v === "string" ? v : typeof v === "number" ? String(v) : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

// Ang mga field na nagbago sa pagitan ng dating at bagong halaga ng isang UPDATE. Ang INSERT (walang dating halaga) ay walang diff.
export function diffAudit(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null): AuditChange[] {
  if (!oldValues || !newValues) return [];
  const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])].filter((k) => !IGNORED_FIELDS.has(k)).sort();
  const out: AuditChange[] = [];
  for (const k of keys) {
    if (JSON.stringify(oldValues[k]) === JSON.stringify(newValues[k])) continue;
    out.push({ field: k, label: AUDIT_FIELD_LABEL[k] ?? k, from: fmtAuditValue(oldValues[k]), to: fmtAuditValue(newValues[k]) });
  }
  return out;
}

// "2026-09-24T13:25:18.548613+00:00" -> "Sep 24, 2026, 9:25 PM" (oras sa Manila). Ang hindi ISO na teksto ay hindi ginagalaw.
export function fmtAuditTime(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
