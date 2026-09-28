"use server";

import { revalidatePath } from "next/cache";
import { back, getPagsambaContext, str, strOrNull } from "@/lib/portal";
import { givingErrorMessage, parseIsoDate } from "@/lib/giving";
import { PAGSAMBA_BASE, PAGSAMBA_DOCX_MAX_BYTES, PAGSAMBA_PAKSA_MAX, PAGSAMBA_NOTES_MAX, parsePeriodMonth } from "@/lib/pagsamba";
import { extractDocxParagraphs, extractPagsambaTopics } from "@/lib/pagsamba-docx";

function target(fd: FormData): string {
  const buwan = str(fd, "buwan");
  const local = strOrNull(fd, "local");
  const qs = [buwan ? `buwan=${encodeURIComponent(buwan)}` : "", local ? `local=${encodeURIComponent(local)}` : ""].filter(Boolean).join("&");
  return qs ? `${PAGSAMBA_BASE}?${qs}` : PAGSAMBA_BASE;
}

// I-upload ang Texto (.docx) ng buwan: babasahin ng server ang file at awtomatikong mapupunan ang Paksa
// (hanggang 5, Linggo 1-5). Admin lang. Kapag muling na-upload sa parehong buwan, papalitan ang dati.
export async function uploadPagsambaTexto(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWritePaksa) back(path, "error", "Admin lang ang makaka-encode ng Paksa.");

  const period = parsePeriodMonth(str(fd, "period_month"));
  if (!period) back(path, "error", "Pumili ng wastong buwan.");

  const fileEntry = fd.get("docx");
  if (!fileEntry || typeof fileEntry === "string") back(path, "error", "Pumili ng .docx file na i-upload.");
  const file = fileEntry as File;
  if (file.size === 0) back(path, "error", "Pumili ng .docx file na i-upload.");
  if (file.size > PAGSAMBA_DOCX_MAX_BYTES) back(path, "error", "Masyadong laki ang file (15MB ang pinakamarami).");

  const buf = await file.arrayBuffer();
  let titles: string[] = [];
  try {
    const paragraphs = await extractDocxParagraphs(buf);
    titles = extractPagsambaTopics(paragraphs);
  } catch {
    back(path, "error", "Hindi nabasa ang file. Siguraduhing wastong .docx ang ina-upload.");
  }
  if (titles.length === 0) back(path, "error", "Walang nahanap na Paksa sa file na ito. Subukang i-encode nang manu-mano.");

  const storagePath = `${period}.docx`;
  const { error: upErr } = await ctx.supabase.storage.from("pagsamba-texts").upload(storagePath, buf, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (upErr) back(path, "error", "Na-parse ang Paksa pero hindi na-save ang file. Subukan ulit.");

  const { error: delErr } = await ctx.supabase.from("pagsamba_topics").delete().eq("period_month", period);
  if (delErr) back(path, "error", givingErrorMessage(delErr, "Hindi na-save ang Paksa. Subukan ulit."));

  const rows = titles.map((paksa, i) => ({
    period_month: period,
    week_number: i + 1,
    paksa,
    source_docx_path: storagePath,
    created_by: ctx.profile.id,
  }));
  const { error } = await ctx.supabase.from("pagsamba_topics").insert(rows);
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save ang Paksa. Subukan ulit."));

  revalidatePath(PAGSAMBA_BASE);
  back(path, "ok", `Na-encode ang ${rows.length} Paksa mula sa na-upload na texto.`);
}

// Manu-manong ayos sa isang Paksa (hal. kung mali ang nahuli mula sa file). Admin lang.
export async function updatePagsambaTopic(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWritePaksa) back(path, "error", "Admin lang ang makaka-encode ng Paksa.");

  const id = str(fd, "id");
  const paksa = str(fd, "paksa");
  if (!id) back(path, "error", "Kulang ang impormasyon.");
  if (paksa === "" || paksa.length > PAGSAMBA_PAKSA_MAX) back(path, "error", `Kailangan ang Paksa (hanggang ${PAGSAMBA_PAKSA_MAX} na titik).`);

  const { error, count } = await ctx.supabase.from("pagsamba_topics").update({ paksa }, { count: "exact" }).eq("id", id);
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi na-update. Subukan ulit."));
  revalidatePath(PAGSAMBA_BASE);
  back(path, "ok", "Na-update ang Paksa.");
}

// Manu-manong pagdagdag ng isang Paksa (kung walang na-upload na texto para sa buwang ito).  Admin lang.
export async function createPagsambaTopic(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWritePaksa) back(path, "error", "Admin lang ang makaka-encode ng Paksa.");

  const period = parsePeriodMonth(str(fd, "period_month"));
  const weekNumber = Number(str(fd, "week_number"));
  const paksa = str(fd, "paksa");
  if (!period) back(path, "error", "Pumili ng wastong buwan.");
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 5) back(path, "error", "Di-wastong Linggo.");
  if (paksa === "" || paksa.length > PAGSAMBA_PAKSA_MAX) back(path, "error", `Kailangan ang Paksa (hanggang ${PAGSAMBA_PAKSA_MAX} na titik).`);

  const { error } = await ctx.supabase
    .from("pagsamba_topics")
    .upsert({ period_month: period, week_number: weekNumber, paksa, created_by: ctx.profile.id }, { onConflict: "period_month,week_number" });
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(PAGSAMBA_BASE);
  back(path, "ok", "Na-save ang Paksa.");
}

// Pagtatalaga ng Sugo sa isang partikular na local at Linggo. Leader ng Pastoral Ministry o Admin lang.
// Ang database (validate_pagsamba_sugo) ang huling harang na ang napili ay Pastoral Ministry member
// talaga ng napiling local.
export async function saveSugo(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWriteSugo) back(path, "error", "Leader ng Pastoral Ministry o Admin lang ang makaka-talaga ng Sugo.");

  const localId = str(fd, "local_id");
  const serviceDate = parseIsoDate(str(fd, "service_date"));
  const sugoId = strOrNull(fd, "sugo_id");
  const notes = strOrNull(fd, "notes");
  if (!localId || !serviceDate) back(path, "error", "Kulang ang impormasyon.");
  if (notes && notes.length > PAGSAMBA_NOTES_MAX) back(path, "error", `Masyadong mahaba ang tala (${PAGSAMBA_NOTES_MAX} na titik ang pinakamarami).`);

  const { error } = await ctx.supabase.from("pagsamba_records").upsert(
    {
      local_id: localId,
      service_date: serviceDate,
      sugo_id: sugoId,
      notes,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    },
    { onConflict: "local_id,service_date" },
  );
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save ang Sugo. Subukan ulit."));
  revalidatePath(PAGSAMBA_BASE);
  back(path, "ok", "Na-save ang Sugo.");
}
