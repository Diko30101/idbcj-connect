// Mga tipo at helper ng Abuluyan (schema 010 + 019). Walang server-only na import: ligtas gamitin sa client.

export type AbuluyanStatus = "draft" | "submitted" | "void";

export type AbuluyanRecord = {
  id: string;
  local_id: string;
  service_date: string;
  total_amount: number | null;
  status: AbuluyanStatus;
  void_reason: string | null;
  replaces_id: string | null;
};

export const ABULUYAN_STATUS_LABEL: Record<AbuluyanStatus, string> = {
  draft: "Draft",
  submitted: "Naipadala",
  void: "Void",
};

export const ABULUYAN_BASE = "/portal/finance/abuluyan";
export const ABULUYAN_PATHS = [ABULUYAN_BASE, `${ABULUYAN_BASE}/lahat`, `${ABULUYAN_BASE}/void`];

// Ang halaga ay puwedeng blangko sa draft (null); 0 ay wasto; negatibo o hindi numero ay "invalid".
export function parseAmount(v: string): number | null | "invalid" {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return Math.round(n * 100) / 100;
}

// Tinatanggap lang ang landas na nasa listahan (para hindi magamit bilang open redirect)
export function safeAbuluyanPath(p: string): string {
  const base = p.split("?")[0];
  return ABULUYAN_PATHS.includes(base) ? p : ABULUYAN_BASE;
}

// Ang mga trigger ng 019 ay may sariling Tagalog na mensahe (mga code sa ibaba); ang iba ay hindi ipinapakita nang hilaw.
export function abuluyanErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "23505") return "May aktibong record na para sa Linggong ito sa local na iyon.";
  // Ang 42501 ay galing din sa RLS ("row-level security"): teknikal at Ingles, kaya fallback ang ipapakita
  if (error.message?.includes("row-level security")) return fallback;
  if (["42501", "23514", "P0002", "22023", "23502"].includes(error.code ?? "") && error.message) return error.message;
  return fallback;
}
