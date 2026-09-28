import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { decideAmbagan, saveAmbaganGrid, submitAmbagan, submitManyAmbagan, updateAmbagan } from "./actions";
import { Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AmbaganGridForm, type GridExisting } from "@/components/portal/ambagan-grid-form";
import { AmbaganList } from "@/components/portal/ambagan-list";
import { GivingGrid } from "@/components/portal/giving-grid";
import { GIVING_BASE, type AmbaganRecord } from "@/lib/giving";
import { isValidMonth, nextMonth, prevMonth } from "@/lib/abuluyan";
import { currentMonthPH, monthLabel, sundaysOfMonth } from "@/lib/finance";

// Ambagan (per-member): Local Finance (sariling local) at church-wide Finance (lahat ng local). Walang ibang nakakakita
// ng halaga ng bawat kaanib (Admin, Local Admin, Administrative, ordinaryong kaanib): ipinapatupad ng RLS.
// Ang pag-encode ay grid tulad ng papel na form: Pangalan (laman na agad mula sa roster) × Linggo I–V
// (blangkong column ng halaga), awtomatiko ang Total. Pipiliin lang ang Buwan/Taon (at Local kung
// Church-wide Finance) sa taas.
export default async function AmbaganPage({
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
  const path = `${GIVING_BASE}/ambagan?buwan=${buwan}${ctx.isChurch && selected ? `&local=${selected.id}` : ""}`;
  const pagePath = (b: string, localId?: string) =>
    `${GIVING_BASE}/ambagan?buwan=${b}${ctx.isChurch && localId ? `&local=${localId}` : ""}`;

  let records: AmbaganRecord[] = [];
  const names: Record<string, string> = {};
  let gridMembers: { id: string; full_name: string }[] = [];
  let gridExisting: GridExisting[] = [];
  const sundays = sundaysOfMonth(buwan);

  if (selected) {
    const [{ data }, { data: eligible }, { data: existingRows }] = await Promise.all([
      supabase
        .from("ambagan_records")
        .select("id, local_id, member_id, period_month, amount, date_received, notes, status, decision_notes")
        .eq("local_id", selected.id)
        .order("date_received", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.rpc("list_giving_eligible_members", { p_local_id: selected.id }),
      // Ligtas ang blangkong .in() (walang Linggo sa buwan): wala lang ibabalik, hindi mag-eerror.
      supabase
        .from("ambagan_records")
        .select("member_id, date_received, amount, status")
        .eq("local_id", selected.id)
        .neq("status", "void")
        .in("date_received", sundays),
    ]);
    records = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as AmbaganRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
    gridMembers = ((eligible ?? []) as { id: string; full_name: string }[])
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "fil"));
    gridExisting = ((existingRows ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as GridExisting[];
  }

  return (
    <>
      <PageHeader
        title="Ambagan"
        subtitle={
          selected ? `Pag-e-encode ng ambag ng bawat kaanib · ${selected.name} · ${monthLabel(buwan)}` : "Pag-e-encode ng ambag ng bawat kaanib"
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={pagePath(prevMonth(buwan), selected?.id)} className={btnGhostCls}>
              ← Nakaraang buwan
            </Link>
            <Link href={pagePath(nextMonth(buwan), selected?.id)} className={btnGhostCls}>
              Susunod na buwan →
            </Link>
          </div>
        }
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
            <Panel title="Pag-encode ng Ambagan" subtitle={monthLabel(buwan)}>
              <AmbaganGridForm
                action={saveAmbaganGrid}
                path={path}
                periodMonth={buwan}
                members={gridMembers}
                sundays={sundays}
                existing={gridExisting}
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
              <p className="mt-3 text-xs text-gray-500">
                Kaanib lang ang lumalabas dito: kumpirmado ng Admin at Active (o Inactive na may aktibong pahintulot ng Pastoral Ministry).
              </p>
            </Panel>
          </div>
          <div className="mt-6">
            <Panel title="Mga Naitalang Ambagan">
              <GivingGrid records={records} names={names} mode="weekly" />
              <AmbaganList
                records={records}
                names={names}
                timezone={selected.timezone}
                path={path}
                mode={ctx.isChurch ? "church" : "local"}
                actions={{ update: updateAmbagan, submit: submitAmbagan, decide: decideAmbagan }}
                submitMany={{ action: submitManyAmbagan }}
              />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
