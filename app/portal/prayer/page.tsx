import { requirePortalAccess, fmtDate } from "@/lib/portal";
import { deletePrayer, setPrayerStatus, submitPrayer } from "../actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

const STATUS_TEXT: Record<string, string> = { open: "Bukas", answered: "Nasagot", closed: "Sarado" };

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const admin = profile.role === "admin";

  const { data } = await supabase
    .from("prayer_requests")
    .select("id, body, status, created_at, author_id, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (data ?? []) as any[];
  const mine = list.filter((p) => p.author_id === profile.id);
  const others = admin ? list.filter((p) => p.author_id !== profile.id) : [];

  const Item = ({ p, showAuthor }: { p: any; showAuthor: boolean }) => (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        <span>
          {showAuthor ? <strong className="text-gray-700">{p.profiles?.full_name || "Member"}</strong> : null}{" "}
          {fmtDate(p.created_at)}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{STATUS_TEXT[p.status]}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{p.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {admin && p.status !== "answered" && (
          <form action={setPrayerStatus}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="status" value="answered" />
            <button className={btnGhostCls}>Nasagot na</button>
          </form>
        )}
        {(admin || p.author_id === profile.id) && p.status !== "closed" && (
          <form action={setPrayerStatus}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="status" value="closed" />
            <button className={btnGhostCls}>Isara</button>
          </form>
        )}
        {p.author_id === profile.id && (
          <form action={deletePrayer}>
            <input type="hidden" name="id" value={p.id} />
            <button className={btnDangerCls}>Burahin</button>
          </form>
        )}
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="Prayer Requests" subtitle="Pribado. Ikaw at ang Presiding Minister lamang ang makakabasa." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Magpadala ng kahilingan">
          <form action={submitPrayer} className="grid gap-3">
            <textarea
              name="body"
              required
              rows={5}
              maxLength={2000}
              className={inputCls}
              placeholder="Isulat ang iyong kahilingan sa panalangin…"
            />
            <button className={btnCls}>Ipadala</button>
            <p className="text-xs text-gray-400">
              Hindi ito ipapakita sa ibang members. Huwag isulat ang impormasyon ng ibang tao nang wala nilang pahintulot.
            </p>
          </form>
        </Panel>

        <div className="space-y-6 lg:col-span-2">
          <Panel title="Ang aking mga kahilingan">
            {mine.length === 0 ? (
              <Empty>Wala ka pang ipinapadala.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {mine.map((p) => <Item key={p.id} p={p} showAuthor={false} />)}
              </ul>
            )}
          </Panel>

          {admin && (
            <Panel title="Mula sa mga members">
              {others.length === 0 ? (
                <Empty>Wala pang kahilingan mula sa iba.</Empty>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {others.map((p) => <Item key={p.id} p={p} showAuthor />)}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
