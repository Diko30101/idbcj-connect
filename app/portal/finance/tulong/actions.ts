"use server";

import { revalidatePath } from "next/cache";
import { back, getAbuluyanContext, denyAbuluyan, str, strOrNull } from "@/lib/portal";
import { todayInTimezone } from "@/lib/finance";
import {
  GIVING_BASE,
  GIVING_NOTES_MAX,
  givingErrorMessage,
  parseGivingAmount,
  parseIsoDate,
  parsePeriodMonth,
  safeGivingPath,
  type MemberChoice,
} from "@/lib/giving";

// Sinusunod ang eksaktong panuntunan ng kaanib gaya ng search_members, pero listahan ng buong
// local (hindi paghahanap sa text) — parehong function na ginagamit ng grid ng Ambagan.
async function eligibleMembersOf(
  supabase: Awaited<ReturnType<typeof getAbuluyanContext>>["supabase"],
  localId: string,
): Promise<Set<string>> {
  const { data } = await supabase.rpc("list_giving_eligible_members", { p_local_id: localId });
  return new Set(((data ?? []) as { id: string }[]).map((m) => m.id));
}

// Local Finance (sariling local) at church-wide Finance lang. Ang server ang nagpapasya kung sino ang makagagawa ng ano;
// ang database (RLS, enforce_finance_record_rules, validate_giving_member) ang huling harang, at ang mga mensahe nito
// (natitiwalag, hindi kumpirmado, walang pahintulot) ang ipinapakita. Ang nag-encode, ang status ng pagpapadala at ang
// currency (PHP) ay itinatakda ng database.

function target(fd: FormData): string {
  return safeGivingPath(str(fd, "path"));
}

async function requireGiving() {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  return ctx;
}

// Paghahanap ng kaanib para sa picker (search_members: kumpirmado at Active, o Inactive na may aktibong pahintulot)
export async function searchMembers(q: string): Promise<MemberChoice[]> {
  const ctx = await requireGiving();
  if (typeof q !== "string" || q.trim().length < 2 || q.length > 100) return [];
  const { data, error } = await ctx.supabase.rpc("search_members", { q });
  if (error) return [];
  return ((data ?? []) as MemberChoice[]).map((m) => ({ id: m.id, full_name: m.full_name, local_name: m.local_name, status: m.status }));
}

async function timezoneOf(supabase: Awaited<ReturnType<typeof requireGiving>>["supabase"], localId: string): Promise<string | null> {
  const { data } = await supabase.from("locals").select("timezone").eq("id", localId).maybeSingle();
  return (data as { timezone?: string } | null)?.timezone ?? null;
}

// Wastong halaga ng mga field (hindi kasama ang kaanib at local). Bumabalik ng {error} o ang mga halaga.
function readFields(fd: FormData): { error: string } | { period_month: string; amount: number; date_received: string; notes: string | null } {
  const period = parsePeriodMonth(str(fd, "period_month"));
  const amount = parseGivingAmount(str(fd, "amount"));
  const date = parseIsoDate(str(fd, "date_received"));
  const notes = strOrNull(fd, "notes");
  if (!period) return { error: "Pumili ng wastong buwan ng ambag." };
  if (amount === "invalid") return { error: "Di-wastong halaga. Kahit anong halagang higit sa 0 (hanggang 2 decimal)." };
  if (!date) return { error: "Di-wastong petsa ng pagtanggap." };
  if (notes && notes.length > GIVING_NOTES_MAX) return { error: `Masyadong mahaba ang tala (${GIVING_NOTES_MAX} na titik ang pinakamarami).` };
  return { period_month: period, amount, date_received: date, notes };
}

export async function createTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const memberId = str(fd, "member_id");
  if (memberId === "") back(path, "error", "Pumili ng kaanib mula sa listahan. Walang tinatanggap na handog mula sa hindi kaanib.");

  const localId = ctx.isChurch ? strOrNull(fd, "local_id") : ctx.local!.id;
  if (!localId) back(path, "error", "Pumili ng local.");
  const f = readFields(fd);
  if ("error" in f) back(path, "error", f.error);

  const tz = await timezoneOf(ctx.supabase, localId);
  if (tz && f.date_received > todayInTimezone(tz)) back(path, "error", "Hindi puwedeng nasa hinaharap ang petsa ng pagtanggap.");

  const { error } = await ctx.supabase.from("tulong_klase_records").insert({
    local_id: localId,
    member_id: memberId,
    period_month: f.period_month,
    amount: f.amount,
    date_received: f.date_received,
    notes: f.notes,
  });
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Na-save ang Tulong sa Klase Ministeryal (Draft).");
}

// I-save ang buong grid (Pangalan | Halaga, gaya ng public/Aral.pdf) ng isang buwan sa isang local:
// isang field bawat kaanib na "amt__<memberId>", isang PETSA lang para sa buong batch (walang
// lingguhang breakdown ang Tulong sa Aral — isang kabuuan bawat kaanib bawat buwan lang). Blangkong
// cell = walang ginawang record. Naka-lock na ang cell na may kasama nang naipadalang record.
export async function saveTulongGrid(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const localId = ctx.isChurch ? strOrNull(fd, "local_id") : ctx.local!.id;
  if (!localId) back(path, "error", "Pumili ng local.");
  const period = parsePeriodMonth(str(fd, "period_month"));
  if (!period) back(path, "error", "Pumili ng wastong Buwan/Taon.");
  const date = parseIsoDate(str(fd, "date_received"));
  if (!date) back(path, "error", "Di-wastong petsa ng pagtanggap.");

  const tz = await timezoneOf(ctx.supabase, localId);
  if (tz && date > todayInTimezone(tz)) back(path, "error", "Hindi puwedeng nasa hinaharap ang petsa ng pagtanggap.");

  const eligibleIds = await eligibleMembersOf(ctx.supabase, localId);
  if (eligibleIds.size === 0) back(path, "error", "Walang kaanib na tumatanggap ng Tulong sa Klase Ministeryal sa local na ito.");

  const { data: existingRows } = await ctx.supabase
    .from("tulong_klase_records")
    .select("id, member_id, amount, status")
    .eq("local_id", localId)
    .eq("period_month", period);
  type Existing = { id: string; member_id: string; amount: number; status: string };
  const existing = new Map<string, Existing>();
  for (const r of (existingRows ?? []) as any[])
    if (r.status !== "void") existing.set(r.member_id, { ...r, amount: Number(r.amount) });

  let added = 0;
  let updated = 0;
  let locked = 0;
  let cellCount = 0;
  for (const [key, rawValue] of fd.entries()) {
    if (!key.startsWith("amt__")) continue;
    if (++cellCount > 1000) break;
    const memberId = key.slice("amt__".length);
    if (!eligibleIds.has(memberId)) continue;
    const amount = parseGivingAmount(String(rawValue));
    if (amount === "invalid") continue; // blangko o 0: walang ginawang record

    const found = existing.get(memberId);
    if (found) {
      if (found.status !== "draft") {
        locked++;
        continue;
      }
      if (found.amount === amount) continue;
      const { error } = await ctx.supabase
        .from("tulong_klase_records")
        .update({ amount, date_received: date })
        .eq("id", found.id)
        .eq("status", "draft");
      if (!error) updated++;
    } else {
      const { error } = await ctx.supabase.from("tulong_klase_records").insert({
        local_id: localId,
        member_id: memberId,
        period_month: period,
        amount,
        date_received: date,
        notes: null,
      });
      if (!error) added++;
    }
  }

  revalidatePath(GIVING_BASE, "layout");
  const parts = [`${added} bago`, `${updated} na-update`];
  if (locked > 0) parts.push(`${locked} naka-lock na (naipadala na)`);
  back(path, "ok", `Na-save ang Tulong sa Klase Ministeryal: ${parts.join(", ")}.`);
}

// Burahin ang draft na Tulong sa Klase Ministeryal (mali ang pagkakaencode). Local Finance: sarili
// nilang local lang; church-wide Finance: anumang draft. Ang naipadala/aprubado ay hindi puwedeng
// burahin dito; ang database (RLS) ang huling harang.
export async function deleteTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const id = str(fd, "id");
  if (id === "") back(path, "error", "Hindi nabura. Subukan ulit.");

  const { data: rec } = await ctx.supabase.from("tulong_klase_records").select("id, local_id, status").eq("id", id).maybeSingle();
  const row = rec as { id: string; local_id: string; status: string } | null;
  if (!row || row.status !== "draft") back(path, "error", "Hindi nabura. Baka naipadala na ito o wala kang pahintulot.");
  if (!ctx.isChurch && row.local_id !== ctx.local!.id) back(path, "error", "Hindi nabura. Wala kang pahintulot.");

  const { error, count } = await ctx.supabase.from("tulong_klase_records").delete({ count: "exact" }).eq("id", id).eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi nabura. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Nabura ang draft na Tulong sa Klase Ministeryal.");
}

export async function updateTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const id = str(fd, "id");
  const f = readFields(fd);
  if ("error" in f) back(path, "error", f.error);

  const { error, count } = await ctx.supabase
    .from("tulong_klase_records")
    .update({ period_month: f.period_month, amount: f.amount, date_received: f.date_received, notes: f.notes }, { count: "exact" })
    .eq("id", id);
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi na-update. Baka naipadala na ito o wala kang pahintulot."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Na-update ang Tulong sa Klase Ministeryal.");
}

// Ipadala ang isang draft na Tulong sa Klase Ministeryal sa church-wide Finance Ministry.
export async function submitTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const { error, count } = await ctx.supabase
    .from("tulong_klase_records")
    .update({ status: "submitted" }, { count: "exact" })
    .eq("id", str(fd, "id"))
    .eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Naipadala ang Tulong sa Klase Ministeryal. Church-wide Finance na lang ang makapagbabago nito.");
}

// Desisyon ng church-wide Finance sa naisumiteng Tulong sa Klase Ministeryal: "approved" (pinal) o "needs_fix"
// (ibinabalik sa draft para ayusin ng Local, may tala kung bakit). Ang function sa database
// (decide_tulong_klase) ang huling harang sa pahintulot, at siya rin ang nagpapadala ng liham pabalik sa Local.
export async function decideTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const notes = strOrNull(fd, "notes");

  const { error } = await ctx.supabase.rpc("decide_tulong_klase", { p_id: id, p_decision: decision, p_notes: notes });
  if (error) back(path, "error", givingErrorMessage(error, "Hindi naiproseso ang desisyon."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", decision === "approved" ? "Aprubado ang Tulong sa Klase Ministeryal." : "Ibinalik sa Local ang Tulong sa Klase Ministeryal para ayusin.");
}

// Ipadala ang napili: mga draft lang ang naipapadala; ang database (RLS) pa rin ang huling harang.
export async function submitManyTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const ids = fd.getAll("ids").map((v) => String(v)).filter((v) => v !== "");
  if (ids.length === 0) back(path, "error", "Walang napiling Tulong sa Klase Ministeryal na ipapadala.");
  if (ids.length > 500) back(path, "error", "Masyadong marami ang napili (500 lang ang pinakamarami).");
  const { error, count } = await ctx.supabase
    .from("tulong_klase_records")
    .update({ status: "submitted" }, { count: "exact" })
    .in("id", ids)
    .eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", `Naipadala ang ${count} Tulong sa Klase Ministeryal. Church-wide Finance na lang ang makapagbabago ng mga ito.`);
}
