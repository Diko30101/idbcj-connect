// Mga tipo at helper ng Buwanang Resibo (per-lokal, per-buwan) at Lingguhang Resibo
// (church-wide, per-linggo): pinagsasama sa iisang resibo ang Abuluyan (lingguhang
// pinagsamang handog), Ambagan, Tulong sa Aral, at Pasalamat. Pure at walang
// server-only na import: ligtas gamitin sa client.
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

// Isang lokal sa loob ng Lingguhang Resibo (parehong hugis ng ResiboSummary,
// walang buwan)
export type WeeklyLocalResibo = {
  localId: string;
  localName: string;
  abuluyan: ResiboAbuluyanWeek[];
  abuluyanTotal: number;
  ambagan: ResiboGivingRow[];
  ambaganTotal: number;
  tulong: ResiboGivingRow[];
  tulongTotal: number;
  pasalamat: ResiboPasalamatRow[];
  pasalamatTotal: number;
  grandTotal: number;
  submittedCount: number;
};

// ---------------------------------------------------------------
// Plain-text na mga bloke (ginagamit ng buwanan at lingguhang resibo)
// ---------------------------------------------------------------
function abuluyanBlock(abuluyan: ResiboAbuluyanWeek[], total: number): string[] {
  const lines = ["ABULOYAN"];
  if (abuluyan.length === 0) {
    lines.push("(walang naipadalang Abuluyan)");
  } else {
    lines.push("| Petsa | Halaga |");
    for (const w of abuluyan) lines.push(`| ${w.serviceDate} | ${fmtPeso(w.amount)} |`);
    lines.push(`Kabuuan ng Abuluyan: ${fmtPeso(total)}`);
  }
  return lines;
}

function givingBlock(
  title: string,
  emptyLabel: string,
  totalLabel: string,
  rows: ResiboGivingRow[],
  total: number,
): string[] {
  const lines = [title];
  if (rows.length === 0) {
    lines.push(`(walang naipadalang ${emptyLabel})`);
  } else {
    lines.push("| Miyembro | Petsa | Halaga |");
    for (const r of rows) lines.push(`| ${r.memberName} | ${r.date} | ${fmtPeso(r.amount)} |`);
    lines.push(`${totalLabel}: ${fmtPeso(total)}`);
  }
  return lines;
}

function pasalamatBlock(pasalamat: ResiboPasalamatRow[], total: number): string[] {
  const lines = ["PASALAMAT"];
  if (pasalamat.length === 0) {
    lines.push("(walang naipadalang Pasalamat)");
  } else {
    lines.push("| Miyembro | Uri | Petsa | Halaga |");
    for (const r of pasalamat) {
      const extra = r.notes ? ` (${r.notes})` : "";
      lines.push(`| ${r.memberName} | ${PASALAMAT_TYPE_LABEL[r.type]} | ${r.date} | ${fmtPeso(r.amount)}${extra} |`);
    }
    lines.push(`Kabuuan ng Pasalamat: ${fmtPeso(total)}`);
  }
  return lines;
}

function localBlocks(s: {
  abuluyan: ResiboAbuluyanWeek[];
  abuluyanTotal: number;
  ambagan: ResiboGivingRow[];
  ambaganTotal: number;
  tulong: ResiboGivingRow[];
  tulongTotal: number;
  pasalamat: ResiboPasalamatRow[];
  pasalamatTotal: number;
}): string[] {
  return [
    ...abuluyanBlock(s.abuluyan, s.abuluyanTotal),
    "",
    ...givingBlock("AMBAGAN", "Ambagan", "Kabuuan ng Ambagan", s.ambagan, s.ambaganTotal),
    "",
    ...givingBlock("TULONG SA ARAL", "Tulong sa Aral", "Kabuuan ng Tulong sa Aral", s.tulong, s.tulongTotal),
    "",
    ...pasalamatBlock(s.pasalamat, s.pasalamatTotal),
  ];
}

// Plain-text na bersyon ng buwanang resibo — para sa liham (Inbox)
export function resiboText(s: ResiboSummary): string {
  const lines: string[] = [
    "IDBCJ — Buwanang Resibo",
    `Lokal: ${s.localName}`,
    `Buwan: ${s.monthLabel}`,
    `Petsa: ${s.generatedLabel}`,
    "",
    ...localBlocks(s),
    "",
    `PANGKALAHATANG KABUUAN: ${fmtPeso(s.grandTotal)}`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------
// Lingguhang Resibo (church-wide)
// ---------------------------------------------------------------
const TAGALOG_MONTHS_SHORT = [
  "Ene", "Peb", "Mar", "Abr", "May", "Hun",
  "Hul", "Ago", "Set", "Okt", "Nob", "Dis",
];

// "Set 21–27, 2026" — start/end ay YYYY-MM-DD
export function weekLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const sMon = TAGALOG_MONTHS_SHORT[sm - 1] ?? "";
  const eMon = TAGALOG_MONTHS_SHORT[em - 1] ?? "";
  if (sy === ey && sm === em) return `${sMon} ${sd}–${ed}, ${sy}`;
  if (sy === ey) return `${sMon} ${sd} – ${eMon} ${ed}, ${sy}`;
  return `${sMon} ${sd}, ${sy} – ${eMon} ${ed}, ${ey}`;
}

// Plain-text na bersyon ng lingguhang resibo — isang liham para sa lahat ng lokal
export function weeklyResiboText(
  label: string,
  generatedLabel: string,
  locals: WeeklyLocalResibo[],
): string {
  const lines: string[] = [
    "IDBCJ — Lingguhang Resibo",
    `Linggo: ${label}`,
    `Petsa: ${generatedLabel}`,
    "",
  ];
  let grand = 0;
  for (const loc of locals) {
    grand += loc.grandTotal;
    lines.push(
      `—— ${loc.localName} ——`,
      "",
      ...localBlocks(loc),
      "",
      `Kabuuan ng lokal: ${fmtPeso(loc.grandTotal)}`,
      "",
    );
  }
  lines.push(`PANGKALAHATANG KABUUAN (lahat ng lokal): ${fmtPeso(grand)}`);
  return lines.join("\n");
}
