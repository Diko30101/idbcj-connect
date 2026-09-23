import Link from "next/link";
import { requirePortalAccess, isStaff, fmtDate } from "@/lib/portal";
import { deleteLetterFromInbox } from "../actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls } from "@/components/portal/ui";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const [lettersRes, mineRes, deletedRes] = await Promise.all([
    supabase
      .from("letters")
      .select("id, subject, created_at, created_by, profiles!letters_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("letter_recipients").select("letter_id, read_at").eq("profile_id", profile.id),
    supabase.from("letter_deletions").select("letter_id").eq("profile_id", profile.id),
  ]);

  const myMap = new Map(((mineRes.data ?? []) as any[]).map((r) => [r.letter_id, r.read_at as string | null]));
  const deletedIds = new Set(((deletedRes.data ?? []) as any[]).map((d) => d.letter_id));
  const list = ((lettersRes.data ?? []) as any[]).filter((l) => !deletedIds.has(l.id));

  // PANSAMANTALANG DEBUG: ipakita ang tunay na error kung bakit walang laman
  // ang listahan, para malaman natin agad ang eksaktong dahilan.
  const debugError =
    lettersRes.error?.message || deletedRes.error?.message || mineRes.error?.message || undefined;

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Mga liham mula sa Administrative."
        action={
          <div className="flex gap-2">
            <Link href="/portal/inbox/trash" className={btnGhostCls}>
              Basurahan
            </Link>
            {staff && (
              <Link href="/portal/inbox/compose" className={btnCls}>
                Sumulat ng liham
              </Link>
            )}
          </div>
        }
      />
      <Notice ok={ok} error={error || debugError} />

      <Panel>
        {list.length === 0 ? (
          <Empty>Wala pang liham.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((l) => {
              const readAt = myMap.has(l.id) ? myMap.get(l.id) : undefined;
              const unread = myMap.has(l.id) && !readAt;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/portal/inbox/${l.id}`} className="flex-1 hover:opacity-80">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${unread ? "text-gray-900" : "text-gray-700"}`}>{l.subject}</span>
                      {unread && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Bago</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Mula kay {l.profiles?.full_name ?? "Staff"} · {fmtDate(l.created_at)}
                    </div>
                  </Link>
                  <form action={deleteLetterFromInbox}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className={btnDangerCls}>Burahin</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}