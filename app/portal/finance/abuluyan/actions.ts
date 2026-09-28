"use server";

import { revalidatePath } from "next/cache";
import { back, getAbuluyanContext, denyAbuluyan, getAdminRecipientIds, str, strOrNull } from "@/lib/portal";
import { isSunday, sundaysOfMonth, todayInTimezone } from "@/lib/finance";
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
  const sugoId = strOrNull(fd, "sugo_id");

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
    sugo_id: sugoId,
    ...(replacesId ? { replaces_id: replacesId } : {}),
  });
  if (error) back(path, "error", abuluyanErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", replacesId ? "Na-save ang kapalit na record (Draft)." : "Na-save ang Abuluyan record (Draft).");
}

// I-save ang buong grid (Linggo I–V ng buwan) ng isang local, parang papel na form (public/Pagsamba.pdf):
// isang hanay bawat Linggo, "amt__<petsa>" ang halaga at "sugo__<petsa>" ang Sugo. Blangko ang halaga at
// walang Sugo = walang ginawang record (hindi paglabag). May kasama nang naipadalang record (hindi na
// "draft") = naka-lock, hindi na binabago dito.
export async function saveAbuluyanGrid(fd: FormData) {
  const ctx = await getAbuluyanContext();
  const path = target(fd);
  let localId: string | null = null;
  if (ctx.isChurch) localId = strOrNull(fd, "local_id");
  else if (ctx.local) localId = ctx.local.id;
  else denyAbuluyan();
  if (!localId) back(path, "error", "Pumili ng local.");

  const buwan = str(fd, "buwan");
  if (!isValidMonth(buwan)) back(path, "error", "Pumili ng wastong Buwan/Taon.");
  const sundays = sundaysOfMonth(buwan);

  const { data: localRow } = await ctx.supabase.from("locals").select("timezone").eq("id", localId).maybeSingle();
  const tz = (localRow as { timezone?: string } | null)?.timezone ?? null;
  const today = tz ? todayInTimezone(tz) : null;

  const { data: existingRows } = await ctx.supabase
    .from("abuluyan_totals")
    .select("id, service_date, total_amount, sugo_id, status")
    .eq("local_id", localId)
    .neq("status", "void")
    .in("service_date", sundays);
  type Existing = { id: string; service_date: string; total_amount: number | null; sugo_id: string | null; status: string };
  const existing = new Map<string, Existing>();
  // Numeric column: string ang ibinabalik ng Supabase client, kaya i-cast bago ikumpara.
  for (const r of (existingRows ?? []) as any[])
    existing.set(r.service_date, { ...r, total_amount: r.total_amount === null ? null : Number(r.total_amount) });

  let added = 0;
  let updated = 0;
  let locked = 0;
  let skippedFuture = 0;
  let skippedInvalid = 0;

  for (const date of sundays) {
    const rawAmt = String(fd.get(`amt__${date}`) ?? "");
    const rawSugo = String(fd.get(`sugo__${date}`) ?? "").trim();
    const amount = parseAmount(rawAmt);
    if (amount === "invalid") {
      skippedInvalid++;
      continue;
    }
    const sugoId = rawSugo === "" ? null : rawSugo;
    if (amount === null && sugoId === null) continue; // walang binigay: walang ginawang record

    if (today && date > today) {
      skippedFuture++;
      continue;
    }

    const found = existing.get(date);
    if (found) {
      if (found.status !== "draft") {
        locked++;
        continue;
      }
      if (found.total_amount === amount && found.sugo_id === sugoId) continue; // walang pagbabago
      const { error } = await ctx.supabase
        .from("abuluyan_totals")
        .update({ total_amount: amount, sugo_id: sugoId })
        .eq("id", found.id)
        .eq("status", "draft");
      if (!error) updated++;
    } else {
      const { error } = await ctx.supabase.from("abuluyan_totals").insert({
        local_id: localId,
        service_date: date,
        total_amount: amount,
        sugo_id: sugoId,
      });
      if (!error) added++;
    }
  }

  revalidatePath(ABULUYAN_BASE, "layout");
  const parts = [`${added} bago`, `${updated} na-update`];
  if (locked > 0) parts.push(`${locked} naka-lock na (naipadala na)`);
  if (skippedFuture > 0) parts.push(`${skippedFuture} nasa hinaharap (hindi isinave)`);
  if (skippedInvalid > 0) parts.push(`${skippedInvalid} di-wastong halaga (hindi isinave)`);
  back(path, "ok", `Na-save ang Abuluyan: ${parts.join(", ")}.`);
}

export async function updateAbuluyanDraft(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const path = target(fd);
  const id = str(fd, "id");
  const serviceDate = str(fd, "service_date");
  const amount = parseAmount(str(fd, "total_amount"));
  const sugoId = strOrNull(fd, "sugo_id");

  if (!isSunday(serviceDate)) back(path, "error", "Dapat Linggo ang petsa ng Abuluyan.");
  if (amount === "invalid") back(path, "error", "Di-wastong halaga.");

  const { error, count } = await ctx.supabase
    .from("abuluyan_totals")
    .update({ service_date: serviceDate, total_amount: amount, sugo_id: sugoId }, { count: "exact" })
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

// Maramihang pagpapadala ng mga napiling draft. Tanging draft na may halaga ang
// naipapadala (gaya ng isahang pagpapadala); ang RLS ang huling harang sa pahintulot.
export async function submitManyAbuluyan(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const path = target(fd);
  const ids = fd.getAll("ids").map((v) => String(v)).filter((v) => v !== "");
  if (ids.length === 0) back(path, "error", "Walang napiling Abuluyan na ipapadala.");
  if (ids.length > 500) back(path, "error", "Masyadong marami ang napili (500 lang ang pinakamarami).");

  const { data: ok } = await ctx.supabase
    .from("abuluyan_totals")
    .select("id")
    .in("id", ids)
    .eq("status", "draft")
    .not("total_amount", "is", null);
  const sendable = ((ok ?? []) as { id: string }[]).map((d) => d.id);
  if (sendable.length === 0)
    back(path, "error", "Walang naipadala. Lagyan muna ng halaga ang mga draft bago ipadala.");

  const { error, count } = await ctx.supabase
    .from("abuluyan_totals")
    .update({ status: "submitted" }, { count: "exact" })
    .in("id", sendable)
    .eq("status", "draft");
  if (error || !count) back(path, "error", abuluyanErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(ABULUYAN_BASE, "layout");
  const skipped = ids.length - (count ?? 0);
  back(
    path,
    "ok",
    `Naipadala ang ${count} Abuluyan record. Naka-lock na ang mga ito.${
      skipped > 0 ? ` ${skipped} ang hindi naipadala (walang halaga o walang pahintulot).` : ""
    }`,
  );
}

// Burahin ang draft. Local Finance: sarili nilang local lang at hindi ang kapalit na record;
// church-wide Finance: anumang draft. Ang naipadala at na-void ay hindi puwedeng burahin;
// ang database (RLS, 021) ang huling harang.
export async function deleteAbuluyanDraft(fd: FormData) {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const path = target(fd);
  const id = str(fd, "id");
  if (id === "") back(path, "error", "Hindi nabura. Subukan ulit.");

  const { data: rec } = await ctx.supabase
    .from("abuluyan_totals")
    .select("id, local_id, status, replaces_id")
    .eq("id", id)
    .maybeSingle();
  const row = rec as { id: string; local_id: string; status: string; replaces_id: string | null } | null;
  if (!row || row.status !== "draft") back(path, "error", "Hindi nabura. Baka naipadala na ito o wala kang pahintulot.");
  if (!ctx.isChurch) {
    if (row.local_id !== ctx.local!.id) back(path, "error", "Hindi nabura. Wala kang pahintulot.");
    if (row.replaces_id !== null)
      back(path, "error", "Hindi puwedeng burahin ng Local Finance ang kapalit na record.");
  }

  const { error, count } = await ctx.supabase
    .from("abuluyan_totals")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("status", "draft");
  if (error || !count) back(path, "error", abuluyanErrorMessage(error, "Hindi nabura. Subukan ulit."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", "Nabura ang draft na Abuluyan record.");
}

// Desisyon ng church-wide Finance sa naisumiteng record: "approved" (pinal) o "needs_fix"
// (ibinabalik sa draft para ayusin ng Local, may tala kung bakit). Ang function sa database
// (decide_abuluyan) ang huling harang sa pahintulot, at siya rin ang nagpapadala ng liham pabalik sa Local.
export async function decideAbuluyan(fd: FormData) {
  const ctx = await getAbuluyanContext();
  const path = target(fd);
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const notes = strOrNull(fd, "notes");

  const { error } = await ctx.supabase.rpc("decide_abuluyan", { p_id: id, p_decision: decision, p_notes: notes });
  if (error) back(path, "error", abuluyanErrorMessage(error, "Hindi naiproseso ang desisyon."));
  revalidatePath(ABULUYAN_BASE, "layout");
  back(path, "ok", decision === "approved" ? "Aprubado ang Abuluyan record." : "Ibinalik sa Local ang record para ayusin.");
}

// Buwanang Ulat ng Abuluyan: ipadala bilang liham sa Admin (hindi na sa Finance Ministry).
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

  // Ang tatanggap: mga tunay na Admin (role='admin'), hindi na ang Finance Ministry.
  const recipientIds = await getAdminRecipientIds(admin);
  if (recipientIds.length === 0) back(pagePath, "error", "Walang Admin na mapapadalhan.");

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
  back(pagePath, "ok", "Naisumite na ang buwanang ulat sa Admin.");
}
