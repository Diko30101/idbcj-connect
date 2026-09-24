import { getRosterContext } from "@/lib/portal";
import { MEMBER_STATUSES } from "@/lib/roster";

// GET /portal/roster/export?local=&status=&q=&pending= — CSV download ng roster
// na may parehong filter ng pahina, ayon sa sakop na locals ng naka-log in.
export async function GET(req: Request) {
  const { supabase, locals } = await getRosterContext();
  const sp = new URL(req.url).searchParams;
  const local = sp.get("local") ?? "";
  const status = sp.get("status") ?? "";
  const q = sp.get("q") ?? "";
  const pending = sp.get("pending") ?? "";
  const localIds = locals.map((l) => l.id);

  const term = q.replace(/[,()%*\\]/g, " ").trim();
  let query = supabase
    .from("members")
    .select("full_name, local_id, status, confirmed_at")
    .order("full_name", { ascending: true })
    .limit(5000);
  if (locals.some((l) => l.id === local)) query = query.eq("local_id", local);
  else query = query.in("local_id", localIds);
  if ((MEMBER_STATUSES as string[]).includes(status)) query = query.eq("status", status);
  if (pending === "1") query = query.is("confirmed_at", null);
  if (term) query = query.ilike("full_name", `%${term}%`);

  const { data } = await query;
  const localName = new Map(locals.map((l) => [l.id, l.name]));
  const esc = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    "full_name,locale,status,confirmed_at",
    ...((data ?? []) as { full_name: string; local_id: string; status: string; confirmed_at: string | null }[]).map(
      (m) => [esc(m.full_name), esc(localName.get(m.local_id) ?? ""), esc(m.status), esc(m.confirmed_at)].join(","),
    ),
  ];
  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="roster.csv"',
    },
  });
}
