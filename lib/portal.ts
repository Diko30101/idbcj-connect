import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------
// MGA SETTING NA PUWEDENG BAGUHIN NG ADMIN
// ---------------------------------------------------------------
export const CONSENT_VERSION = "v1-draft";
// Ilagay dito ang contact ng Data Protection Officer kapag naitalaga na.
export const DPO_CONTACT = "Ilalagay pagkatapos italaga ang Data Protection Officer";

import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/categories";
import { LOCALITIES, LOCALITY_LABEL, type Locality } from "@/lib/locality";

export { CATEGORIES, CATEGORY_LABEL, LOCALITIES, LOCALITY_LABEL };
export type { Category, Locality };

export type Role = "admin" | "secretary" | "leader" | "member";
export type MemberStatus = "visitor" | "active" | "inactive";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  role: Role;
  status: MemberStatus;
  username: string | null;
  category: Category;
  locality: Locality | null;
  must_change_password: boolean;
  birthday: string | null;
  city: string | null;
  baptism_status: string | null;
  baptism_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  member_since: string | null;
  consent_at: string | null;
  consent_version: string | null;
  notifications_seen_at: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin (Presiding Minister)",
  secretary: "Secretary",
  leader: "Ministry Leader",
  member: "Member",
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  visitor: "Visitor",
  active: "Active",
  inactive: "Inactive",
};

export const KIND_LABEL: Record<string, string> = {
  sunday: "Sunday Worship",
  new_year_thanksgiving: "New Year Thanksgiving",
  yearly_thanksgiving: "Yearly Thanksgiving",
  extra_thanksgiving: "Extra Thanksgiving",
  monthly_ministerial_class: "Monthly Ministerial Class",
  other: "Others",
};

export const isStaff = (r: Role) => r === "admin" || r === "secretary";

// ---------------------------------------------------------------
// Petsa (Philippine time)
// ---------------------------------------------------------------
export function todayPH(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function nextSundayPH(): string {
  const [y, m, d] = todayPH().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + ((7 - dt.getUTCDay()) % 7));
  return dt.toISOString().slice(0, 10);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------
// Sesyon at profile ng naka-login (isang beses lang bawat request)
// ---------------------------------------------------------------
export const getSupabase = cache(async () => {
  const cookieStore = await cookies();
  return createClient(cookieStore as any);
});

export const getPortalContext = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Safety net: kung walang profile pa ang account
    await supabase
      .from("profiles")
      .insert({ id: user.id, email: user.email, role: "member", status: "active" });
    const res = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = res.data;
  }
  if (!profile) redirect("/auth/login");

  return { supabase, user, profile: profile as Profile };
});

// Kailangan ng consent bago gamitin ang portal
export async function requirePortalAccess() {
  const ctx = await getPortalContext();
  // Temporary password pa lang ang gamit: palitan muna bago magpatuloy
  if (ctx.profile.must_change_password) redirect("/change-password");
  if (ctx.profile.status !== "inactive" && !ctx.profile.consent_at) redirect("/consent");
  return ctx;
}

export async function requireRoles(roles: Role[]) {
  const ctx = await requirePortalAccess();
  if (!roles.includes(ctx.profile.role)) redirect("/portal?error=" + encodeURIComponent("Wala kang access sa pahinang iyon."));
  return ctx;
}

// Para sa mensahe pagkatapos ng isang aksyon
export function back(path: string, kind: "ok" | "error", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
