// Mga operasyon sa ministry (Release 0). Walang import ng ibang file ng repo para masubok nang direkta laban sa lokal na stack.
// Ang database (RLS at ang trigger ng 018) ang tunay na harang; ang mga pagsusuri rito ay para sa malinaw na mensahe
// at para gumana nang pareho bago at pagkatapos ng 010. Walang "maling tagumpay": ang 0 row na naapektuhan ay HINDI tagumpay.
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROTECTED_MINISTRY_NAMES = ["Finance Ministry", "Local Finance Ministry", "Pastoral Ministry"] as const;

const norm = (s: string) => s.trim().toLowerCase();
const PROTECTED_NORM: string[] = PROTECTED_MINISTRY_NAMES.map(norm);
export const isProtectedMinistryName = (name: string | null | undefined): boolean => !!name && PROTECTED_NORM.includes(norm(name));

export const MSG_PROTECTED_MEMBERS = "Ang Admin lang ang makapagbabago sa mga kasapi ng Finance, Local Finance, at Pastoral Ministry.";
export const MSG_PROTECTED_DELETE = "Hindi mabubura ang Finance, Local Finance, o Pastoral Ministry. Mabubura ang lahat ng kasapi nito.";
export const MSG_PROTECTED_NAME = "Hindi mapapalitan ang pangalan ng Finance, Local Finance, o Pastoral Ministry, at hindi puwedeng gamitin ang mga pangalang ito sa ibang ministry.";

export type OpResult = { ok: boolean; message: string };
const ok = (message: string): OpResult => ({ ok: true, message });
const fail = (message: string): OpResult => ({ ok: false, message });

type DbError = { code?: string; message: string };
export function dbMessage(prefix: string, e: DbError): string {
  if (e.code === "42501") return `${prefix}: walang pahintulot ang account mo para dito (ang Admin lang ang makagagawa).`;
  if (e.code === "23505") return `${prefix}: mayroon nang ganito.`;
  return `${prefix}: ${e.message}`;
}

async function ministryName(db: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await db.from("ministries").select("name").eq("id", id).maybeSingle();
  return data ? (data.name as string) : null;
}

export async function addMinistryMember(db: SupabaseClient, role: string, ministryId: string, profileId: string): Promise<OpResult> {
  if (!ministryId || !profileId) return fail("Pumili muna ng ministry o member.");
  const name = await ministryName(db, ministryId);
  if (name === null) return fail("Hindi makita ang ministry.");
  if (isProtectedMinistryName(name) && role !== "admin") return fail(MSG_PROTECTED_MEMBERS);
  const { error } = await db.from("ministry_members").insert({ ministry_id: ministryId, profile_id: profileId });
  if (error) {
    if (error.code === "23505") return ok("Kasapi na siya sa ministry na ito.");
    return fail(dbMessage("Hindi nadagdag", error));
  }
  return ok("Nadagdag sa ministry.");
}

export async function removeMinistryMember(db: SupabaseClient, role: string, ministryId: string, profileId: string): Promise<OpResult> {
  const name = await ministryName(db, ministryId);
  if (name !== null && isProtectedMinistryName(name) && role !== "admin") return fail(MSG_PROTECTED_MEMBERS);
  const { data, error } = await db.from("ministry_members").delete().eq("ministry_id", ministryId).eq("profile_id", profileId).select("profile_id");
  if (error) return fail(dbMessage("Hindi naalis", error));
  if (!data || data.length === 0) return fail("Walang naalis: wala na siya sa ministry na ito, o walang pahintulot ang account mo.");
  return ok("Naalis sa ministry.");
}

export async function setMinistryLeaderOp(db: SupabaseClient, role: string, ministryId: string, profileId: string, makeLeader: boolean): Promise<OpResult> {
  const name = await ministryName(db, ministryId);
  if (name !== null && isProtectedMinistryName(name) && role !== "admin") return fail(MSG_PROTECTED_MEMBERS);
  const { data, error } = await db.from("ministry_members").update({ is_leader: makeLeader }).eq("ministry_id", ministryId).eq("profile_id", profileId).select("profile_id");
  if (error) return fail(dbMessage("Hindi na-update", error));
  if (!data || data.length === 0) return fail("Walang nabago: wala siya sa ministry na ito, o walang pahintulot ang account mo.");
  return ok(makeLeader ? "Ginawang leader." : "Tinanggal bilang leader.");
}

export async function deleteMinistryOp(db: SupabaseClient, id: string): Promise<OpResult> {
  const name = await ministryName(db, id);
  if (name === null) return fail("Hindi makita ang ministry.");
  if (isProtectedMinistryName(name)) return fail(MSG_PROTECTED_DELETE); // mahigpit (018): kahit Admin
  const { data, error } = await db.from("ministries").delete().eq("id", id).select("id");
  if (error) return fail(dbMessage("Hindi nabura", error));
  if (!data || data.length === 0) return fail("Walang nabura: walang pahintulot ang account mo.");
  return ok("Nabura ang ministry pati na ang mga miyembro, iskedyul, at anunsyo nito.");
}

export type MinistryFields = { name: string; name_tl: string | null; description: string | null };

export async function createMinistryOp(db: SupabaseClient, f: MinistryFields): Promise<OpResult & { id?: string }> {
  if (!f.name.trim()) return fail("Isulat ang pangalan ng ministry.");
  if (isProtectedMinistryName(f.name)) return fail(MSG_PROTECTED_NAME);
  const { data, error } = await db.from("ministries").insert(f).select("id").single();
  if (error) return fail(dbMessage("Hindi nagawa", error));
  return { ...ok("Nagawa ang ministry."), id: data.id as string };
}

export async function updateMinistryOp(db: SupabaseClient, id: string, f: MinistryFields): Promise<OpResult> {
  if (!f.name.trim()) return fail("Isulat ang pangalan ng ministry.");
  const current = await ministryName(db, id);
  if (current === null) return fail("Hindi makita ang ministry.");
  const renamed = norm(current) !== norm(f.name);
  if (renamed && (isProtectedMinistryName(current) || isProtectedMinistryName(f.name))) return fail(MSG_PROTECTED_NAME);
  const patch: Record<string, unknown> = { name_tl: f.name_tl, description: f.description };
  if (!isProtectedMinistryName(current) && current !== f.name) patch.name = f.name;
  const { data, error } = await db.from("ministries").update(patch).eq("id", id).select("id");
  if (error) return fail(dbMessage("Hindi na-save", error));
  if (!data || data.length === 0) return fail("Walang nabago: walang pahintulot ang account mo.");
  return ok("Na-update ang ministry.");
}
