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

// I-save ang maraming Pasalamat nang sabay-sabay mula sa listahan ng mga hanay (Petsa | Pangalan |
// Uri | Tala | Halaga bawat hanay), gaya ng public/Monthly Pasalamat Report.pdf. Iba ito sa grid ng
// Ambagan/Abuluyan/Tulong: walang nakalaang cell bawat kaanib dahil maaaring maraming beses magbigay
// ang isang kaanib. Blangkong hanay (walang napiling kaanib) = walang record na gagawin. Ang
// database (validate_giving_member) pa rin ang huling harang sa pagiging kwalipikadong kaanib.
export async function savePasalamatGrid(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const localId = ctx.isChurch ? strOrNull(fd, "local_id") : ctx.local!.id;
  if (!localId) back(path, "error", "Pumili ng local.");

  const tz = await timezoneOf(ctx.supabase, localId);
  const today = tz ? todayInTimezone(tz) : null;

  const rowKeys = str(fd, "row_keys")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 200);

  let added = 0;
  let skipped = 0;
  for (const key of rowKeys) {
    const memberId = str(fd, `row__${key}__member_id`);
    if (memberId === "") continue; // blangkong hanay

    const rawType = str(fd, `row__${key}__type`);
    const type =
      rawType === PASALAMAT_CUSTOM_TYPE
        ? parsePasalamatType(str(fd, `row__${key}__custom_type`))
        : PASALAMAT_TYPES.includes(rawType)
          ? rawType
          : null;
    const amount = parseGivingAmount(str(fd, `row__${key}__amount`));
    const date = parseIsoDate(str(fd, `row__${key}__date`));
    const notes = strOrNull(fd, `row__${key}__notes`);

    if (!type || amount === "invalid" || !date || (notes && notes.length > GIVING_NOTES_MAX) || (today && date > today)) {
      skipped++;
      continue;
    }

    const { error } = await ctx.supabase.from("pasalamat_records").insert({
      local_id: localId,
      member_id: memberId,
      type,
      date,
      amount,
      notes,
    });
    if (!error) added++;
    else skipped++;
  }

  revalidatePath(GIVING_BASE, "layout");
  if (added === 0 && skipped === 0) back(path, "error", "Walang hanay na napunan. Pumili ng kaanib sa hanay na gagamitin.");
  const parts = [`${added} naidagdag`];
  if (skipped > 0) parts.push(`${skipped} nilaktawan (may kulang o di-wastong datos)`);
  back(path, "ok", `Na-save ang Pasalamat: ${parts.join(", ")}.`);
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

// Burahin ang draft na Pasalamat (mali ang pagkakaencode). Local Finance: sarili nilang local lang;
// church-wide Finance: anumang draft. Ang naipadala/aprubado ay hindi puwedeng burahin dito; ang
// database (RLS) ang huling harang.
export async function deletePasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const id = str(fd, "id");
  if (id === "") back(path, "error", "Hindi nabura. Subukan ulit.");

  const { data: rec } = await ctx.supabase.from("pasalamat_records").select("id, local_id, status").eq("id", id).maybeSingle();
  const row = rec as { id: string; local_id: string; status: string } | null;
  if (!row || row.status !== "draft") back(path, "error", "Hindi nabura. Baka naipadala na ito o wala kang pahintulot.");
  if (!ctx.isChurch && row.local_id !== ctx.local!.id) back(path, "error", "Hindi nabura. Wala kang pahintulot.");

  const { error, count } = await ctx.supabase.from("pasalamat_records").delete({ count: "exact" }).eq("id", id).eq("status", "draft");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi nabura. Subukan ulit."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", "Nabura ang draft na Pasalamat.");
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

// Desisyon ng church-wide Finance sa naisumiteng Pasalamat: "approved" (pinal) o "needs_fix"
// (ibinabalik sa draft para ayusin ng Local, may tala kung bakit). Ang function sa database
// (decide_pasalamat) ang huling harang sa pahintulot, at siya rin ang nagpapadala ng liham pabalik sa Local.
export async function decidePasalamat(fd: FormData) {
  const ctx = await requireGiving();
  const path = target(fd);
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const notes = strOrNull(fd, "notes");

  const { error } = await ctx.supabase.rpc("decide_pasalamat", { p_id: id, p_decision: decision, p_notes: notes });
  if (error) back(path, "error", givingErrorMessage(error, "Hindi naiproseso ang desisyon."));
  revalidatePath(GIVING_BASE, "layout");
  back(path, "ok", decision === "approved" ? "Aprubado ang Pasalamat." : "Ibinalik sa Local ang Pasalamat para ayusin.");
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
