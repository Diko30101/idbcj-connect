"use server";

import { revalidatePath } from "next/cache";
import { back, getPermissionsContext, str, todayPH } from "@/lib/portal";
import { PERMISSION_REASON_MAX, givingErrorMessage, parseConsultationNote, parseValidUntil } from "@/lib/giving";

const PATH = "/portal/giving-permissions";

// Pastoral leader lang (sinusuri rin ng giving_permissions_rules at RLS). Ang granted_by, granted_at, revoked_at at revoked_by
// ay itinatakda ng database. Ang pagpapalawig ay bagong pahintulot; walang pag-edit at walang DELETE.

export async function grantPermission(fd: FormData) {
  const ctx = await getPermissionsContext();
  if (!ctx.isPastoral) back(PATH, "error", "Ang lider lamang ng Pastoral Ministry (Admin) ang makapagbibigay ng pahintulot.");
  const memberId = str(fd, "member_id");
  const validUntil = parseValidUntil(str(fd, "valid_until"), todayPH());
  const note = parseConsultationNote(str(fd, "consultation_note"));
  if (memberId === "") back(PATH, "error", "Pumili ng kaanib.");
  if (!validUntil) back(PATH, "error", "Pumili ng wastong petsa ng pagtatapos ng pahintulot (hindi pa lumilipas).");
  if (!note) back(PATH, "error", "Kailangan ang tala ng konsultasyon.");

  const { error } = await ctx.supabase.from("giving_permissions").insert({ member_id: memberId, valid_until: validUntil, consultation_note: note });
  if (error) back(PATH, "error", givingErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(PATH);
  back(PATH, "ok", "Naibigay ang pahintulot. Ang kaanib ay makatatanggap na ng handog hanggang sa petsa ng pagtatapos.");
}

export async function revokePermission(fd: FormData) {
  const ctx = await getPermissionsContext();
  if (!ctx.isPastoral) back(PATH, "error", "Ang lider lamang ng Pastoral Ministry (Admin) ang makababawi ng pahintulot.");
  const reason = str(fd, "reason");
  if (reason === "") back(PATH, "error", "Kailangan ang dahilan sa pagbawi ng pahintulot.");
  if (reason.length > PERMISSION_REASON_MAX) back(PATH, "error", `Masyadong mahaba ang dahilan (${PERMISSION_REASON_MAX} na titik ang pinakamarami).`);

  const { error, count } = await ctx.supabase
    .from("giving_permissions")
    .update({ reason }, { count: "exact" })
    .eq("id", str(fd, "id"))
    .is("revoked_at", null);
  if (error || !count) back(PATH, "error", givingErrorMessage(error, "Hindi nabawi. Baka nabawi na ito."));
  revalidatePath(PATH);
  back(PATH, "ok", "Nabawi ang pahintulot. Hindi na makatatanggap ng handog ang kaanib na ito hangga't walang bagong pahintulot.");
}
