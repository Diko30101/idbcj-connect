// Mga tipo at helper ng Buwanang Resibo (per-lokal, per-buwan): pinagsasama sa iisang
// resibo ang Abuluyan (lingguhang pinagsamang handog), Ambagan, Tulong sa Aral, at
// Pasalamat para sa parehong buwan. Pure at walang server-only na import: ligtas
// gamitin sa client.
import { fmtPeso } from "./finance";
import { PASALAMAT_TYPE_LABEL, type PasalamatType } from "./giving";

export const RESIBO_BASE = "/portal/finance/resibo";

export type ResiboAbuluyanWeek = { serviceDate: string; amount: number };
export type ResiboGivingRow = {
  memberId: string;
  memberName: string;
  date: string; // date_received (YYYY-MM-DD)
  amount: number;
  notes: string | null;
};
export type ResiboPasalamatRow = {
  memberId: string;
  memberName: string;
  type: PasalamatType;
  date: string; // YYYY-MM-DD
  amount: number;
  notes: string | null;
};

export type ResiboSummary = {
  buwan: string; // YYYY-MM
  monthLabel: string;
  localId: string;
  localName: string;
  generatedLabel: string;
  abuluyan: ResiboAbuluyanWeek[];
  abuluyanTotal: number;
  ambagan: ResiboGivingRow[];
  ambaganTotal: number;
  tulong: ResiboGivingRow[];
  tulongTotal: number;
  pasalamat: ResiboPasalamatRow[];
  pasalamatTotal: number;
  grandTotal: number;
  submittedCount: number; // kabuuang bilang ng mga record sa apat na kategorya
};

// Plain-text na bersyon ng resibo — para sa liham (Inbox) sa Admin
export function resiboText(s: ResiboSummary): string {
  const lines: string[] = [
    "IDBCJ — Buwanang Resibo",
    `Lokal: ${s.localName}`,
    `Buwan: ${s.monthLabel}`,
    `Nabuo: ${s.generatedLabel}`,
    "",
    "ABULUYAN (lingguhang pinagsamang handog)",
  ];
  if (s.abuluyan.length === 0) lines.push("  (walang naipadalang Abuluyan)");
  else {
    for (const w of s.abuluyan) lines.push(`  ${w.serviceDate} — ${fmtPeso(w.amount)}`);
    lines.push(`  Kabuuan ng Abuluyan: ${fmtPeso(s.abuluyanTotal)}`);
  }
  lines.push("", "AMBAGAN");
  if (s.ambagan.length === 0) lines.push("  (walang naipadalang Ambagan)");
  else {
    for (const r of s.ambagan) lines.push(`  ${r.memberName} · ${r.date} — ${fmtPeso(r.amount)}`);
    lines.push(`  Kabuuan ng Ambagan: ${fmtPeso(s.ambaganTotal)}`);
  }
  lines.push("", "TULONG SA ARAL");
  if (s.tulong.length === 0) lines.push("  (walang naipadalang Tulong sa Aral)");
  else {
    for (const r of s.tulong) lines.push(`  ${r.memberName} · ${r.date} — ${fmtPeso(r.amount)}`);
    lines.push(`  Kabuuan ng Tulong sa Aral: ${fmtPeso(s.tulongTotal)}`);
  }
  lines.push("", "PASALAMAT");
  if (s.pasalamat.length === 0) lines.push("  (walang naipadalang Pasalamat)");
  else {
    for (const r of s.pasalamat) {
      const extra = r.notes ? ` · ${r.notes}` : "";
      lines.push(`  ${r.memberName} · ${PASALAMAT_TYPE_LABEL[r.type]} · ${r.date} — ${fmtPeso(r.amount)}${extra}`);
    }
    lines.push(`  Kabuuan ng Pasalamat: ${fmtPeso(s.pasalamatTotal)}`);
  }
  lines.push("", `PANGKALAHATANG KABUUAN: ${fmtPeso(s.grandTotal)}`);
  return lines.join("\n");
}
