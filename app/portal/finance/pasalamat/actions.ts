"use server";

import { revalidatePath } from "next/cache";
import { back, getAbuluyanContext, denyAbuluyan, str, strOrNull } from "@/lib/portal";
import { todayInTimezone } from "@/lib/finance";
import {
  GIVING_BASE,
  GIVING_NOTES_MAX,
  PASALAMAT_CUSTOM_TYPE,
  PASALAMAT_TYPES,
  givingErrorMessage,
  parseGivingAmount,
  parseIsoDate,
  parsePasalamatType,
  safeGivingPath,
  type MemberChoice,
} from "@/lib/giving";

// Local Finance (sariling local) at church-wide Finance lang. Ang server ang nagpapasya kung sino ang makagagawa ng ano;
// ang database (RLS, enforce_finance_record_rules, validate_giving_member) ang huling harang, at ang mga mensahe nito
// (natitiwalag, hindi kumpirmado, walang pahintulot) ang ipinapakita. Ang nag-encode, ang pagpapadala at ang currency
// (PHP) ay itinatakda ng database.

function target(fd: FormData): string {
  return safeGivingPath(str(fd, "path"));
}

async function requireGiving() {
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  return ctx;
}

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

function readFields(fd: FormData): { error: string } | { type: string; amount: number; date: string; notes: string | null } {
  const rawType = str(fd, "type");
  // Kapag "ako ang maglalagay", ang tina-type na uri ang gagamitin; kapag preset, dapat nasa listahan.
  const type =
    rawType === PASALAMAT_CUSTOM_TYPE
      ? parsePasalamatType(str(fd, "custom_type"))
      : PASALAMAT_TYPES.includes(rawType)
        ? rawType
        : null;
  const amount = parseGivingAmount(str(fd, "amount"));
  const date = parseIsoDate(str(fd, "date"));
  const notes = strOrNull(fd, "notes");
  if (!type) return { error: "Pumili ng uri ng pasalamat." };
  if (amount === "invalid") return { error: "Di-wastong halaga. Kahit anong halagang higit sa 0 (hanggang 2 decimal)." };
  if (!date) return { error: "Di-wastong petsa ng pagbibigay." };
  if (notes && notes.length > GIVING_NOTES_MAX) return { error: `Masyadong mahaba ang tala (${GIVING_NOTES_MAX} na titik ang pinakamarami).` };
  return { type, amount, date, notes };
}

export async function createPasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const memberId = str(fd, "member_id");
  if (memberId === "") back(path, "error", "Pumili ng kaanib mula sa listahan. Walang tinatanggap na handog mula sa hindi kaanib.");

  const localId = ctx.isChurch ? strOrNull(fd, "local_id") : ctx.local!.id;
  if (!localId) back(path, "error", "Pumili ng local.");
  const f = readFields(fd);
  if ("error" in f) back(path, "error", f.error);

  const tz = await timezoneOf(ctx.supabase, localId);
  if (tz && f.date > todayInTimezone(tz)) back(path, "error", "Hindi puwedeng nasa hinaharap ang petsa ng pagbibigay.");

  const { error } = await ctx.supabase.from("pasalamat_records").insert({
    local_id: localId,
    member_id: memberId,
    type: f.type,
    date: f.date,
    amount: f.amount,
    notes: f.notes,
  });
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Na-save ang Pasalamat (Draft).");
}

export async function updatePasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const f = readFields(fd);
  if ("error" in f) back(path, "error", f.error);

  const { error, count } = await ctx.supabase
    .from("pasalamat_records")
    .update({ type: f.type, date: f.date, amount: f.amount, notes: f.notes }, { count: "exact" })
    .eq("id", str(fd, "id"));
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi na-update. Baka naipadala na ito o wala kang pahintulot."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Na-update ang Pasalamat.");
}

export async function submitPasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const { error, count } = await ctx.supabase
    .from("pasalamat_records")
    .update({ status: "submitted" }, { count: "exact" })
    .eq("id", str(fd, "id"))
    .eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Naipadala ang Pasalamat. Church-wide Finance na lang ang makapagbabago nito.");
}

// Ipadala lahat ng napili: mga draft lang ang naipapadala; ang database (RLS) pa rin ang huling harang.
export async function submitManyPasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const ids = fd.getAll("ids").map((v) => String(v)).filter((v) => v !== "");
  if (ids.length === 0) back(path, "error", "Walang napiling Pasalamat na ipapadala.");
  if (ids.length > 500) back(path, "error", "Masyadong marami ang napili (500 lang ang pinakamarami).");
  const { error, count } = await ctx.supabase
    .from("pasalamat_records")
    .update({ status: "submitted" }, { count: "exact" })
    .in("id", ids)
    .eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi naipadala. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", `Naipadala ang ${count} Pasalamat. Church-wide Finance na lang ang makapagbabago ng mga ito.`);
}
