import { requireFinanceSectionAccess, fmtDate } from "@/lib/portal";
import { fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel } from "@/components/portal/ui";
import { BalanceUpdateForm } from "@/components/portal/balance-update-form";

export type BalanceSnapshot = {
  id: string;
  account_key: string;
  account_label: string;
  balance: number;
  as_of: string;
  created_at: string;
  updatedByName: string | null;
};

const ACCOUNT_ORDER = ["bpi", "bdo", "cash"];

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireFinanceSectionAccess();

  const { data } = await supabase
    .from("pangasiwaan_balance_snapshots")
    .select(
      "id, account_key, account_label, balance, as_of, created_at, profiles!pangasiwaan_balance_snapshots_updated_by_fkey(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(90);

  const rows: BalanceSnapshot[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    account_key: r.account_key,
    account_label: r.account_label,
    balance: Number(r.balance),
    as_of: r.as_of,
    created_at: r.created_at,
    updatedByName: r.profiles?.full_name ?? null,
  }));

  // Pinakabagong snapshot bawat account = kasalukuyang balanse.
  const latest = new Map<string, BalanceSnapshot>();
  for (const r of rows) {
    if (!latest.has(r.account_key)) latest.set(r.account_key, r);
  }
  const current = ACCOUNT_ORDER.map((k) => latest.get(k)).filter((r) => r !== undefined);
  const total = current.reduce((s, r) => s + r.balance, 0);
  const lastUpdated = current.length > 0 ? current.map((r) => r.created_at).sort().reverse()[0] : null;

  // Kasaysayan: grupo bawat araw ng pag-update (pinakabagong araw muna).
  const byDay = new Map<string, BalanceSnapshot[]>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r);
  }
  const historyDays = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  return (
    <>
      <PageHeader
        title="Balanse ng Pangasiwaan"
        subtitle="Kasalukuyang balanse ng mga account ng iglesia (BPI, BDO, Cash on hand). Ang Finance Ministry ang nag-a-update kada linggo — bawat update ay bagong tala, hindi nabubura ang nakaraan."
      />
      <Notice ok={ok} error={error} />

      <div className="mt-6">
        <Panel
          title="Kasalukuyang Balanse"
          subtitle={lastUpdated ? `Huling na-update: ${fmtDate(lastUpdated)}` : undefined}
        >
          {current.length === 0 ? (
            <Empty>Wala pang naitatalang balanse.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Pinagmulan</th>
                    <th className="py-2 pr-3 text-right">Huling Balanse</th>
                    <th className="py-2 pr-3">Hanggang</th>
                    <th className="py-2 pr-3">Huling na-update ni</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((r) => (
                    <tr key={r.account_key} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">{r.account_label}</td>
                      <td className="py-2 pr-3 text-right text-gray-700">{fmtPeso(r.balance)}</td>
                      <td className="py-2 pr-3 text-gray-700">{fmtDate(r.as_of)}</td>
                      <td className="py-2 pr-3 text-gray-700">{r.updatedByName ?? "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                    <td className="py-2 pr-3">KABUUAN</td>
                    <td className="py-2 pr-3 text-right">{fmtPeso(total)}</td>
                    <td className="py-2 pr-3" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="I-update ang balanse">
          <p className="mb-4 text-sm text-gray-600">
            Ilagay ang bagong balanse at ang petsang sakop nito, tapos i-save. Mase-save ito bilang
            bagong tala sa kasaysayan.
          </p>
          <BalanceUpdateForm current={current} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Kasaysayan ng mga update">
          {historyDays.length === 0 ? (
            <Empty>Wala pang kasaysayan.</Empty>
          ) : (
            <div className="space-y-4">
              {historyDays.map(([day, dayRows]) => {
                const dayTotal = dayRows.reduce((s, r) => s + r.balance, 0);
                return (
                  <div key={day} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-800">{fmtDate(day)}</span>
                      <span className="font-semibold text-emerald-800">{fmtPeso(dayTotal)}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {ACCOUNT_ORDER.map((k) => {
                        const r = dayRows.find((x) => x.account_key === k);
                        return r ? (
                          <li key={k} className="flex items-center justify-between gap-2">
                            <span>
                              {r.account_label} <span className="text-gray-400">· hanggang {fmtDate(r.as_of)}</span>
                            </span>
                            <span className="font-medium text-gray-800">{fmtPeso(r.balance)}</span>
                          </li>
                        ) : null;
                      })}
                    </ul>
                    {dayRows[0]?.updatedByName && (
                      <div className="mt-2 text-xs text-gray-400">Na-update ni {dayRows[0].updatedByName}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
