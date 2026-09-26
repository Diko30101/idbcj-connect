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

// Plain-text na katawan ng liham na ipapadala sa Administrative Ministry.
export function attendanceReportText(s: AttendanceReportSummary): string {
  const lines = [
    `ULAT NG PAGDALO — ${s.localName}`,
    s.monthLabel,
    "",
  ];
  if (s.rows.length === 0) {
    lines.push("(walang naitalang pagdalo para sa buwang ito)");
  } else {
    lines.push("| Petsa | Uri | Mga Kaanib | Bisita | Ibang Lokal | Kabuuan |");
    for (const r of s.rows) {
      lines.push(`| ${r.serviceDate} | ${r.typeLabel} | ${r.members} | ${r.visitors} | ${r.otherLocal} | ${r.total} |`);
    }
    lines.push("");
    lines.push(`Kabuuan sa buwan: ${s.grandTotal} na dumalo sa ${s.gatheringCount} na pagkakatipon`);
  }
  return lines.join("\n");
}
