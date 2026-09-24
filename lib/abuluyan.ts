// Mga tipo at helper ng Abuluyan (schema 010 + 019). Walang server-only na import: ligtas gamitin sa client.
import { fmtPeso, monthLabel } from "./finance";

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
export const ABULUYAN_BUWANAN_PATH = `${ABULUYAN_BASE}/buwanan`;
export const ABULUYAN_PATHS = [ABULUYAN_BASE, `${ABULUYAN_BASE}/lahat`, `${ABULUYAN_BASE}/void`, ABULUYAN_BUWANAN_PATH];

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

// ---------------------------------------------------------------
// Buwanang Ulat ng Abuluyan (monthly summary receipt)
// ---------------------------------------------------------------

// "2026-09" ang tanggap; ang buwan ay 01-12
export function isValidMonth(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const m = Number(month.slice(5, 7));
  return m >= 1 && m <= 12;
}

// "2026-09" -> { first: "2026-09-01", firstNext: "2026-10-01" } (para sa >= / < na query)
export function monthDateRange(month: string): { first: string; firstNext: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return {
    first: `${month}-01`,
    firstNext: `${next.y}-${String(next.m).padStart(2, "0")}-01`,
  };
}

function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const ny = y + Math.floor(m / 12);
  const nm = (((m % 12) + 12) % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// "2026-09" -> "2026-08" / "2026-10"
export function prevMonth(month: string): string {
  return shiftMonth(month, -1);
}

export function nextMonth(month: string): string {
  return shiftMonth(month, 1);
}

export type MonthlySummaryWeek = { serviceDate: string; amount: number };

export type MonthlySummaryLocal = {
  localId: string;
  localName: string;
  weeks: MonthlySummaryWeek[];
  total: number;
};

export type MonthlySummary = {
  month: string;
  monthLabel: string;
  generatedLabel: string;
  locals: MonthlySummaryLocal[];
  grandTotal: number;
  missingLocalNames: string[];
};

// Bumubuo ng buwanang ulat mula sa mga NAIPADALANG (submitted) record.
// Lahat ng local sa scope ay kasama kahit walang record (makikita sa missingLocalNames).
export function buildMonthlySummary(
  records: { local_id: string; service_date: string; total_amount: number | null }[],
  locals: { id: string; name: string }[],
  month: string,
  generatedLabel: string,
): MonthlySummary {
  const byLocal = new Map<string, MonthlySummaryWeek[]>();
  for (const r of records) {
    const list = byLocal.get(r.local_id) ?? [];
    list.push({ serviceDate: r.service_date, amount: r.total_amount ?? 0 });
    byLocal.set(r.local_id, list);
  }
  const summaryLocals: MonthlySummaryLocal[] = locals.map((l) => {
    const weeks = (byLocal.get(l.id) ?? []).sort((a, b) => (a.serviceDate < b.serviceDate ? -1 : 1));
    const total = weeks.reduce((s, w) => s + w.amount, 0);
    return { localId: l.id, localName: l.name, weeks, total };
  });
  const grandTotal = summaryLocals.reduce((s, l) => s + l.total, 0);
  const missingLocalNames = summaryLocals.filter((l) => l.weeks.length === 0).map((l) => l.localName);
  return { month, monthLabel: monthLabel(month), generatedLabel, locals: summaryLocals, grandTotal, missingLocalNames };
}

// Plain-text na bersyon ng ulat — para sa liham (Inbox) sa Admin
export function monthlySummaryText(s: MonthlySummary): string {
  const lines: string[] = ["IDBCJ — Buwanang Ulat ng Abuluyan", `Buwan: ${s.monthLabel}`, `Nabuo: ${s.generatedLabel}`, ""];
  for (const l of s.locals) {
    lines.push(l.localName.toUpperCase());
    if (l.weeks.length === 0) {
      lines.push("  (walang naipadalang Abuluyan)");
    } else {
      for (const w of l.weeks) lines.push(`  ${w.serviceDate} — ${fmtPeso(w.amount)}`);
      lines.push(`  Kabuuan ng local: ${fmtPeso(l.total)}`);
    }
    lines.push("");
  }
  lines.push(`PANGKALAHATANG KABUUAN: ${fmtPeso(s.grandTotal)}`);
  lines.push("");
  lines.push(
    s.missingLocalNames.length > 0
      ? `Mga local na walang naipadalang Abuluyan: ${s.missingLocalNames.join(", ")}`
      : "Lahat ng local ay may naipadalang Abuluyan ngayong buwan.",
  );
  return lines.join("\n");
}
