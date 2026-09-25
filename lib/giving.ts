// Mga tipo at helper ng per-member na handog (Ambagan, Tulong sa Klase Ministeryal, Pasalamat). Pure at walang import,
// kaya ligtas sa client at masusubok sa Node. Ang database (011/012/016) ang huling harang.
//
// Doktrina (spec seksyon 1): malaya ang halaga (walang default, suggested o expected; ang tanging patakaran ay > 0);
// ang kawalan ng record ay hindi paglabag (walang wika, ulat o paalala tungkol dito); walang tinatanggap mula sa hindi kaanib.

export type GivingStatus = "draft" | "submitted" | "void";

export const GIVING_STATUS_LABEL: Record<GivingStatus, string> = {
  draft: "Draft",
  submitted: "Naipadala",
  void: "Void",
};

export type AmbaganRecord = {
  id: string;
  local_id: string;
  member_id: string;
  period_month: string; // YYYY-MM-01
  amount: number;
  date_received: string; // YYYY-MM-DD
  notes: string | null;
  status: GivingStatus;
};

export type MemberChoice = { id: string; full_name: string; local_name: string; status: string };

export const GIVING_BASE = "/portal/finance";
export const GIVING_PATHS = [`${GIVING_BASE}/ambagan`, `${GIVING_BASE}/tulong`, `${GIVING_BASE}/pasalamat`];
export const GIVING_AMOUNT_MAX = 9999999999.99; // numeric(12,2)
export const GIVING_NOTES_MAX = 500;

// Ang halaga ay malaya pero > 0, hanggang 2 decimal. Ang "invalid" ay hindi kailanman tahimik na binabago.
export function parseGivingAmount(v: string): number | "invalid" {
  const t = v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "invalid";
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > GIVING_AMOUNT_MAX) return "invalid";
  return Math.round(n * 100) / 100;
}

// "2026-09" -> "2026-09-01" (ang period_month ay dapat unang araw ng buwan)
export function parsePeriodMonth(v: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}

// Tunay na petsa ng kalendaryo (YYYY-MM-DD) lamang
export function parseIsoDate(v: string): string | null {
  const t = v.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : null;
}

// Tinatanggap lang ang landas na nasa listahan (para hindi magamit bilang open redirect)
export function safeGivingPath(p: string): string {
  const base = p.split("?")[0];
  return GIVING_PATHS.includes(base) ? p : GIVING_PATHS[0];
}

// Ang mga trigger (validate_giving_member, enforce_finance_record_rules) ay may sariling Tagalog na mensahe; ipinapakita
// ang mga iyon nang buo (hal. natitiwalag, hindi kumpirmado, walang pahintulot). Ang teknikal na Ingles (RLS, constraint,
// not-null) ay hindi ipinapakita nang hilaw.
const TECHNICAL = /(row-level security|violates|null value in column|duplicate key|invalid input|value too long|out of range|permission denied)/i;
export function givingErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "23505") return "May kapareho nang record. Suriin ang listahan.";
  if (!error.message || TECHNICAL.test(error.message)) return fallback;
  if (["42501", "23514", "23502", "23503", "P0002"].includes(error.code ?? "")) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Pasalamat: uri at petsa ng pagbibigay. Walang paunang napiling uri.
// Dati: enum na pasalamat_type ng 011. Simula 020: text na, para puwedeng
// mag-type ng sariling uri ang nag-e-encode.
// ---------------------------------------------------------------------------
export type PasalamatType = string;
// Mga pagpipilian sa dropdown. Ang "new_year" at "private" ay mga dating
// pagpipilian (para sa lumang records) pero hindi na inalok sa form.
// Ang "anniversary" at "extra" ay dati nang value ("Anibersaryo" at
// "Karagdagang Pasalamat"), kaya ang mga lumang record ay awtomatikong
// magpapakita ng bagong label.
export const PASALAMAT_TYPES: string[] = ["birthday", "anniversary", "annual", "extra"];
export const PASALAMAT_TYPE_LABEL: Record<string, string> = {
  birthday: "Birthday Pasalamat",
  anniversary: "Anniversary Pasalamat",
  annual: "Taunang Pasalamat",
  extra: "Extra Pasalamat",
  new_year: "Pasalamat sa Bagong Taon",
  private: "Pribado",
};
// Espesyal na value sa form kapag sariling tina-type ang uri.
export const PASALAMAT_CUSTOM_TYPE = "__custom__";
export const PASALAMAT_CUSTOM_LABEL = "Ako ang maglalagay";
export const PASALAMAT_TYPE_MAX = 80;

// Label na ipinapakita: preset → Filipino label; sariling type → kung ano ang tina-type.
export function pasalamatTypeLabel(t: string): string {
  return PASALAMAT_TYPE_LABEL[t] ?? t;
}

// Tumatanggap ng preset o sariling tina-type na uri (1–80 titik, tinatanggal ang sobrang espasyo).
export function parsePasalamatType(v: string): string | null {
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length === 0 || s.length > PASALAMAT_TYPE_MAX) return null;
  return s;
}

export type PasalamatRecord = {
  id: string;
  local_id: string;
  member_id: string;
  type: PasalamatType;
  date: string; // YYYY-MM-DD
  amount: number;
  notes: string | null;
  status: GivingStatus;
};

// ---------------------------------------------------------------------------
// Pahintulot (giving_permissions, 012): para sa kaanib na Inactive; ang pagpapalawig ay bagong pahintulot
// ---------------------------------------------------------------------------
export type PermissionState = "aktibo" | "lumipas" | "nabawi";
export const PERMISSION_STATE_LABEL: Record<PermissionState, string> = {
  aktibo: "Aktibo",
  lumipas: "Lumipas na",
  nabawi: "Nabawi",
};
export const PERMISSION_NOTE_MAX = 1000;
export const PERMISSION_REASON_MAX = 300;

export type GivingPermission = {
  id: string;
  member_id: string;
  granted_at: string;
  valid_until: string; // YYYY-MM-DD
  consultation_note: string;
  revoked_at: string | null;
  reason: string | null;
};

// today: YYYY-MM-DD (ibinibigay ng tumatawag ayon sa oras na nararapat)
export function permissionState(p: { revoked_at: string | null; valid_until: string }, today: string): PermissionState {
  if (p.revoked_at) return "nabawi";
  return p.valid_until < today ? "lumipas" : "aktibo";
}

// Ang tala ng konsultasyon ay kailangan (hindi blangko)
export function parseConsultationNote(v: string): string | null {
  const t = v.trim();
  return t !== "" && t.length <= PERMISSION_NOTE_MAX ? t : null;
}

// Tunay na petsa na hindi pa lumilipas (kasama ang mismong today)
export function parseValidUntil(v: string, today: string): string | null {
  const d = parseIsoDate(v);
  return d && d >= today ? d : null;
}
