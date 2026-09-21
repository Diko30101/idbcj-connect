import { requireRoles } from "@/lib/portal";
import { Empty, PageHeader, Panel } from "@/components/portal/ui";

export default async function AuditPage() {
  const { supabase } = await requireRoles(["admin"]);

  const { data } = await supabase
    .from("audit_log")
    .select("id, at, actor, action, table_name, record_id, detail")
    .order("at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as any[];

  const ids = Array.from(new Set(rows.flatMap((r) => [r.actor, r.record_id]).filter(Boolean)));
  const { data: names } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as any[] };
  const nameOf = new Map(((names ?? []) as any[]).map((n) => [n.id, n.full_name || n.email || n.id]));

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Talaan kung sino ang nagbago ng profile ng iba, o ng role at status. Hindi nakalagay ang laman ng mga pribadong datos." />
      <Panel>
        {rows.length === 0 ? (
          <Empty>Wala pang talaan.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="py-2 pr-3">Kailan</th>
                  <th className="py-2 pr-3">Sino</th>
                  <th className="py-2 pr-3">Kaninong profile</th>
                  <th className="py-2">Binago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-500">
                      {new Date(r.at).toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-3">{r.actor ? nameOf.get(r.actor) ?? r.actor : "System / Supabase"}</td>
                    <td className="py-2 pr-3">{nameOf.get(r.record_id) ?? r.record_id}</td>
                    <td className="py-2 text-gray-600">
                      {(r.detail?.fields ?? []).join(", ")}
                      {r.detail?.role && ` (role: ${r.detail.role[0]} → ${r.detail.role[1]})`}
                      {r.detail?.status && ` (status: ${r.detail.status[0]} → ${r.detail.status[1]})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">Oras sa Pilipinas.</p>
      </Panel>
    </>
  );
}
