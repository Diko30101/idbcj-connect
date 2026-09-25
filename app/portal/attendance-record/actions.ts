"use server";

import { revalidatePath } from "next/cache";
import { back, fmtDate, getRosterContext, str } from "@/lib/portal";

export const ATTENDANCE_RECORD_BASE = "/portal/attendance-record";

// Kapareho ng finance_service_type enum sa database
export const SERVICE_TYPES = [
  "Linggo",
  "New Year Thanksgiving",
  "Anniversary Thanksgiving",
  "Extra Thanksgiving",
  "Private Thanksgiving",
] as const;

// I-save ang pagdalo ng isang pagkakatipon (local + petsa + uri).
// Strategy: burahin ang dating tala ng pagtitipong ito, tapos ipasok
// ang bago -- kaya pwedeng i-edit at i-save ulit.
export async function saveAttendanceRecord(fd: FormData) {
  const { supabase, user, locals } = await getRosterContext();
  const localId = str(fd, "local_id");
  const local = locals.find((l) => l.id === localId);
  const date = str(fd, "service_date");
  const type = str(fd, "service_type");
  const path = ATTENDANCE_RECORD_BASE;
  if (!local || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(SERVICE_TYPES as readonly string[]).includes(type)) {
    back(path, "error", "Kumpletuhin ang local, petsa at uri ng pagkakatipon.");
  }

  // Tiyaking kaanib ng roster ng local na ito ang mga tsinsek
  const presentIds = [...new Set(fd.getAll("present").map(String).filter(Boolean))];
  const { data: roster } = await supabase.from("members").select("id").eq("local_id", localId).limit(2000);
  const rosterIds = new Set(((roster ?? []) as any[]).map((m) => String(m.id)));
  const validPresent = presentIds.filter((id) => rosterIds.has(id));

  const visitors = [...new Set(fd.getAll("visitor").map(String).map((s) => s.trim()).filter(Boolean))].slice(0, 200);
  const otherLocals = fd
    .getAll("other_local")
    .map(String)
    .map((s) => {
      const i = s.indexOf("|");
      return i < 0 ? null : { homeLocalId: s.slice(0, i), name: s.slice(i + 1).trim() };
    })
    .filter((o): o is { homeLocalId: string; name: string } => !!o && !!o.name && !!o.homeLocalId)
    .slice(0, 200);

  // Burahin ang dating tala ng pagtitipong ito (parehong local/petsa/uri)
  const { error: d1 } = await supabase
    .from("attendance_records")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d1) back(path, "error", "Hindi na-update ang talaan: " + d1.message);
  const { error: d2 } = await supabase
    .from("attendance_guests")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d2) back(path, "error", "Hindi na-update ang talaan ng bisita: " + d2.message);

  if (validPresent.length > 0) {
    const rows = validPresent.map((member_id) => ({
      member_id,
      local_id: localId,
      service_date: date,
      service_type: type,
      present: true,
      recorded_by: user.id,
    }));
    const { error } = await supabase.from("attendance_records").insert(rows);
    if (error) back(path, "error", "Hindi na-save ang pagdalo: " + error.message);
  }

  const guestRows = [
    ...visitors.map((name) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      name,
      kind: "visitor",
      recorded_by: user.id,
    })),
    ...otherLocals.map((o) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      name: o.name,
      kind: "other_local",
      home_local_id: o.homeLocalId,
      recorded_by: user.id,
    })),
  ];
  if (guestRows.length > 0) {
    const { error } = await supabase.from("attendance_guests").insert(guestRows);
    if (error) back(path, "error", "Hindi na-save ang bisita: " + error.message);
  }

  revalidatePath(ATTENDANCE_RECORD_BASE, "layout");
  const total = validPresent.length + guestRows.length;
  back(
    `${path}?tab=magtala&local=${localId}&date=${date}&type=${encodeURIComponent(type)}`,
    "ok",
    `Na-save ang pagdalo sa ${fmtDate(date)} (${type}): ${total} ang naitala.`,
  );
}
