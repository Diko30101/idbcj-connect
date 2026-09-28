import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { savePasalamatGrid, savePasalamatRosterGrid, searchMembers } from "./actions";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { PasalamatGridForm } from "@/components/portal/pasalamat-grid-form";
import { PasalamatRosterGridForm, type PasalamatRosterExisting } from "@/components/portal/pasalamat-roster-grid-form";
import { PasalamatList } from "@/components/portal/pasalamat-list";
import { MonthYearNav } from "@/components/portal/month-year-nav";
import { GIVING_BASE, type PasalamatRecord } from "@/lib/giving";
import { isValidMonth, monthDateRange } from "@/lib/abuluyan";
import { currentMonthPH, monthLabel, todayInTimezone } from "@/lib/finance";

// Pasalamat (per-member): Local Finance (sariling local) at church-wide Finance (lahat ng local). Walang ibang nakakakita
// ng halaga ng bawat kaanib (Admin, Local Admin, Administrative, ordinaryong kaanib): ipinapatupad ng RLS.
// Dalawang paraan ng pag-encode: (1) Taunang Pasalamat Report at Anniversary Pasalamat Form — nakalista
// na agad ang lahat ng kaanib (gaya ng grid ng Ambagan), Halaga na lang; (2) talahanayan ng blangkong
// hanay para sa Birthday/Extra/iba pang Pasalamat na hindi pangkalahatan (bawat kaanib, maaaring
// maraming beses, kaya may sariling Petsa/Uri/Tala bawat hanay).
export default async function PasalamatPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; local?: string; buwan?: string }>;
}) {
  const { ok, error, local: localParam, buwan: buwanParam } = await searchParams;
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch && !ctx.local) denyAbuluyan();
  const { supabase } = ctx;

  type L = { id: string; name: string; timezone: string };
  let locals: L[];
  if (ctx.isChurch) {
    const { data } = await supabase.from("locals").select("id, name, timezone").order("name");
    locals = (data ?? []) as L[];
  } else {
    locals = [{ id: ctx.local!.id, name: ctx.local!.name, timezone: ctx.local!.timezone }];
  }
  const selected = locals.find((l) => l.id === localParam) ?? locals.find((l) => l.id === ctx.local?.id) ?? locals[0];
  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const path = `${GIVING_BASE}/pasalamat?buwan=${buwan}${ctx.isChurch && selected ? `&local=${selected.id}` : ""}`;
  const pagePath = (b: string, localId?: string) => `${GIVING_BASE}/pasalamat?buwan=${b}${ctx.isChurch && localId ? `&local=${localId}` : ""}`;

  let records: PasalamatRecord[] = [];
  const names: Record<string, string> = {};
  let gridMembers: { id: string; full_name: string }[] = [];
  let annualExisting: PasalamatRosterExisting[] = [];
  let anniversaryExisting: PasalamatRosterExisting[] = [];
  let defaultDate = "";

  if (selected) {
    defaultDate = todayInTimezone(selected.timezone);
    const { first, firstNext } = monthDateRange(buwan);
    const [{ data }, { data: eligible }, { data: annualRows }, { data: anniversaryRows }] = await Promise.all([
      supabase
        .from("pasalamat_records")
        .select("id, local_id, member_id, type, date, amount, notes, status, decision_notes")
        .eq("local_id", selected.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.rpc("list_giving_eligible_members", { p_local_id: selected.id }),
      supabase
        .from("pasalamat_records")
        .select("member_id, amount, status")
        .eq("local_id", selected.id)
        .eq("type", "annual")
        .neq("status", "void")
        .gte("date", first)
        .lt("date", firstNext),
      supabase
        .from("pasalamat_records")
        .select("member_id, amount, status")
        .eq("local_id", selected.id)
        .eq("type", "anniversary")
        .neq("status", "void")
        .gte("date", first)
        .lt("date", firstNext),
    ]);
    records = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
    gridMembers = ((eligible ?? []) as { id: string; full_name: string }[])
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "fil"));
    annualExisting = ((annualRows ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRosterExisting[];
    anniversaryExisting = ((anniversaryRows ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRosterExisting[];
  }

  return (
    <>
      <PageHeader
        title="Monthly Pasalamat Report"
        subtitle={
          selected ? `Pag-e-encode ng pasalamat ng bawat kaanib · ${selected.name} · ${monthLabel(buwan)}` : "Pag-e-encode ng pasalamat ng bawat kaanib"
        }
        action={<MonthYearNav buwan={buwan} basePath={`${GIVING_BASE}/pasalamat`} localId={ctx.isChurch ? selected?.id : undefined} />}
      />
      <Notice ok={ok} error={error} />

      {ctx.isChurch && locals.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {locals.map((l) => (
            <Link
              key={l.id}
              href={pagePath(buwan, l.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                l.id === selected?.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="mt-6">
            <Panel title="Taunang Pasalamat Report" subtitle={monthLabel(buwan)}>
              <PasalamatRosterGridForm
                action={savePasalamatRosterGrid}
                path={path}
                pasalamatType="annual"
                defaultDate={defaultDate}
                members={gridMembers}
                existing={annualExisting}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Anniversary Pasalamat Form" subtitle={monthLabel(buwan)}>
              <PasalamatRosterGridForm
                action={savePasalamatRosterGrid}
                path={path}
                pasalamatType="anniversary"
                defaultDate={defaultDate}
                members={gridMembers}
                existing={anniversaryExisting}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Iba pang Pasalamat" subtitle="Birthday, Extra, o iba pang Pasalamat na hindi pangkalahatan">
              <PasalamatGridForm
                action={savePasalamatGrid}
                path={path}
                timezone={selected.timezone}
                search={searchMembers}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
              <p className="mt-3 text-xs text-gray-500">
                Kaanib lang ang tinatanggap: kumpirmado ng Admin at Active (o Inactive na may aktibong pahintulot ng Pastoral Ministry). Ang kaanib ay maaaring
                mula sa ibang local.
              </p>
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Mga Naitalang Pasalamat">
              <PasalamatList records={records} names={names} timezone={selected.timezone} path={path} mode={ctx.isChurch ? "church" : "local"} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
