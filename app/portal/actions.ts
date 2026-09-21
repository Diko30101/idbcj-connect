"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  back,
  getPortalContext,
  isStaff,
  requirePortalAccess,
  requireRoles,
  str,
  strOrNull,
  type Role,
} from "@/lib/portal";
import { CATEGORIES, type Category } from "@/lib/categories";

const STATUSES = ["visitor", "active", "inactive"];
const ROLES: Role[] = ["admin", "secretary", "leader", "member"];
const KINDS = ["sunday", "midweek", "special"];
const BAPTISM = ["Not Baptized", "Scheduled", "Baptized"];

// ---------------------------------------------------------------
// PROFILE (sarili)
// ---------------------------------------------------------------
export async function updateMyProfile(fd: FormData) {
  const { supabase, user } = await requirePortalAccess();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(fd, "full_name"),
      phone_number: strOrNull(fd, "phone_number"),
      birthday: strOrNull(fd, "birthday"),
      city: strOrNull(fd, "city"),
      emergency_contact_name: strOrNull(fd, "emergency_contact_name"),
      emergency_contact_phone: strOrNull(fd, "emergency_contact_phone"),
    })
    .eq("id", user.id);
  if (error) back("/portal/profile", "error", "Hindi na-save. Subukan ulit.");
  revalidatePath("/portal", "layout");
  back("/portal/profile", "ok", "Na-save ang iyong impormasyon.");
}

// ---------------------------------------------------------------
// MEMBERS (staff)
// ---------------------------------------------------------------
export async function updateMember(fd: FormData) {
  const { supabase, profile } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const path = `/portal/members/${id}`;
  const status = str(fd, "status");
  const baptism = str(fd, "baptism_status");
  const category = str(fd, "category") as Category;
  if (!STATUSES.includes(status) || !BAPTISM.includes(baptism) || !CATEGORIES.includes(category)) back(path, "error", "Di-wastong halaga.");

  const patch: Record<string, unknown> = {
    full_name: str(fd, "full_name"),
    phone_number: strOrNull(fd, "phone_number"),
    city: strOrNull(fd, "city"),
    status,
    category,
    baptism_status: baptism,
    baptism_date: strOrNull(fd, "baptism_date"),
    member_since: strOrNull(fd, "member_since"),
  };
  if (profile.role === "admin") {
    const role = str(fd, "role");
    if (!ROLES.includes(role as Role)) back(path, "error", "Di-wastong role.");
    patch.role = role;
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/members");
  back(path, "ok", "Na-save ang mga pagbabago.");
}

export async function addMemberToMinistry(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const profileId = str(fd, "profile_id");
  const ministryId = str(fd, "ministry_id");
  const returnTo = str(fd, "return_to") || `/portal/members/${profileId}`;
  if (!profileId || !ministryId) back(returnTo, "error", "Pumili muna ng ministry o member.");
  const { error } = await supabase
    .from("ministry_members")
    .upsert({ ministry_id: ministryId, profile_id: profileId }, { onConflict: "ministry_id,profile_id", ignoreDuplicates: true });
  if (error) back(returnTo, "error", "Hindi nadagdag: " + error.message);
  revalidatePath("/portal/ministries", "layout");
  back(returnTo, "ok", "Nadagdag sa ministry.");
}

export async function removeFromMinistry(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const profileId = str(fd, "profile_id");
  const ministryId = str(fd, "ministry_id");
  const returnTo = str(fd, "return_to") || `/portal/members/${profileId}`;
  const { error } = await supabase
    .from("ministry_members")
    .delete()
    .eq("ministry_id", ministryId)
    .eq("profile_id", profileId);
  if (error) back(returnTo, "error", "Hindi naalis: " + error.message);
  revalidatePath("/portal/ministries", "layout");
  back(returnTo, "ok", "Naalis sa ministry.");
}

export async function setMinistryLeader(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const profileId = str(fd, "profile_id");
  const ministryId = str(fd, "ministry_id");
  const makeLeader = str(fd, "make_leader") === "true";
  const returnTo = str(fd, "return_to") || `/portal/ministries/${ministryId}`;
  const { error } = await supabase
    .from("ministry_members")
    .update({ is_leader: makeLeader })
    .eq("ministry_id", ministryId)
    .eq("profile_id", profileId);
  if (error) back(returnTo, "error", "Hindi na-update: " + error.message);
  back(returnTo, "ok", makeLeader ? "Ginawang leader." : "Tinanggal bilang leader.");
}

// ---------------------------------------------------------------
// MINISTRIES
// ---------------------------------------------------------------
export async function createMinistry(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const name = str(fd, "name");
  if (!name) back("/portal/ministries", "error", "Isulat ang pangalan ng ministry.");
  const { data, error } = await supabase
    .from("ministries")
    .insert({ name, name_tl: strOrNull(fd, "name_tl"), description: strOrNull(fd, "description") })
    .select("id")
    .single();
  if (error) back("/portal/ministries", "error", "Hindi nagawa: " + error.message);
  revalidatePath("/portal/ministries");
  redirect(`/portal/ministries/${data!.id}?ok=` + encodeURIComponent("Nagawa ang ministry."));
}

export async function createSchedule(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const ministryId = str(fd, "ministry_id");
  const path = `/portal/ministries/${ministryId}`;
  const title = str(fd, "title");
  const date = str(fd, "service_date");
  if (!title || !date) back(path, "error", "Kumpletuhin ang petsa at paglalarawan.");
  const { error } = await supabase.from("ministry_schedule").insert({
    ministry_id: ministryId,
    service_date: date,
    title,
    assigned_to: strOrNull(fd, "assigned_to"),
    note: strOrNull(fd, "note"),
  });
  if (error) back(path, "error", "Hindi nadagdag: " + error.message);
  revalidatePath(path);
  back(path, "ok", "Nadagdag sa iskedyul.");
}

export async function deleteSchedule(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const ministryId = str(fd, "ministry_id");
  const path = `/portal/ministries/${ministryId}`;
  const { error } = await supabase.from("ministry_schedule").delete().eq("id", str(fd, "id"));
  if (error) back(path, "error", "Hindi nabura: " + error.message);
  revalidatePath(path);
  back(path, "ok", "Nabura ang iskedyul.");
}

// ---------------------------------------------------------------
// ATTENDANCE (staff)
// ---------------------------------------------------------------
export async function createService(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const date = str(fd, "service_date");
  const kind = str(fd, "kind");
  if (!date || !KINDS.includes(kind)) back("/portal/attendance", "error", "Kumpletuhin ang petsa at uri.");
  const { data, error } = await supabase
    .from("services")
    .insert({ service_date: date, kind, title: strOrNull(fd, "title") })
    .select("id")
    .single();
  if (error) {
    back(
      "/portal/attendance",
      "error",
      error.code === "23505" ? "May naka-tala nang serbisyo sa petsa at uring iyon." : "Hindi nagawa: " + error.message,
    );
  }
  revalidatePath("/portal/attendance");
  redirect(`/portal/attendance/${data!.id}`);
}

export async function saveAttendance(fd: FormData) {
  const { supabase, user } = await requireRoles(["admin", "secretary"]);
  const serviceId = str(fd, "service_id");
  const path = `/portal/attendance/${serviceId}`;
  const all = fd.getAll("all").map(String);
  const present = new Set(fd.getAll("present").map(String));
  const visitors = Math.max(0, parseInt(str(fd, "visitors_count") || "0", 10) || 0);

  const rows = all.map((profile_id) => ({
    service_id: serviceId,
    profile_id,
    present: present.has(profile_id),
    marked_by: user.id,
    marked_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "service_id,profile_id" });
    if (error) back(path, "error", "Hindi na-save ang attendance: " + error.message);
  }
  const { error: e2 } = await supabase.from("services").update({ visitors_count: visitors }).eq("id", serviceId);
  if (e2) back(path, "error", "Na-save ang attendance pero hindi ang bilang ng bisita.");
  revalidatePath("/portal/attendance", "layout");
  back(path, "ok", `Na-save: ${present.size} ang dumalo.`);
}

// ---------------------------------------------------------------
// ANNOUNCEMENTS
// ---------------------------------------------------------------
export async function createAnnouncement(fd: FormData) {
  const { supabase, profile } = await requirePortalAccess();
  const title = str(fd, "title");
  const body = str(fd, "body");
  const ministryId = strOrNull(fd, "ministry_id");
  if (!title || !body) back("/portal/announcements", "error", "Isulat ang pamagat at mensahe.");
  if (!ministryId && !isStaff(profile.role)) back("/portal/announcements", "error", "Staff lang ang puwedeng mag-anunsyo sa lahat.");
  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    ministry_id: ministryId,
    published: str(fd, "published") === "on",
    expires_at: strOrNull(fd, "expires_at"),
  });
  if (error) back("/portal/announcements", "error", "Hindi nagawa: " + error.message);
  revalidatePath("/portal", "layout");
  back("/portal/announcements", "ok", "Nagawa ang anunsyo.");
}

export async function toggleAnnouncement(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const { error } = await supabase
    .from("announcements")
    .update({ published: str(fd, "publish") === "true" })
    .eq("id", str(fd, "id"));
  if (error) back("/portal/announcements", "error", "Hindi na-update: " + error.message);
  revalidatePath("/portal", "layout");
  back("/portal/announcements", "ok", "Na-update ang anunsyo.");
}

export async function deleteAnnouncement(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const { error } = await supabase.from("announcements").delete().eq("id", str(fd, "id"));
  if (error) back("/portal/announcements", "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal", "layout");
  back("/portal/announcements", "ok", "Nabura ang anunsyo.");
}

// ---------------------------------------------------------------
// PRAYER REQUESTS (pribado)
// ---------------------------------------------------------------
export async function submitPrayer(fd: FormData) {
  const { supabase, user } = await requirePortalAccess();
  const body = str(fd, "body");
  if (!body || body.length > 2000) back("/portal/prayer", "error", "Isulat ang kahilingan (hanggang 2000 na letra).");
  const { error } = await supabase.from("prayer_requests").insert({ author_id: user.id, body });
  if (error) back("/portal/prayer", "error", "Hindi naipadala: " + error.message);
  revalidatePath("/portal/prayer");
  back("/portal/prayer", "ok", "Naipadala ang iyong kahilingan. Ang Presiding Minister lamang ang makakabasa nito.");
}

export async function setPrayerStatus(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const status = str(fd, "status");
  if (!["open", "answered", "closed"].includes(status)) back("/portal/prayer", "error", "Di-wastong status.");
  const { error } = await supabase.from("prayer_requests").update({ status }).eq("id", str(fd, "id"));
  if (error) back("/portal/prayer", "error", "Hindi na-update: " + error.message);
  revalidatePath("/portal/prayer");
  back("/portal/prayer", "ok", "Na-update.");
}

export async function deletePrayer(fd: FormData) {
  const { supabase } = await requirePortalAccess();
  const { error } = await supabase.from("prayer_requests").delete().eq("id", str(fd, "id"));
  if (error) back("/portal/prayer", "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/prayer");
  back("/portal/prayer", "ok", "Nabura ang kahilingan.");
}
