import { savePasalamatGrid, searchMembers } from "./actions";
import { loadPasalamatPage, PasalamatTabs, PasalamatLocalSwitcher, monthBounds, monthDefaultDate } from "./shared";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { PasalamatSimpleGridForm } from "@/components/portal/pasalamat-simple-grid-form";
import { PasalamatList } from "@/components/portal/pasalamat-list";
import { MonthYearNav } from "@/components/portal/month-year-nav";
import { GIVING_BASE, type PasalamatRecord } from "@/lib/giving";
import { monthLabel } from "@/lib/finance";

// Monthly Pasalamat: kung sino ang nagpapasalamat sa buwang ito (Birthday, Extra, o anumang
// dahilan) -- isang hanay bawat kaanib, hanapin sa roster, may "+ Magdagdag" kung marami pa. May
// Dahilan bawat hanay -- ang mismong dahilan na itina-type ang siyang magiging uri/pamagat sa
// resibo (hindi na limitado sa preset na uri). Naka-scope sa buwan (Petsa ng bawat hanay ay dapat
// nasa loob nito). Ang Taunang at Anniversary Pasalamat lang ang may sariling hiwalay na pahina
// (pangkalahatan, nakalista na agad ang lahat ng kaanib).
const BASE = `${GIVING_BASE}/pasalamat`;
// Ang Taunang (annual) at Anniversary Pasalamat ay may sariling pahina/grid na (roster ng lahat ng
// kaanib) -- ang mga ito lang ang hindi kasama sa listahan ng Monthly Pasalamat.
const EXCLUDED_TYPES = ["annual", "anniversary"];

export default async function PasalamatMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; local?: string; buwan?: string }>;
}) {
  const { ok, error, local: localParam, buwan: buwanParam } = await searchParams;
  const { ctx, locals, selected, buwan, path, pagePath, defaultDate } = await loadPasalamatPage(
    { local: localParam, buwan: buwanParam },
    BASE,
  );
  const { min, max } = monthBounds(buwan);
  const gridDefaultDate = monthDefaultDate(buwan, defaultDate || min);

  let records: PasalamatRecord[] = [];
  const names: Record<string, string> = {};

  if (selected) {
    const { data } = await ctx.supabase
      .from("pasalamat_records")
      .select("id, local_id, member_id, type, date, amount, notes, status, decision_notes")
      .eq("local_id", selected.id)
      .not("type", "in", `(${EXCLUDED_TYPES.map((t) => `"${t}"`).join(",")})`)
      .gte("date", min)
      .lte("date", max)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);
    records = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await ctx.supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
  }

  return (
    <>
      <PageHeader
        title="Monthly Pasalamat Report"
        subtitle={
          selected
            ? `Pasalamat bawat buwan (Birthday, Extra, atbp.) · ${selected.name} · ${monthLabel(buwan)}`
            : "Pasalamat bawat buwan (Birthday, Extra, atbp.)"
        }
        action={<MonthYearNav buwan={buwan} basePath={BASE} localId={ctx.isChurch ? selected?.id : undefined} />}
      />
      <Notice ok={ok} error={error} />
      <PasalamatTabs active={BASE} buwan={buwan} localId={ctx.isChurch ? selected?.id : undefined} />

      <PasalamatLocalSwitcher locals={locals} selected={selected} pagePath={pagePath} buwan={buwan} show={ctx.isChurch} />

      {selected && (
        <>
          <div className="mt-6">
            <Panel title="Mag-encode ng Monthly Pasalamat Report" subtitle={monthLabel(buwan)}>
              <PasalamatSimpleGridForm
                action={savePasalamatGrid}
                path={path}
                minDate={min}
                maxDate={max}
                defaultDate={gridDefaultDate}
                search={searchMembers}
                mode={{ kind: "reason", placeholder: "Dahilan ng Pasalamat (Birthday, Extra, atbp.)" }}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Mga Naitalang Monthly Pasalamat Report" subtitle={monthLabel(buwan)}>
              <PasalamatList records={records} names={names} timezone={selected.timezone} path={path} mode={ctx.isChurch ? "church" : "local"} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
