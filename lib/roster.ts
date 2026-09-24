// Mga tipo at helper ng roster (public.members). Pure at walang import (kaya ligtas sa client at masusubok
// nang direkta sa Node). Ang database (013/016) ang huling harang; ang mga pagsusuri rito ay para sa maayos na preview.

export type MemberStatus = "Active" | "Inactive" | "Pagtitiwalag";
export const MEMBER_STATUSES: MemberStatus[] = ["Active", "Inactive", "Pagtitiwalag"];

export type RosterMember = {
  id: string;
  local_id: string;
  full_name: string;
  status: MemberStatus;
  status_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export const ROSTER_NAME_MAX = 200;
export const ROSTER_BASE = "/portal/roster";
export const ROSTER_PATHS = [ROSTER_BASE];

export function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Susi sa paghahambing ng pangalan: hindi mahalaga ang laki ng titik at ang sobrang espasyo
export function nameKey(s: string): string {
  return normalizeName(s).toLowerCase();
}

// Tinatanggap lang ang landas na nasa listahan (para hindi magamit bilang open redirect)
export function safeRosterPath(p: string): string {
  const base = p.split("?")[0];
  return ROSTER_PATHS.includes(base) ? p : ROSTER_BASE;
}

// Ang mga trigger ng 013/016 ay may sariling Tagalog na mensahe; ang teknikal (hal. RLS) ay hindi ipinapakita nang hilaw.
export function rosterErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.message?.includes("row-level security")) return fallback;
  if (["42501", "23514", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return fallback;
}
