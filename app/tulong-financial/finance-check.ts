import { getSupabase, FINANCE_MINISTRY_NAME } from "@/lib/portal";

// Walang redirect: nagbabalik lang ng true/false kung ang kasalukuyang portal session
// ay may Tulong Financial access (Admin o Finance Ministry member).
export async function isTulongFinancePortalUser(): Promise<boolean> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return false;
  if ((profile as any).role === "admin") return true;
  const { data: mm } = await supabase
    .from("ministry_members")
    .select("ministries(name)")
    .eq("profile_id", (profile as any).id);
  return ((mm ?? []) as any[]).some((m) => m.ministries?.name === FINANCE_MINISTRY_NAME);
}
