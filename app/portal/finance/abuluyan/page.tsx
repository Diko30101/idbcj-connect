import { redirect } from "next/navigation";
import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan, PASTORAL_MINISTRY_NAME } from "@/lib/portal";
import { createAbuluyan } from "./actions";
import { Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AbuluyanForm } from "@/components/portal/abuluyan-form";
import { AbuluyanList } from "@/components/portal/abuluyan-list";
import { ABULUYAN_BASE, ABULUYAN_BUWANAN_PATH, type AbuluyanRecord, type SugoChoice } from "@/lib/abuluyan";

// Pahina ng Local Finance (sariling local). Ang church-wide Finance at Admin ay sa lahat-pahina.
export default async function AbuluyanPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
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

  const [{ data }, { data: mmRows }] = await Promise.all([
    supabase
      .from("abuluyan_totals")
      .select(
        "id, local_id, service_date, total_amount, status, void_reason, replaces_id, decision_notes, sugo_id, sugo:profiles!abuluyan_totals_sugo_id_fkey(full_name)",
      )
      .eq("local_id", local.id)
      .order("service_date", { ascending: false }),
    supabase.from("ministry_members").select("profile_id, ministries(name), profiles(id, full_name, status)").eq("local_id", local.id),
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

  return (
    <>
      <PageHeader
        title="Abuluyan"
        subtitle={`Pag-encode ng Abuluyan bawat Linggo ng pagsamba · ${local.name}`}
        action={
          <Link href={ABULUYAN_BUWANAN_PATH} className={btnGhostCls}>
            Buwanang Ulat
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="mt-6">
        <Panel title="Bagong Abuluyan">
          <AbuluyanForm action={createAbuluyan} timezone={local.timezone} path={ABULUYAN_BASE} sugoChoices={sugoChoices} />
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
