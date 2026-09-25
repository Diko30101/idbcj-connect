"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/categories";
import { LOCALITIES, type Locality } from "@/lib/locality";
import { requireRoles, str, strOrNull } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { baseUsername, usernameToEmail } from "@/lib/username";

export type CreateMemberState = {
  error?: string;
  created?: { name: string; username: string; tempPassword: string; category: Category };
} | null;

export type ResetPasswordState = {
  error?: string;
  done?: { username: string; tempPassword: string };
} | null;

const NO_KEY_MSG =
  "Wala pang SUPABASE_SERVICE_ROLE_KEY sa server. Ilagay ito sa .env.local (at sa Vercel), tapos i-restart ang server.";

// Temporary password: 10 na karakter, walang magkakamukhang letra (0/O, 1/l/I)
function makeTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  for (;;) {
    let pw = "";
    for (let i = 0; i < 10; i++) pw += all[randomInt(all.length)];
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[2-9]/.test(pw)) return pw;
  }
}

// ---------------------------------------------------------------
// BAGONG MEMBER (admin o secretary)
// ---------------------------------------------------------------
export async function createMember(_prev: CreateMemberState, fd: FormData): Promise<CreateMemberState> {
  const { user } = await requireRoles(["admin", "secretary"]);

  const fullName = str(fd, "full_name").replace(/\s+/g, " ");
  const category = str(fd, "category") as Category;
  const locality = str(fd, "locality") as Locality;
  if (fullName.length < 3 || fullName.length > 100) return { error: "Isulat ang buong pangalan (3 hanggang 100 na letra)." };
  if (!CATEGORIES.includes(category)) return { error: "Pumili ng category: Adult, Young, o Child." };
  if (!LOCALITIES.includes(locality)) return { error: "Pumili ng lokalidad kung saan naka-tala ang member." };
  if (fd.get("consent") !== "on") {
    return { error: "Lagyan ng tsek na nakuha na ang pahintulot ng member (o ng magulang/guardian kung Young o Child)." };
  }

  const base = baseUsername(fullName);
  if (base.length < 3) return { error: "Masyadong maikli ang pangalan para makabuo ng username. Isulat ang unang pangalan at apelyido." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: NO_KEY_MSG };
  }

  // Humanap ng username na wala pang gumagamit: jeileth.villaverde, jeileth.villaverde2, ...
  const { data: existing, error: qErr } = await admin.from("profiles").select("username").ilike("username", `${base}%`);
  if (qErr) return { error: "Hindi makuha ang listahan ng username: " + qErr.message };
  const taken = new Set((existing ?? []).map((r: { username: string | null }) => (r.username ?? "").toLowerCase()));
  let username = base;
  for (let n = 2; taken.has(username); n++) username = `${base}${n}`;
  if (username.length > 40) return { error: "Masyadong mahaba ang pangalan para gawing username." };

  const tempPassword = makeTempPassword();
  const email = usernameToEmail(username);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (cErr || !created?.user) return { error: "Hindi nagawa ang account: " + (cErr?.message ?? "hindi kilalang error") };
  const id = created.user.id;

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id,
      email,
      full_name: fullName,
      username,
      category,
      locality,
      role: "member",
      status: "active",
      must_change_password: true,
      phone_number: strOrNull(fd, "phone_number"),
      city: strOrNull(fd, "city"),
    },
    { onConflict: "id" },
  );
  if (pErr) {
    // Ibalik sa dati: burahin ang account para walang naiwang kalahati
    await admin.auth.admin.deleteUser(id);
    return { error: "Hindi na-save ang profile, kaya hindi itinuloy: " + pErr.message };
  }

  await admin.from("audit_log").insert({
    actor: user.id,
    action: "create_member",
    table_name: "profiles",
    record_id: id,
    detail: { username, category, locality },
  });

  revalidatePath("/portal/members");
  return { created: { name: fullName, username, tempPassword, category } };
}

// ---------------------------------------------------------------
// I-RESET ANG PASSWORD (admin o secretary)
// ---------------------------------------------------------------
export async function resetMemberPassword(_prev: ResetPasswordState, fd: FormData): Promise<ResetPasswordState> {
  const { user, profile: me } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  if (!id) return { error: "Walang napiling member." };
  if (id === user.id) return { error: "Hindi ito para sa sarili mong account. Gamitin ang Change Password." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: NO_KEY_MSG };
  }

  const { data: target } = await admin.from("profiles").select("id, role, username, email").eq("id", id).maybeSingle();
  if (!target) return { error: "Hindi nahanap ang member." };
  if (target.role === "admin" && me.role !== "admin") return { error: "Ang admin lang ang puwedeng mag-reset ng password ng admin." };

  const tempPassword = makeTempPassword();
  const { error: uErr } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (uErr) return { error: "Hindi na-reset: " + uErr.message };

  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  await admin.from("audit_log").insert({
    actor: user.id,
    action: "reset_password",
    table_name: "profiles",
    record_id: id,
    detail: null,
  });

  return { done: { username: target.username ?? target.email ?? "", tempPassword } };
}

// ---------------------------------------------------------------
// BURAHIN ANG MEMBER (admin o secretary). Pinal: binubura ang auth
// account at ang profile; ang mga kaugnay na tala ay sumusunod sa
// on-delete rules ng database (cascade o set null).
// ---------------------------------------------------------------
export type DeleteMemberState = { error?: string } | null;

export async function deleteMember(_prev: DeleteMemberState, fd: FormData): Promise<DeleteMemberState> {
  const { user, profile: me } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!id) return { error: "Walang napiling member." };
  if (id === user.id) return { error: "Hindi puwedeng burahin ang sariling account." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: NO_KEY_MSG };
  }

  const { data: target } = await admin.from("profiles").select("id, role, full_name").eq("id", id).maybeSingle();
  if (!target) return { error: "Hindi nahanap ang member." };
  if (target.role === "admin" && me.role !== "admin") return { error: "Ang admin lang ang puwedeng magbura ng admin." };
  if (target.role === "admin") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { error: "Hindi puwedeng burahin ang huling admin." };
  }

  const { error: dErr } = await admin.auth.admin.deleteUser(id);
  if (dErr) return { error: "Hindi nabura: " + dErr.message };
  await admin.from("profiles").delete().eq("id", id);

  await admin.from("audit_log").insert({
    actor: user.id,
    action: "delete_member",
    table_name: "profiles",
    record_id: id,
    detail: (target as any).full_name ?? null,
  });

  revalidatePath("/portal/members");
  redirect("/portal/members?ok=" + encodeURIComponent(`Nabura ang member${name ? `: ${name}` : ""}.`));
}
