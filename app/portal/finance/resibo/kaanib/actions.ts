"use server";

import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";

// Paghahanap ng kaanib para sa Resibo ng Kaanib — mga kaanib lang ng sariling
// lokal ng Local Finance user. Read-only; walang binabago.
export async function searchLocalMembers(q: string): Promise<{ id: string; full_name: string }[]> {
  const ctx = await getAbuluyanContext();
  const local = ctx.local;
  if (!local) denyAbuluyan();
  if (typeof q !== "string" || q.trim().length < 2 || q.length > 100) return [];
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  const { data } = await ctx.supabase
    .from("members")
    .select("id, full_name")
    .eq("local_id", local.id)
    .eq("status", "Active")
    .ilike("full_name", `%${term}%`)
    .order("full_name", { ascending: true })
    .limit(20);
  return ((data ?? []) as { id: string; full_name: string }[]);
}
