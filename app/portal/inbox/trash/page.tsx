import Link from "next/link";
import { requirePortalAccess, fmtDate } from "@/lib/portal";
import { restoreLetterFromTrash } from "../../actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls } from "@/components/portal/ui";

const TRASH_DAYS = 30;

export default async function InboxTrashPage({
    searchParams,
}: {
    searchParams: Promise<{ ok?: string; error?: string }>;
}) {
    const { ok, error } = await searchParams;
    const { supabase, profile } = await requirePortalAccess();

    const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
        .from("letter_deletions")
        .select("letter_id, deleted_at, letters(id, subject, created_at, profiles(full_name))")
        .eq("profile_id", profile.id)
        .gte("deleted_at", cutoff)
        .order("deleted_at", { ascending: false });

    const list = (data ?? []) as any[];

    return (
        <>
            <PageHeader
                title="Basurahan ng Inbox"
                subtitle={`Ang mga liham dito ay awtomatikong mawawala pagkalipas ng ${TRASH_DAYS} araw mula nang mabura.`}
                action={
                    <Link href="/portal/inbox" className={btnGhostCls}>
                        ← Inbox
                    </Link>
                }
            />
            <Notice ok={ok} error={error} />

            <Panel>
                {list.length === 0 ? (
                    <Empty>Walang laman ang basurahan.</Empty>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {list.map((d) => {
                            const l = d.letters;
                            if (!l) return null;
                            const deletedAt = new Date(d.deleted_at);
                            const daysLeft = Math.max(
                                0,
                                TRASH_DAYS - Math.floor((Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000)),
                            );
                            return (
                                <li key={d.letter_id} className="flex items-center justify-between gap-3 py-3">
                                    <div>
                                        <div className="font-semibold text-gray-700">{l.subject}</div>
                                        <div className="text-xs text-gray-500">
                                            Mula kay {l.profiles?.full_name ?? "Staff"} · {fmtDate(l.created_at)}
                                        </div>
                                        <div className="text-xs text-amber-700">
                                            {daysLeft > 0 ? `${daysLeft} araw na lang bago tuluyang mabura` : "Mabubura na sa lalong madaling panahon"}
                                        </div>
                                    </div>
                                    <form action={restoreLetterFromTrash}>
                                        <input type="hidden" name="id" value={d.letter_id} />
                                        <button className={btnCls}>Ibalik</button>
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