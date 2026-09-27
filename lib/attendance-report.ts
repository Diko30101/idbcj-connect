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
    for (const r of s.rows) {
      lines.push(`Petsa: ${r.serviceDate} — ${r.typeLabel} (Local: ${s.localName})`);
      lines.push(`Bilang ng dumalo: ${r.total} (Mga Kaanib: ${r.members}, Bisita: ${r.visitors}, Ibang Lokal: ${r.otherLocal})`);
      if (r.memberNames.length > 0) {
        lines.push("Mga Kaanib:");
        for (const n of r.memberNames) lines.push(`  - ${n}`);
      }
      if (r.visitorNames.length > 0) {
        lines.push("Mga Bisita:");
        for (const n of r.visitorNames) lines.push(`  - ${n}`);
      }
      if (r.otherLocalNames.length > 0) {
        lines.push("Mula sa Ibang Lokal:");
        for (const n of r.otherLocalNames) lines.push(`  - ${n}`);
      }
      lines.push("");
    }
    lines.push(`Kabuuan sa buwan: ${s.grandTotal} na dumalo sa ${s.gatheringCount} na pagkakatipon`);
  }
  return lines.join("\n");
}
