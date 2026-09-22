import Link from "next/link";
import { requirePortalAccess, isStaff, fmtDate } from "@/lib/portal";
import { Empty, Notice, PageHeader, Panel, btnCls } from "@/components/portal/ui";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const [lettersRes, mineRes] = await Promise.all([
    supabase
      .from("letters")
      .select("id, subject, created_at, created_by, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("letter_recipients").select("letter_id, read_at").eq("profile_id", profile.id),
  ]);

  const myMap = new Map(((mineRes.data ?? []) as any[]).map((r) => [r.letter_id, r.read_at as string | null]));
  const list = (lettersRes.data ?? []) as any[];

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Mga liham mula sa Administrative."
        action={
          staff ? (
            <Link href="/portal/inbox/compose" className={btnCls}>
              Sumulat ng liham
            </Link>
          ) : undefined
        }
      />
      <Notice ok={ok} error={error} />

      <Panel>
        {list.length === 0 ? (
          <Empty>Wala pang liham.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((l) => {
              const readAt = myMap.has(l.id) ? myMap.get(l.id) : undefined;
              const unread = myMap.has(l.id) && !readAt;
              return (
                <li key={l.id}>
                  <Link
                    href={`/portal/inbox/${l.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-emerald-50/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${unread ? "text-gray-900" : "text-gray-700"}`}>{l.subject}</span>
                        {unread && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Bago</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Mula kay {l.profiles?.full_name ?? "Staff"} · {fmtDate(l.created_at)}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
