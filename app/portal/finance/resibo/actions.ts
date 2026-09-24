"use server";

import { revalidatePath } from "next/cache";
import { back, getAbuluyanContext, denyAbuluyan, getFinanceMinistryRecipientIds, str } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMonth } from "@/lib/abuluyan";
import { monthLabel } from "@/lib/finance";
import { RESIBO_BASE, resiboText } from "@/lib/resibo";
import { getResiboSummary } from "./summary";

// Ipinapadala ang Buwanang Resibo bilang liham sa mga miyembro ng Finance Ministry.
// Ang server ang nagpapasya kung aling lokal ang sakop; ang database (RLS) ang huling harang.
export async function sendResiboToAdmin(fd: FormData) {
  const ctx = await getAbuluyanContext();
  const wide = ctx.isChurch || ctx.isAdmin;

  let localId: string;
  let localName: string;
  if (wide) {
    const id = str(fd, "local");
    const { data } = await ctx.supabase.from("locals").select("id, name").eq("id", id).maybeSingle();
    const row = data as { id: string; name: string } | null;
    if (!row) back(RESIBO_BASE, "error", "Di-wastong lokal.");
    localId = row.id;
    localName = row.name;
  } else {
    const local = ctx.local;
    if (!local) denyAbuluyan();
    localId = local.id;
    localName = local.name;
  }

  const buwan = str(fd, "buwan");
  if (!isValidMonth(buwan)) back(RESIBO_BASE, "error", "Di-wastong buwan.");
  const pagePath = `${RESIBO_BASE}?buwan=${buwan}&local=${localId}`;

  const summary = await getResiboSummary(ctx.supabase, localId, localName, buwan);
  if (summary.submittedCount === 0)
    back(pagePath, "error", "Walang naitalang handog para sa buwang ito sa lokal na ito.");

  // Sistemang operasyon ang pagkuha ng recipients at paglikha ng liham:
  // service-role client ang gamit dahil ang RLS ay nagfi-filter depende sa
  // naka-login na user. Ang pahintulot ng gumagamit ay nasuri na sa itaas
  // (getAbuluyanContext).
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    back(pagePath, "error", "Hindi maipadala ang liham: kulang ang server configuration.");
  }

  // Ang tatanggap: mga miyembro ng Finance Ministry (sila ang "Admin" sa sistemang ito)
  const recipientIds = await getFinanceMinistryRecipientIds(admin);
  if (recipientIds.length === 0) back(pagePath, "error", "Walang miyembro ng Finance Ministry na mapapadalhan.");

  const subject = `Buwanang Resibo — ${localName} — ${monthLabel(buwan)}`;
  const body = resiboText(summary);

  const { data: letter, error } = await admin
    .from("letters")
    .insert({ subject, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error || !letter) back(pagePath, "error", "Hindi nagawa ang liham: " + (error?.message ?? "hindi alam na dahilan."));

  const { error: e2 } = await admin
    .from("letter_recipients")
    .insert(recipientIds.map((id) => ({ letter_id: letter.id, profile_id: id })));
  if (e2) back(pagePath, "error", "Hindi na-set ang mga tatanggap: " + e2.message);

  const { error: e3 } = await admin
    .from("letter_messages")
    .insert({ letter_id: letter.id, author_id: ctx.user.id, body });
  if (e3) back(pagePath, "error", "Hindi naipadala ang mensahe: " + e3.message);

  revalidatePath(RESIBO_BASE, "layout");
  back(pagePath, "ok", "Naisumite na ang buwanang resibo sa Finance Ministry.");
}
