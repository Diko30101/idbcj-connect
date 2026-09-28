import { redirect } from "next/navigation";
import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan, PASTORAL_MINISTRY_NAME } from "@/lib/portal";
import { saveAbuluyanGrid } from "./actions";
import { Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AbuluyanGridForm, type AbuluyanGridExisting } from "@/components/portal/abuluyan-grid-form";
import { AbuluyanList } from "@/components/portal/abuluyan-list";
import { ABULUYAN_BASE, ABULUYAN_BUWANAN_PATH, isValidMonth, nextMonth, prevMonth, type AbuluyanRecord, type SugoChoice } from "@/lib/abuluyan";
import { currentMonthPH, monthLabel, sundaysOfMonth } from "@/lib/finance";

// Pahina ng Local Finance (sariling local). Ang church-wide Finance at Admin ay sa lahat-pahina.
// Ang pag-encode ay grid tulad ng papel na form (public/Pagsamba.pdf): isang hanay bawat Linggo ng
// buwan, blangkong Halaga (at Sugo). Awtomatiko ang Total. Pipiliin lang ang Buwan/Taon sa taas.
export default async function AbuluyanPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; buwan?: string }>;
}) {
  const { ok, error, buwan: buwanParam } = await searchParams;
  const ctx = await getAbuluyanContext();
  const { supabase, local } = ctx;

  // Ang church-wide Finance ay maaaring kasapi rin ng Local Finance sa sarili nilang local; ang pahina ng church-wide
  // (lahat ng local, kasama ang sarili nila) ang gagamitin nila, kaya laging doon muna.
  // Tinanggal na ang /void na pahina; ang Admin ay sa lahat-pahina na rin pumupunta.
  if (ctx.isChurch) redirect(`${ABULUYAN_BASE}/lahat`);
  if (!local) {
    if (ctx.isAdmin) redirect(`${ABULUYAN_BASE}/lahat`);
    denyAbuluyan();
  }

  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const pagePath = (b: string) => `${ABULUYAN_BASE}?buwan=${b}`;
  const sundays = sundaysOfMonth(buwan);

  const [{ data }, { data: mmRows }, { data: gridRows }] = await Promise.all([
    supabase
      .from("abuluyan_totals")
      .select(
        "id, local_id, service_date, total_amount, status, void_reason, replaces_id, decision_notes, sugo_id, sugo:profiles!abuluyan_totals_sugo_id_fkey(full_name)",
      )
      .eq("local_id", local.id)
      .order("service_date", { ascending: false }),
    supabase.from("ministry_members").select("profile_id, ministries(name), profiles(id, full_name, status)").eq("local_id", local.id),
    supabase
      .from("abuluyan_totals")
      .select("service_date, total_amount, sugo_id, status")
      .eq("local_id", local.id)
      .neq("status", "void")
      .in("service_date", sundays),
  ]);

  const records = ((data ?? []) as any[]).map((r) => ({
    ...r,
    total_amount: r.total_amount === null ? null : Number(r.total_amount),
    sugo_name: r.sugo?.full_name ?? null,
  })) as AbuluyanRecord[];

  const sugoChoices: SugoChoice[] = ((mmRows ?? []) as any[])
    .filter((m) => m.ministries?.name === PASTORAL_MINISTRY_NAME && m.profiles && m.profiles.status !== "inactive")
    .map((m) => ({ id: m.profiles.id as string, full_name: (m.profiles.full_name as string) || "(walang pangalan)" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "fil"));

  const gridExisting: AbuluyanGridExisting[] = ((gridRows ?? []) as any[]).map((r) => ({
    ...r,
    total_amount: r.total_amount === null ? null : Number(r.total_amount),
  }));

  return (
    <>
      <PageHeader
        title="Abuluyan"
        subtitle={`Pag-encode ng Abuluyan bawat Linggo ng pagsamba · ${local.name} · ${monthLabel(buwan)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={pagePath(prevMonth(buwan))} className={btnGhostCls}>
              ← Nakaraang buwan
            </Link>
            <Link href={pagePath(nextMonth(buwan))} className={btnGhostCls}>
              Susunod na buwan →
            </Link>
            <Link href={ABULUYAN_BUWANAN_PATH} className={btnGhostCls}>
              Buwanang Ulat
            </Link>
          </div>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="mt-6">
        <Panel title="Pag-encode ng Abuluyan" subtitle={monthLabel(buwan)}>
          <AbuluyanGridForm
            action={saveAbuluyanGrid}
            path={pagePath(buwan)}
            buwan={buwan}
            sundays={sundays}
            existing={gridExisting}
            sugoChoices={sugoChoices}
          />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga Naitalang Abuluyan">
          <AbuluyanList records={records} timezone={local.timezone} path={ABULUYAN_BASE} mode="local" sugoChoices={sugoChoices} />
        </Panel>
      </div>
    </>
  );
}
