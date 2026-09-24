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

// Ipadala lahat: lahat ng draft na Tulong sa Klase Ministeryal ng napiling local
// ay nagiging submitted nang sabay-sabay. Walang indibidwal na Ipadala at walang I-void.
export async function submitAllTulong(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const localId = ctx.isChurch ? strOrNull(fd, "local_id") : ctx.local!.id;
  if (!localId) back(path, "error", "Pumili ng local.");
  const { error, count } = await ctx.supabase
    .from("tulong_klase_records")
    .update({ status: "submitted" }, { count: "exact" })
    .eq("local_id", localId)
    .eq("status", "draft");
  if (error) back(path, "error", givingErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(
    path,
    "ok",
    count ? `Naipadala ang ${count} Tulong sa Klase Ministeryal. Church-wide Finance na lang ang makapagbabago nito.` : "Walang draft na Tulong sa Klase Ministeryal na ipapadala.",
  );
}
