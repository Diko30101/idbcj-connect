"use server";

import { revalidatePath } from "next/cache";
import { back, getPagsambaContext, str, strOrNull } from "@/lib/portal";
import { givingErrorMessage, parseIsoDate } from "@/lib/giving";
import { SUGO_BASE, PAGSAMBA_NOTES_MAX, PAGSAMBA_SESSION_LABEL_MAX } from "@/lib/pagsamba";

function target(fd: FormData): string {
  const buwan = str(fd, "buwan");
  const local = strOrNull(fd, "local");
  const qs = [buwan ? `buwan=${encodeURIComponent(buwan)}` : "", local ? `local=${encodeURIComponent(local)}` : ""].filter(Boolean).join("&");
  return qs ? `${SUGO_BASE}?${qs}` : SUGO_BASE;
}

// Pagtatalaga ng Sugo sa isang partikular na local, Linggo, at session (session_label: "" = pangunahing/
// tanging Pagsamba ng araw; o hal. "3:00 PM" kung may karagdagang Pagsamba sa parehong araw, gaya ng
// ilang local na may dalawang Pagsamba). Leader ng Pastoral Ministry o Admin lang. Ang database
// (validate_pagsamba_sugo) ang huling harang na ang napili ay Pastoral Ministry member talaga ng
// napiling local.
export async function saveSugo(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWriteSugo) back(path, "error", "Leader ng Pastoral Ministry o Admin lang ang makaka-talaga ng Sugo.");

  const localId = str(fd, "local_id");
  const serviceDate = parseIsoDate(str(fd, "service_date"));
  const sessionLabel = str(fd, "session_label");
  const sugoId = strOrNull(fd, "sugo_id");
  const notes = strOrNull(fd, "notes");
  if (!localId || !serviceDate) back(path, "error", "Kulang ang impormasyon.");
  if (sessionLabel.length > PAGSAMBA_SESSION_LABEL_MAX) back(path, "error", `Masyadong mahaba ang label ng session (${PAGSAMBA_SESSION_LABEL_MAX} na titik ang pinakamarami).`);
  if (notes && notes.length > PAGSAMBA_NOTES_MAX) back(path, "error", `Masyadong mahaba ang tala (${PAGSAMBA_NOTES_MAX} na titik ang pinakamarami).`);

  const { error } = await ctx.supabase.from("pagsamba_records").upsert(
    {
      local_id: localId,
      service_date: serviceDate,
      session_label: sessionLabel,
      sugo_id: sugoId,
      notes,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    },
    { onConflict: "local_id,service_date,session_label" },
  );
  if (error) back(path, "error", givingErrorMessage(error, "Hindi na-save ang Sugo. Subukan ulit."));
  revalidatePath(SUGO_BASE);
  back(path, "ok", "Na-save ang Sugo.");
}

// Pagtanggal ng isang karagdagang session (hal. kung mali ang pagkakadagdag). Hindi puwedeng tanggalin
// ang pangunahing/default na session (session_label = "") ng isang araw -- iyon ay laging mayroon.
export async function deleteSugoSession(fd: FormData) {
  const ctx = await getPagsambaContext();
  const path = target(fd);
  if (!ctx.canWriteSugo) back(path, "error", "Leader ng Pastoral Ministry o Admin lang ang makaka-tanggal ng session.");

  const id = str(fd, "id");
  if (!id) back(path, "error", "Kulang ang impormasyon.");

  const { error, count } = await ctx.supabase
    .from("pagsamba_records")
    .delete({ count: "exact" })
    .eq("id", id)
    .neq("session_label", "");
  if (error || !count) back(path, "error", givingErrorMessage(error, "Hindi natanggal. Baka iyon ang pangunahing session, na hindi puwedeng tanggalin."));
  revalidatePath(SUGO_BASE);
  back(path, "ok", "Natanggal ang session.");
}
