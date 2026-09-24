import Link from "next/link";
import { getFinanceAuditContext } from "@/lib/portal";
import { Empty, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { AUDIT_TABLE_LABEL, auditTableLabel, diffAudit, fmtAuditTime, fmtAuditValue } from "@/lib/audit";

const PAGE_SIZE = 50;
const AUDIT_BASE = "/portal/finance/audit";

type LogRow = {
  id: number;
  table_name: string;
  record_id: string | null;
  operation: "INSERT" | "UPDATE";
  changed_by: string | null;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};

// Audit ng pananalapi (finance_audit_log): church-wide Finance lang. Nababasa lang; ang mga trigger ang nagsusulat.
// Itinatala lang kung ano ang nagbago, kailan, at sino ang nagbago; walang paghuhusga o paalala tungkol sa pagbibigay.
export default async function FinanceAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; page?: string }>;
}) {
  const { table = "", page = "0" } = await searchParams;
  const ctx = await getFinanceAuditContext();
  const { supabase } = ctx;
  const pageNo = Math.max(0, Math.min(10_000, Number.parseInt(page, 10) || 0));

  let query = supabase
    .from("finance_audit_log")
    .select("id, table_name, record_id, operation, changed_by, changed_at, old_values, new_values", { count: "exact" })
    .order("id", { ascending: false })
    .range(pageNo * PAGE_SIZE, pageNo * PAGE_SIZE + PAGE_SIZE - 1);
  const tableFilter = table in AUDIT_TABLE_LABEL ? table : "";
  if (tableFilter) query = query.eq("table_name", tableFilter);
  const { data, count } = await query;
  const rows = (data ?? []) as LogRow[];

  // Mga pangalan (kaanib, local, sino ang nagbago) para sa mas madaling basahin
  const memberIds = new Set<string>();
  const profileIds = new Set<string>();
  const addMember = (v: unknown) => typeof v === "string" && memberIds.add(v);
  const addProfile = (v: unknown) => typeof v === "string" && profileIds.add(v);
  for (const r of rows) {
    addProfile(r.changed_by);
    for (const vals of [r.old_values, r.new_values]) {
      if (!vals) continue;
      addMember(vals.member_id);
      for (const [k, v] of Object.entries(vals)) if (k.endsWith("_by")) addProfile(v);
    }
  }
  const [{ data: nm }, { data: locs }, { data: prof }] = await Promise.all([
    memberIds.size ? supabase.rpc("member_display_names", { p_ids: [...memberIds] }) : Promise.resolve({ data: [] }),
    supabase.from("locals").select("id, name"),
    profileIds.size ? supabase.from("profiles").select("id, full_name").in("id", [...profileIds]) : Promise.resolve({ data: [] }),
  ]);
  const memberName = new Map(((nm ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.member_id, m.full_name]));
  const localName = new Map(((locs ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
  const profileName = new Map(((prof ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  const pretty = (field: string, shown: string): string => {
    if (field === "member_id") return memberName.get(shown) ?? shown;
    if (field === "local_id") return localName.get(shown) ?? shown;
    // Ang church-wide Finance ay nakakabasa lang ng sariling profile; ang iba ay ipinapakita bilang maikling ID (matutunton pa rin)
    if (field.endsWith("_by")) return shown === "—" ? shown : (profileName.get(shown) ?? `Profile ${shown.slice(0, 8)}`);
    if (field.endsWith("_at")) return fmtAuditTime(shown);
    return shown;
  };

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const total = count ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const href = (p: number) => `${AUDIT_BASE}?${new URLSearchParams({ ...(tableFilter ? { table: tableFilter } : {}), page: String(p) }).toString()}`;

  return (
    <>
      <PageHeader title="Audit ng Pananalapi" subtitle="Church-wide Finance lamang · itinatala ang mga pagbabago, hindi maaaring baguhin" />

      <div className="mt-6">
        <Panel title={`Mga Tala (${total})`}>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Uri ng record</span>
              <select name="table" defaultValue={tableFilter} className={inputCls}>
                <option value="">Lahat</option>
                {Object.entries(AUDIT_TABLE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnGhostCls}>
              I-filter
            </button>
          </form>

          {rows.length === 0 ? (
            <Empty>Walang tala.</Empty>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((r) => {
                const changes = r.operation === "UPDATE" ? diffAudit(r.old_values, r.new_values) : [];
                const nv = r.new_values ?? {};
                const facts = r.operation === "INSERT" ? (["full_name", "status", "amount", "total_amount", "valid_until"] as const).filter((k) => nv[k] !== undefined && nv[k] !== null) : [];
                const who = r.changed_by ? (profileName.get(r.changed_by) ?? `Profile ${r.changed_by.slice(0, 8)}`) : "Sistema (walang naka-login)";
                const target = typeof nv.member_id === "string" ? memberName.get(nv.member_id) : typeof nv.full_name === "string" ? (nv.full_name as string) : undefined;
                return (
                  <div key={r.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-gray-800">{auditTableLabel(r.table_name)}</span>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{r.operation === "INSERT" ? "Bago" : "Binago"}</span>
                      {target && <span className="text-gray-700">{target}</span>}
                      <span className="text-gray-500">
                        {fmtWhen(r.changed_at)} · {who}
                      </span>
                    </div>
                    {r.operation === "INSERT" && (
                      <p className="text-gray-600">
                        Bagong record{facts.length > 0 ? ": " + facts.map((k) => `${k === "full_name" ? "Pangalan" : k === "status" ? "Status" : k === "valid_until" ? "Valid hanggang" : "Halaga"} ${fmtAuditValue(nv[k])}`).join(" · ") : ""}
                      </p>
                    )}
                    {changes.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-gray-600">
                        {changes.map((c) => (
                          <li key={c.field}>
                            {c.label}: {pretty(c.field, c.from)} → <span className="font-medium text-gray-800">{pretty(c.field, c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Pahina {pageNo + 1} ng {lastPage + 1}
            </span>
            <span className="flex gap-2">
              {pageNo > 0 && (
                <Link href={href(pageNo - 1)} className={btnGhostCls}>
                  ← Nauna
                </Link>
              )}
              {pageNo < lastPage && (
                <Link href={href(pageNo + 1)} className={btnGhostCls}>
                  Susunod →
                </Link>
              )}
            </span>
          </div>
        </Panel>
      </div>
    </>
  );
}
