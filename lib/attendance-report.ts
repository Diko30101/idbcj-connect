// Mga tipo at helper ng Attendance Report (buwanang ulat ng pagdalo, per-lokal,
// per-buwan). Pure at walang server-only na import: ligtas gamitin sa client.

export const ATTENDANCE_REPORT_BASE = "/portal/attendance-report";

// Ang tatanggap ng ulat: mga miyembro ng Administrative Ministry.
export const ADMIN_MINISTRY_NAME = "Administrative Ministry";

export type AttendanceReportRow = {
  serviceDate: string; // YYYY-MM-DD
  serviceType: string; // value ng finance_service_type enum
  typeLabel: string; // Tagalog na label (Pagsamba, Klase Ministerial, ...)
  members: number; // mga kaanib mula sa roster
  visitors: number; // mga bisita
  otherLocal: number; // mga kaanib mula sa ibang lokal
  total: number;
  memberNames: string[]; // buong tala ng mga pangalan ng kaanib
  visitorNames: string[]; // mga pangalan ng bisita
  otherLocalNames: string[]; // mga pangalan ng taga-ibang lokal
};

export type AttendanceReportSummary = {
  buwan: string; // YYYY-MM
  monthLabel: string;
  localId: string;
  localName: string;
  rows: AttendanceReportRow[];
  membersTotal: number;
  visitorsTotal: number;
  otherLocalTotal: number;
  grandTotal: number;
  gatheringCount: number; // bilang ng mga pagkakatipon sa buwan
};

// Katawan ng liham na ipapadala sa Administrative Ministry — naka table sheet
// (rows = pangalan, columns = petsa), gaya ng nasa web page. Ang LetterBody
// ay nagre-render ng mga pipe-table bilang totoong table.
export function attendanceReportText(s: AttendanceReportSummary): string {
  const lines = [
    `ULAT NG PAGDALO — ${s.localName}`,
    s.monthLabel,
    "",
  ];
  if (s.rows.length === 0) {
    lines.push("(walang naitalang pagdalo para sa buwang ito)");
    return lines.join("\n");
  }

  // Bumuo ng sheet: bawat seksyon (kaanib/bisita/ibang lokal) ay may listahan
  // ng mga pangalan at kung saang gathering index sila dumalo.
  const gatherings = s.rows.map((r) => ({ date: r.serviceDate, type: r.typeLabel }));
  const buildSection = (getNames: (r: (typeof s.rows)[number]) => string[]) => {
    const map = new Map<string, Set<number>>();
    s.rows.forEach((r, gi) => {
      for (const n of getNames(r)) {
        if (!map.has(n)) map.set(n, new Set());
        map.get(n)!.add(gi);
      }
    });
    const names = [...map.keys()].sort((a, b) => a.localeCompare(b));
    return { names, att: names.map((n) => map.get(n)!) };
  };
  const sections: { title: string; sec: { names: string[]; att: Set<number>[] } }[] = [
    { title: "Mga Kaanib", sec: buildSection((r) => r.memberNames) },
    { title: "Mga Bisita", sec: buildSection((r) => r.visitorNames) },
    { title: "Mula sa Ibang Lokal", sec: buildSection((r) => r.otherLocalNames) },
  ];

  const dateHeader = gatherings.map((g) => g.date.slice(5)).join(" | ");
  for (const { title, sec } of sections) {
    if (sec.names.length === 0) continue;
    lines.push(title);
    lines.push(`| Pangalan | ${dateHeader} | Bilang |`);
    sec.names.forEach((name, ni) => {
      const marks = gatherings.map((_, gi) => (sec.att[ni].has(gi) ? "✓" : "")).join(" | ");
      lines.push(`| ${name} | ${marks} | ${sec.att[ni].size} |`);
    });
    const totals = gatherings.map((_, gi) => String(sec.att.filter((a) => a.has(gi)).length)).join(" | ");
    const grand = sec.att.reduce((t, a) => t + a.size, 0);
    lines.push(`| Kabuuan | ${totals} | ${grand} |`);
    lines.push("");
  }
  lines.push(`Kabuuan sa buwan: ${s.grandTotal} na dumalo sa ${s.gatheringCount} na pagkakatipon`);
  return lines.join("\n");
}
