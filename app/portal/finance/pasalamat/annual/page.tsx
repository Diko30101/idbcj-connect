import { savePasalamatRosterGrid } from "../actions";
import { loadPasalamatPage, PasalamatTabs, PasalamatLocalSwitcher, monthBounds } from "../shared";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { PasalamatRosterGridForm, type PasalamatRosterExisting } from "@/components/portal/pasalamat-roster-grid-form";
import { PasalamatList } from "@/components/portal/pasalamat-list";
import { PasalamatYearNav } from "@/components/portal/pasalamat-year-nav";
import { GIVING_BASE, type PasalamatRecord } from "@/lib/giving";

// Taunang Pasalamat: pangkalahatan, nakalista na agad ang lahat ng kaanib (gaya ng grid ng
// Ambagan), Halaga na lang ang ie-encode ng Local. Eksaktong Enero 1 bawat taon -- fixed na ang
// petsa (hindi napipili), taon na lang ang pinipili sa itaas.
const BASE = `${GIVING_BASE}/pasalamat/annual`;
const TYPE = "annual";
const FIXED_MONTH = "01" as const;
const FIXED_LABEL = "Enero 1";

export default async function PasalamatAnnualPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; local?: string; buwan?: string }>;
}) {
  const { ok, error, local: localParam, buwan: buwanParam } = await searchParams;
  const { ctx, locals, selected, buwan: rawBuwan, pagePath } = await loadPasalamatPage(
    { local: localParam, buwan: buwanParam },
    BASE,
  );
  // Laging Enero 1 ang Taunang Pasalamat -- kunin lang ang taon mula sa nalutas na buwan, itakda
  // ang buwan sa "01" anuman ang narating (hal. mula sa Monthly tab).
  const year = Number(rawBuwan.slice(0, 4));
  const buwan = `${year}-${FIXED_MONTH}`;
  const fixedDate = `${year}-${FIXED_MONTH}-01`;
  const path = pagePath(buwan, ctx.isChurch ? selected?.id : undefined);
  const { min, max } = monthBounds(buwan);

  let records: PasalamatRecord[] = [];
  const names: Record<string, string> = {};
  let gridMembers: { id: string; full_name: string }[] = [];
  let existing: PasalamatRosterExisting[] = [];

  if (selected) {
    const [{ data: recRows }, { data: eligible }, { data: existRows }] = await Promise.all([
      ctx.supabase
        .from("pasalamat_records")
        .select("id, local_id, member_id, type, date, amount, notes, status, decision_notes")
        .eq("local_id", selected.id)
        .eq("type", TYPE)
        .gte("date", min)
        .lte("date", max)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300),
      ctx.supabase.rpc("list_giving_eligible_members", { p_local_id: selected.id }),
      ctx.supabase
        .from("pasalamat_records")
        .select("member_id, amount, status")
        .eq("local_id", selected.id)
        .eq("type", TYPE)
        .neq("status", "void")
        .gte("date", min)
        .lte("date", max),
    ]);
    records = ((recRows ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await ctx.supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
    gridMembers = ((eligible ?? []) as { id: string; full_name: string }[])
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "fil"));
    existing = ((existRows ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRosterExisting[];
  }

  return (
    <>
      <PageHeader
        title="Taunang Pasalamat Report"
        subtitle={selected ? `${selected.name} · ${FIXED_LABEL}, ${year}` : undefined}
        action={<PasalamatYearNav year={year} fixedMonth={FIXED_MONTH} fixedLabel={FIXED_LABEL} basePath={BASE} localId={ctx.isChurch ? selected?.id : undefined} />}
      />
      <Notice ok={ok} error={error} />
      <PasalamatTabs active={BASE} buwan={buwan} localId={ctx.isChurch ? selected?.id : undefined} />

      <PasalamatLocalSwitcher locals={locals} selected={selected} pagePath={pagePath} buwan={buwan} show={ctx.isChurch} />

      {selected && (
        <>
          <div className="mt-6">
            <Panel title="Taunang Pasalamat Report" subtitle={`${FIXED_LABEL}, ${year}`}>
              <PasalamatRosterGridForm
                action={savePasalamatRosterGrid}
                path={path}
                pasalamatType={TYPE}
                fixedDate={fixedDate}
                members={gridMembers}
                existing={existing}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Mga Naitalang Taunang Pasalamat" subtitle={`${FIXED_LABEL}, ${year}`}>
              <PasalamatList records={records} names={names} timezone={selected.timezone} path={path} mode={ctx.isChurch ? "church" : "local"} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
