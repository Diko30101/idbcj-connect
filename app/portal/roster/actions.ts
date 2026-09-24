"use server";

import { revalidatePath } from "next/cache";
import { back, getRosterContext, str } from "@/lib/portal";
import {
  MEMBER_STATUSES,
  ROSTER_BASE,
  ROSTER_NAME_MAX,
  normalizeName,
  rosterErrorMessage,
  safeRosterPath,
  type MemberStatus,
} from "@/lib/roster";

// Ang server ang nagpapasya kung sino ang makagagawa ng ano; ang database (RLS, members_rules ng 013/016, confirm_member)
// ang huling harang. Ang kumpirmasyon at ang mga field ng status ay itinatakda ng database, hindi ng client.

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function target(fd: FormData): string {
  return safeRosterPath(str(fd, "path"));
}

function nameError(name: string): string | null {
  if (name === "") return "Kailangan ang pangalan.";
  if (name.length > ROSTER_NAME_MAX) return `Masyadong mahaba ang pangalan (${ROSTER_NAME_MAX} na titik ang pinakamarami).`;
  if (CONTROL_CHARS.test(name)) return "May hindi wastong karakter sa pangalan.";
  return null;
}

export async function addMember(fd: FormData) {
  const ctx = await getRosterContext();
  const path = target(fd);
  const name = normalizeName(str(fd, "full_name"));
  const localId = str(fd, "local_id");
  const bad = nameError(name);
  if (bad) back(path, "error", bad);
  if (!ctx.locals.some((l) => l.id === localId)) back(path, "error", "Pumili ng local na sakop mo.");

  const { error } = await ctx.supabase.from("members").insert({ local_id: localId, full_name: name });
  if (error) back(path, "error", rosterErrorMessage(error, "Hindi na-save. Subukan ulit."));
  revalidatePath(ROSTER_BASE, "layout");
  back(
    path,
    "ok",
    ctx.isAdmin
      ? "Naidagdag ang kaanib (kumpirmado, dahil Admin ang nagdagdag)."
      : "Naidagdag ang kaanib. Hihintayin ang kumpirmasyon ng Admin bago ito makatanggap ng handog.",
  );
}

export async function updateMemberName(fd: FormData) {
  const ctx = await getRosterContext();
  const path = target(fd);
  const id = str(fd, "id");
  const name = normalizeName(str(fd, "full_name"));
  const bad = nameError(name);
  if (bad) back(path, "error", bad);

  const { error, count } = await ctx.supabase.from("members").update({ full_name: name }, { count: "exact" }).eq("id", id);
  if (error || !count) back(path, "error", rosterErrorMessage(error, "Hindi na-update. Baka wala kang pahintulot."));
  revalidatePath(ROSTER_BASE, "layout");
  back(
    path,
    "ok",
    ctx.isAdmin
      ? "Na-update ang pangalan."
      : "Na-update ang pangalan. Kung kumpirmado ang kaanib at nagbago ang pangalan (hindi lang ang laki ng titik o espasyo), kailangang kumpirmahin muli ng Admin.",
  );
}

// Admin lang (sinusuri rin ng database). Kailangan ang dahilan.
export async function setMemberStatus(fd: FormData) {
  const ctx = await getRosterContext();
  const path = target(fd);
  if (!ctx.isAdmin) back(path, "error", "Ang Admin lang ang makapagpapalit ng status ng kaanib.");
  const id = str(fd, "id");
  const status = str(fd, "status") as MemberStatus;
  const reason = str(fd, "reason");
  if (!MEMBER_STATUSES.includes(status)) back(path, "error", "Di-wastong status.");
  if (reason === "") back(path, "error", "Kailangan ang dahilan sa pagpapalit ng status ng kaanib.");

  const { error, count } = await ctx.supabase
    .from("members")
    .update({ status, status_reason: reason }, { count: "exact" })
    .eq("id", id);
  if (error || !count) back(path, "error", rosterErrorMessage(error, "Hindi napalitan ang status. Subukan ulit."));
  revalidatePath(ROSTER_BASE, "layout");
  back(path, "ok", `Napalitan ang status: ${status}.`);
}

// Admin lang: confirm_member (database function)
export async function confirmMember(fd: FormData) {
  const ctx = await getRosterContext();
  const path = target(fd);
  if (!ctx.isAdmin) back(path, "error", "Ang Admin lang ang makakakumpirma ng kaanib.");
  const { error } = await ctx.supabase.rpc("confirm_member", { p_member_id: str(fd, "id") });
  if (error) back(path, "error", rosterErrorMessage(error, "Hindi nakumpirma. Subukan ulit."));
  revalidatePath(ROSTER_BASE, "layout");
  back(path, "ok", "Nakumpirma ang kaanib. Puwede na itong tumanggap ng handog.");
}

// CSV na may mga column na full_name at locale. Ang locale ay hinahanap sa pangalan
// (hindi case-sensitive) sa mga local na sakop ng naka-log in. Nilalaktawan ang mga
// row na may maling pangalan o hindi kilalang locale.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // balewalain (Windows line endings)
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function importMembers(fd: FormData) {
  const ctx = await getRosterContext();
  const path = target(fd);
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) back(path, "error", "Pumili ng CSV file na ia-upload.");
  if (file.size > 2 * 1024 * 1024) back(path, "error", "Masyadong malaki ang file (hanggang 2MB lang).");

  const rows = parseCsvRows(await file.text());
  let start = 0;
  if (rows.length > 0 && rows[0].some((c) => c.trim().toLowerCase() === "full_name")) start = 1;
  const localByName = new Map(ctx.locals.map((l) => [l.name.trim().toLowerCase(), l.id]));

  let added = 0;
  let skipped = 0;
  const total = Math.max(0, rows.length - start);
  for (let i = start; i < rows.length; i++) {
    const name = normalizeName(rows[i][0] ?? "");
    const localId = localByName.get((rows[i][1] ?? "").trim().toLowerCase());
    if (nameError(name) !== null || !localId) {
      skipped++;
      continue;
    }
    const { error } = await ctx.supabase.from("members").insert({ local_id: localId, full_name: name });
    if (error) skipped++;
    else added++;
  }
  revalidatePath(ROSTER_BASE, "layout");
  if (total === 0) back(path, "error", "Walang nabasang row sa CSV.");
  back(path, "ok", `Na-import ang ${added} sa ${total} na row; ${skipped} nilaktawan.`);
}
