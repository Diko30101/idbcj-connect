"use server";

import { revalidatePath } from "next/cache";
import { back, getAbuluyanContext, denyAbuluyan, getFinanceMinistryRecipientIds, str, strOrNull } from "@/lib/portal";
import { isSunday } from "@/lib/finance";
import {
  ABULUYAN_BASE,
  ABULUYAN_BUWANAN_PATH,
  abuluyanErrorMessage,
  isValidMonth,
  monthlySummaryText,
  parseAmount,
  safeAbuluyanPath,
} from "@/lib/abuluyan";
import { monthLabel } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthlySummary, type AbuluyanSummaryScope } from "./buwanan/summary";

// Ang server ang nagpapasya kung sino ang makagagawa ng ano; ang database (RLS, trigger, void_abuluyan) ang huling harang.
// Ang petsa ng pagpapadala, ang nag-encode at ang status ay itinatakda ng database, hindi ng client.

function target(fd: FormData): string {
  return safeAbuluyanPath(str(fd, "path"));
}

// Bagong draft. Local Finance: sarili nilang local lang. Church-wide Finance: anumang local; may replaces_id kung kapalit ng void.
export async function createAbuluyan(fd: FormData) {
  const ctx = await getAbuluyanContext();
  const path = target(fd);
  const serviceDate = str(fd, "service_date");
  const amount = parseAmount(str(fd, "total_amount"));
  const replacesId = strOrNull(fd, "replaces_id");

  let localId: string | null = null;
  if (ctx.isChurch) localId = strOrNull(fd, "local_id");
  else if (ctx.local) localId = ctx.local.id;
  else denyAbuluyan();
  if (!localId) back(path, "error", "Pumili ng local.");
  if (replacesId && !ctx.isChurch) back(path, "error", "Church-wide Finance lang ang makagagawa ng kapalit na record.");

  if (!isSunday(serviceDate)) back(path, "error", "Dapat Linggo ang petsa ng Abuluyan.");
  if (amount === "invalid") back(path, "error", "Di-wastong halaga.");

  const { error } = await ctx.supabase.from("abuluyan_totals").insert({
    local_id: localId,
    service_date: serviceDate,
    total_amount: amount,
    ...(replacesId ? { replaces_id: replacesId } : {}),
  });
  if (error) back(path, "error", abuluyanErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", replacesId ? "Na-save ang kapalit na record (Draft)." : "Na-save ang Abuluyan record (Draft).");
}

export async function updateAbuluyanDraft(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const path = target(fd);
  const id = str(fd, "id");
  const serviceDate = str(fd, "service_date");
  const amount = parseAmount(str(fd, "total_amount"));

  if (!isSunday(serviceDate)) back(path, "error", "Dapat Linggo ang petsa ng Abuluyan.");
  if (amount === "invalid") back(path, "error", "Di-wastong halaga.");

  const { error, count } = await ctx.supabase
    .from("abuluyan_totals")
    .update({ service_date: serviceDate, total_amount: amount }, { count: "exact" })
    .eq("id", id)
    .eq("status", "draft");
  if (error || !count) back(path, "error", abuluyanErrorMessage(error, "Hindi na-update. Baka naipadala na ito o wala kang pahintulot."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", "Na-update ang Abuluyan record.");
}

export async function submitAbuluyan(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const path = target(fd);
  const id = str(fd, "id");

  // Naka-confirm na sa UI bago tumawag dito. Ang submitted_at, submitted_by at submitted_date ay itinatakda ng database.
  const { error, count } = await ctx.supabase
    .from("abuluyan_totals")
    .update({ status: "submitted" }, { count: "exact" })
    .eq("id", id)
    .eq("status", "draft");
  if (error || !count) back(path, "error", abuluyanErrorMessage(error, "Hindi naipadala. Kailangan ang halaga (0 ay wasto)."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", "Naipadala ang Abuluyan record. Naka-lock na ito.");
}

// Ang TANGING paraan ng pag-void: void_abuluyan(local_id, service_date, reason). Admin o church-wide Finance lang (sinusuri rin ng database).
export async function voidAbuluyan(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.isAdmin) denyAbuluyan();
  const path = target(fd);
  const localId = str(fd, "local_id");
  const serviceDate = str(fd, "service_date");
  const reason = str(fd, "reason");

  if (!localId) back(path, "error", "Pumili ng local.");
  if (!isSunday(serviceDate)) back(path, "error", "Dapat Linggo ang petsa ng Abuluyan.");
  if (reason === "") back(path, "error", "Kailangan ang dahilan ng pag-void.");
  const { error } = await ctx.supabase.rpc("void_abuluyan", {
    p_local_id: localId,
    p_service_date: serviceDate,
    p_reason: reason,
  });
  if (error) back(path, "error", abuluyanErrorMessage(error, "Hindi na-void. Subukan ulit."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", "Na-void ang Abuluyan record. Pinal na ito.");
}

// Buwanang Ulat ng Abuluyan: ipadala bilang liham sa mga miyembro ng Finance Ministry.
// Church-wide Finance at Admin: lahat ng local. Local Finance: sariling local lang.
// Ang padron ng pag-insert ng liham ay gaya ng createLetter (letters -> letter_recipients -> letter_messages).
export async function sendAbuluyanMonthlySummary(fd: FormData) {
  const ctx = await getAbuluyanContext();
  const wide = ctx.isChurch || ctx.isAdmin;
  let scope: AbuluyanSummaryScope;
  if (wide) {
    scope = { wide: true };
  } else {
    const local = ctx.local;
    if (!local) denyAbuluyan();
    scope = { wide: false, localId: local.id, localName: local.name };
  }

  const buwan = str(fd, "buwan");
  if (!isValidMonth(buwan)) back(ABULUYAN_BASE, "error", "Di-wastong buwan.");
  const pagePath = `${ABULUYAN_BUWANAN_PATH}?buwan=${buwan}`;

  const { summary, submittedCount } = await getMonthlySummary(ctx.supabase, scope, buwan);
  if (submittedCount === 0) back(pagePath, "error", "Walang naipadalang Abuluyan para sa buwang ito.");

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

  const subject = `Buwanang Ulat ng Abuluyan — ${monthLabel(buwan)}`;
  const body = monthlySummaryText(summary);

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

  revalidatePath(ABULUYAN_BASE, "layout");
  back(pagePath, "ok", "Naisumite na ang buwanang ulat sa Finance Ministry.");
}
