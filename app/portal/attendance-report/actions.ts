"use server";

import { revalidatePath } from "next/cache";
import { back, getRosterContext, getAdministrativeMinistryRecipientIds, str } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMonth } from "@/lib/abuluyan";
import { ATTENDANCE_REPORT_BASE, attendanceReportText } from "@/lib/attendance-report";
import { getAttendanceReportSummary } from "./summary";

// Ipinapadala ang Ulat ng Pagdalo bilang liham sa mga miyembro ng Administrative Ministry.
// Ang server ang nagpapasya kung aling lokal ang sakop; ang database (RLS) ang huling harang.
export async function sendAttendanceReportToAdmin(fd: FormData) {
  const { supabase, locals, isAdmin, user } = await getRosterContext();
  const wide = isAdmin;

  let localId: string;
  let localName: string;
  if (wide) {
    const id = str(fd, "local");
    const { data } = await supabase.from("locals").select("id, name").eq("id", id).maybeSingle();
    const row = data as { id: string; name: string } | null;
    if (!row) back(ATTENDANCE_REPORT_BASE, "error", "Di-wastong lokal.");
    localId = row.id;
    localName = row.name;
  } else {
    const local = locals[0];
    if (!local) back(ATTENDANCE_REPORT_BASE, "error", "Walang lokal na sakop.");
    localId = local.id;
    localName = local.name;
  }

  const buwan = str(fd, "buwan");
  if (!isValidMonth(buwan)) back(ATTENDANCE_REPORT_BASE, "error", "Di-wastong buwan.");
  const pagePath = `${ATTENDANCE_REPORT_BASE}?buwan=${buwan}&local=${localId}`;

  const summary = await getAttendanceReportSummary(supabase, localId, localName, buwan);
  if (summary.gatheringCount === 0)
    back(pagePath, "error", "Walang naisumiteng pagdalo para sa buwang ito sa lokal na ito.");

  // Sistemang operasyon ang pagkuha ng recipients at paglikha ng liham:
  // service-role client ang gamit dahil ang RLS ay nagfi-filter depende sa
  // naka-login na user. Ang pahintulot ng gumagamit ay nasuri na sa itaas
  // (getRosterContext).
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    back(pagePath, "error", "Hindi maipadala ang liham: kulang ang server configuration.");
  }

  // Ang tatanggap: ang leader ng Administrative Ministry (fallback: lahat ng
  // miyembro kung walang leader na nakatalaga)
  const recipientIds = await getAdministrativeMinistryRecipientIds(admin);
  if (recipientIds.length === 0) back(pagePath, "error", "Walang miyembro ng Administrative Ministry na mapapadalhan.");

  const subject = `Ulat ng Pagdalo — ${localName} — ${summary.monthLabel}`;
  const body = attendanceReportText(summary);

  const { data: letter, error } = await admin
    .from("letters")
    .insert({ subject, created_by: user.id })
    .select("id")
    .single();
  if (error || !letter) back(pagePath, "error", "Hindi nagawa ang liham: " + (error?.message ?? "hindi alam na dahilan."));

  const { error: e2 } = await admin
    .from("letter_recipients")
    .insert(recipientIds.map((id) => ({ letter_id: letter.id, profile_id: id })));
  if (e2) back(pagePath, "error", "Hindi na-set ang mga tatanggap: " + e2.message);

  const { error: e3 } = await admin
    .from("letter_messages")
    .insert({ letter_id: letter.id, author_id: user.id, body });
  if (e3) back(pagePath, "error", "Hindi naipadala ang mensahe: " + e3.message);

  revalidatePath(ATTENDANCE_REPORT_BASE, "layout");
  back(pagePath, "ok", "Naisumite na ang ulat ng pagdalo sa Administrative Ministry.");
}
