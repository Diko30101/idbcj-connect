"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  back,
  fmtDate,
  getPortalContext,
  isStaff,
  KINDS,
  requireLocalFinanceAccess,
  requirePortalAccess,
  requireRoles,
  str,
  strOrNull,
  type Role,
} from "@/lib/portal";
import { CATEGORIES, type Category } from "@/lib/categories";
import { LOCALITIES, type Locality } from "@/lib/locality";
import { WORSHIP, WORSHIP_BATANGAS, WORSHIP_ALBERTA } from "@/lib/worship";
import { FINANCE_CATEGORIES, monthToDate } from "@/lib/finance";

const STATUSES = ["visitor", "active", "inactive"];
const ROLES: Role[] = ["admin", "secretary", "leader", "member", "treasurer"];
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
  const localityRaw = str(fd, "locality");
  const locality = (localityRaw || null) as Locality | null;
  if (
    !STATUSES.includes(status) ||
    !BAPTISM.includes(baptism) ||
    !CATEGORIES.includes(category) ||
    (locality !== null && !LOCALITIES.includes(locality))
  )
    back(path, "error", "Di-wastong halaga.");

  const patch: Record<string, unknown> = {
    full_name: str(fd, "full_name"),
    phone_number: strOrNull(fd, "phone_number"),
    city: strOrNull(fd, "city"),
    status,
    category,
    locality,
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

export async function updateMinistry(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const path = `/portal/ministries/${id}`;
  const name = str(fd, "name");
  if (!name) back(path, "error", "Isulat ang pangalan ng ministry.");
  const { error } = await supabase
    .from("ministries")
    .update({ name, name_tl: strOrNull(fd, "name_tl"), description: strOrNull(fd, "description") })
    .eq("id", id);
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/ministries", "layout");
  back(path, "ok", "Na-update ang ministry.");
}

export async function deleteMinistry(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase.from("ministries").delete().eq("id", id);
  if (error) back(`/portal/ministries/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/ministries", "layout");
  redirect(
    "/portal/ministries?ok=" +
      encodeURIComponent("Nabura ang ministry pati na ang mga miyembro, iskedyul, at anunsyo nito."),
  );
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

export async function updateService(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const path = `/portal/attendance/${id}`;
  const date = str(fd, "service_date");
  const kind = str(fd, "kind");
  if (!date || !KINDS.includes(kind)) back(path, "error", "Kumpletuhin ang petsa at uri.");
  const { error } = await supabase
    .from("services")
    .update({ service_date: date, kind, title: strOrNull(fd, "title") })
    .eq("id", id);
  if (error) {
    back(
      path,
      "error",
      error.code === "23505" ? "May naka-tala nang serbisyo sa petsa at uring iyon." : "Hindi na-save: " + error.message,
    );
  }
  revalidatePath("/portal/attendance", "layout");
  back(path, "ok", "Na-update ang detalye ng serbisyo.");
}

export async function deleteService(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) back(`/portal/attendance/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/attendance", "layout");
  redirect("/portal/attendance?ok=" + encodeURIComponent("Nabura ang serbisyo pati na ang mga naitalang attendance dito."));
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

// ---------------------------------------------------------------
// NOTIFICATION BELL (mga bagong anunsyo, iskedyul ng ministry, at bagong serbisyo)
// ---------------------------------------------------------------
export type NotificationItem = {
  id: string;
  kind: "announcement" | "schedule" | "service" | "letter";
  title: string;
  subtitle: string;
  date: string;
  href: string;
};

// Maikling buod ng oras/lugar ng Sunday Worship, kinuha sa lib/worship.ts (iisang pinagmumulan)
function worshipSummary(): string {
  const place = (loc: string) => loc.split(",")[0];
  return [
    `${place(WORSHIP.location)} ${WORSHIP.displayTime}`,
    `${place(WORSHIP_BATANGAS.location)} ${WORSHIP_BATANGAS.displayTimes.join("/")}`,
    `${place(WORSHIP_ALBERTA.location)} ${WORSHIP_ALBERTA.displayTime}`,
  ].join(" · ");
}

// Ang Monthly Ministerial Class ay para lang sa mga miyembro ng ministry na ito
const ADMINISTRATIVE_MINISTRY_NAME = "Administrative Ministry";

export async function getNotifications(): Promise<{ items: NotificationItem[] }> {
  const { supabase, profile } = await requirePortalAccess();
  const seenAt = profile.notifications_seen_at;

  const [ann, sched, svc, myMinistries, letters] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, ministry_id, created_at, ministries(name)")
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("ministry_schedule")
      .select("id, title, service_date, ministry_id, created_at, ministries(name)")
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(15),
    // Bagong Sunday Worship service (manual o awtomatiko bawat Linggo) — ipaalam sa lahat ng members
    supabase
      .from("services")
      .select("id, service_date, kind, created_at")
      .eq("kind", "sunday")
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(10),
    // Para malaman kung kabilang ang naka-login sa Administrative Ministry
    supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id),
    // Bagong mensahe sa Inbox (liham o reply) na hindi galing sa sarili
    supabase
      .from("letter_messages")
      .select("id, letter_id, author_id, created_at, letters(subject), profiles(full_name)")
      .neq("author_id", profile.id)
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const isAdminMinistryMember = ((myMinistries.data ?? []) as any[]).some(
    (m) => m.ministries?.name === ADMINISTRATIVE_MINISTRY_NAME,
  );

  // Bagong Monthly Ministerial Class — para lang sa Administrative Ministry
  const mclass = isAdminMinistryMember
    ? await supabase
        .from("services")
        .select("id, service_date, title, created_at")
        .eq("kind", "monthly_ministerial_class")
        .gt("created_at", seenAt)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as any[] };

  const items: NotificationItem[] = [
    ...((ann.data ?? []) as any[]).map((a) => ({
      id: `a-${a.id}`,
      kind: "announcement" as const,
      title: a.title as string,
      subtitle: (a.ministries?.name as string | undefined) ?? "Para sa lahat",
      date: a.created_at as string,
      href: "/portal/announcements",
    })),
    ...((sched.data ?? []) as any[]).map((s) => ({
      id: `s-${s.id}`,
      kind: "schedule" as const,
      title: s.title as string,
      subtitle: `${(s.ministries?.name as string | undefined) ?? "Ministry"} · ${fmtDate(s.service_date)}`,
      date: s.created_at as string,
      href: `/portal/ministries/${s.ministry_id}`,
    })),
    ...((svc.data ?? []) as any[]).map((s) => ({
      id: `sv-${s.id}`,
      kind: "service" as const,
      title: `Sunday Worship · ${fmtDate(s.service_date)}`,
      subtitle: worshipSummary(),
      date: s.created_at as string,
      href: "/portal",
    })),
    ...((mclass.data ?? []) as any[]).map((s) => ({
      id: `mc-${s.id}`,
      kind: "service" as const,
      title: `Monthly Ministerial Class · ${fmtDate(s.service_date)}`,
      subtitle: s.title ? (s.title as string) : "Para sa Administrative Ministry",
      date: s.created_at as string,
      href: "/portal",
    })),
    ...((letters.data ?? []) as any[]).map((m) => ({
      id: `lt-${m.id}`,
      kind: "letter" as const,
      title: (m.letters?.subject as string | undefined) ?? "Liham",
      subtitle: `Mula kay ${(m.profiles?.full_name as string | undefined) ?? "Staff"}`,
      date: m.created_at as string,
      href: `/portal/inbox/${m.letter_id}`,
    })),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));

  return { items };
}

export async function markNotificationsSeen() {
  const { supabase, user } = await requirePortalAccess();
  await supabase.from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", user.id);
}

// ---------------------------------------------------------------
// INBOX (mga liham mula sa Administrative/staff papunta sa piniling members)
// ---------------------------------------------------------------
export async function createLetter(fd: FormData) {
  const { supabase, user } = await requireRoles(["admin", "secretary"]);
  const subject = str(fd, "subject");
  const body = str(fd, "body");
  const recipients = fd.getAll("recipients").map(String);
  if (!subject || !body) back("/portal/inbox/compose", "error", "Isulat ang paksa at mensahe.");
  if (recipients.length === 0) back("/portal/inbox/compose", "error", "Pumili ng kahit isang tatanggap.");

  const { data: letter, error } = await supabase.from("letters").insert({ subject, created_by: user.id }).select("id").single();
  if (error) back("/portal/inbox/compose", "error", "Hindi nagawa: " + error.message);

  const { error: e2 } = await supabase
    .from("letter_recipients")
    .insert(recipients.map((id) => ({ letter_id: letter!.id, profile_id: id })));
  if (e2) back("/portal/inbox/compose", "error", "Hindi na-set ang mga tatanggap: " + e2.message);

  const { error: e3 } = await supabase.from("letter_messages").insert({ letter_id: letter!.id, author_id: user.id, body });
  if (e3) back("/portal/inbox/compose", "error", "Hindi naipadala ang mensahe: " + e3.message);

  revalidatePath("/portal/inbox", "layout");
  redirect(`/portal/inbox/${letter!.id}?ok=` + encodeURIComponent("Naipadala ang liham."));
}

// ---------------------------------------------------------------
// FINANCIAL RECORDS (buwanang koleksyon: abuluyan, ambagan, tulong sa aral, pasalamat)
// ---------------------------------------------------------------
export async function saveMonthlyFinancials(fd: FormData) {
  const { supabase, user } = await requireRoles(["admin", "secretary", "treasurer"]);
  const month = str(fd, "month");
  const path = `/portal/finance?month=${encodeURIComponent(month)}`;
  if (!/^\d{4}-\d{2}$/.test(month)) back(path, "error", "Di-wastong buwan.");
  const recordMonth = monthToDate(month);

  // Tandaan: ang updated_by ay in-o-overwrite sa bawat save (huling nag-encode); hindi ito
  // creator log, kundi "sino ang huling nag-save" para sa accountability.
  const rows: {
    record_month: string;
    locality: string;
    category: string;
    amount: number;
    note: string | null;
    updated_by: string;
  }[] = [];

  for (const locality of LOCALITIES) {
    for (const category of FINANCE_CATEGORIES) {
      const raw = str(fd, `amt_${locality}_${category}`);
      const amount = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
      const note = strOrNull(fd, `note_${locality}_${category}`);
      rows.push({ record_month: recordMonth, locality, category, amount, note, updated_by: user.id });
    }
  }

  const { error } = await supabase
    .from("financial_records")
    .upsert(rows, { onConflict: "record_month,locality,category" });
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/finance", "layout");
  back(path, "ok", `Na-save ang financial records para sa ${month}.`);
}

// Pag-edit ng buong taon para sa isang lokal (mula sa Taunang Buod report)
export async function saveYearlyLocalityFinancials(fd: FormData) {
  const { supabase, user } = await requireRoles(["admin", "secretary", "treasurer"]);
  const year = str(fd, "year");
  const locality = str(fd, "locality");
  const path = `/portal/finance?year=${encodeURIComponent(year)}&locality=${encodeURIComponent(locality)}`;
  if (!/^\d{4}$/.test(year)) back(path, "error", "Di-wastong taon.");
  if (!LOCALITIES.includes(locality as Locality)) back(path, "error", "Di-wastong lokal.");

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const rows: {
    record_month: string;
    locality: string;
    category: string;
    amount: number;
    note: string | null;
    updated_by: string;
  }[] = [];

  for (const mm of months) {
    for (const category of FINANCE_CATEGORIES) {
      const raw = str(fd, `amt_${mm}_${category}`);
      const amount = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
      const note = strOrNull(fd, `note_${mm}_${category}`);
      rows.push({ record_month: `${year}-${mm}-01`, locality, category, amount, note, updated_by: user.id });
    }
  }

  const { error } = await supabase
    .from("financial_records")
    .upsert(rows, { onConflict: "record_month,locality,category" });
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/finance", "layout");
  back(path, "ok", `Na-save ang financial records ng ${year} para sa lokal na ito.`);
}

// Local Treasurer: pag-encode ng financial records, sariling lokal lang (mula sa profile,
// hindi galing sa form, para hindi ito mapalitan)
export async function saveLocalFinancials(fd: FormData) {
  const { supabase, user, locality } = await requireLocalFinanceAccess();
  const month = str(fd, "month");
  const path = `/portal/finance/local?month=${encodeURIComponent(month)}`;
  if (!/^\d{4}-\d{2}$/.test(month)) back(path, "error", "Di-wastong buwan.");
  const recordMonth = monthToDate(month);

  const rows = FINANCE_CATEGORIES.map((category) => {
    const raw = str(fd, `amt_${category}`);
    const amount = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
    const note = strOrNull(fd, `note_${category}`);
    return { record_month: recordMonth, locality, category, amount, note, updated_by: user.id };
  });

  const { error } = await supabase
    .from("financial_records")
    .upsert(rows, { onConflict: "record_month,locality,category" });
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/finance/local", "layout");
  back(path, "ok", `Na-save ang financial records para sa ${month}.`);
}

// Local Treasurer: pag-edit ng buong taon, sariling lokal lang (mula sa profile,
// hindi galing sa form, para hindi ito mapalitan)
export async function saveLocalYearlyFinancials(fd: FormData) {
  const { supabase, user, locality } = await requireLocalFinanceAccess();
  const year = str(fd, "year");
  const path = `/portal/finance/local?year=${encodeURIComponent(year)}`;
  if (!/^\d{4}$/.test(year)) back(path, "error", "Di-wastong taon.");

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const rows: {
    record_month: string;
    locality: string;
    category: string;
    amount: number;
    note: string | null;
    updated_by: string;
  }[] = [];

  for (const mm of months) {
    for (const category of FINANCE_CATEGORIES) {
      const raw = str(fd, `amt_${mm}_${category}`);
      const amount = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
      const note = strOrNull(fd, `note_${mm}_${category}`);
      rows.push({ record_month: `${year}-${mm}-01`, locality, category, amount, note, updated_by: user.id });
    }
  }

  const { error } = await supabase
    .from("financial_records")
    .upsert(rows, { onConflict: "record_month,locality,category" });
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/finance/local", "layout");
  back(path, "ok", `Na-save ang financial records ng ${year}.`);
}

export async function replyToLetter(fd: FormData) {
  const { supabase, user } = await requirePortalAccess();
  const letterId = str(fd, "letter_id");
  const path = `/portal/inbox/${letterId}`;
  const body = str(fd, "body");
  if (!body) back(path, "error", "Isulat ang sagot.");
  const { error } = await supabase.from("letter_messages").insert({ letter_id: letterId, author_id: user.id, body });
  if (error) back(path, "error", "Hindi naipadala: " + error.message);
  revalidatePath(path);
  back(path, "ok", "Naipadala.");
}
