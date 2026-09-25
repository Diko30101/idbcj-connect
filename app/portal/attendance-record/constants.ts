// Mga constant ng Attendance Record.
//
// WALANG "use server" sa file na ito -- sadyang hiwalay sa actions.ts,
// dahil ang "use server" file ay async functions lang ang pwedeng
// i-export. Dito naka-lagay ang mga constant para magamit ng page,
// form, at actions nang walang paglabag sa patakaran ng Server Actions.
export const ATTENDANCE_RECORD_BASE = "/portal/attendance-record";

// Kapareho ng finance_service_type enum sa database
export const SERVICE_TYPES = [
  "Linggo",
  "New Year Thanksgiving",
  "Anniversary Thanksgiving",
  "Extra Thanksgiving",
  "Private Thanksgiving",
] as const;
