import { redirect } from "next/navigation";
import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { createAbuluyan } from "./actions";
import { Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AbuluyanForm } from "@/components/portal/abuluyan-form";
import { AbuluyanList } from "@/components/portal/abuluyan-list";
import { ABULUYAN_BASE, ABULUYAN_BUWANAN_PATH, type AbuluyanRecord } from "@/lib/abuluyan";

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

  const { data } = await supabase
    .from("abuluyan_totals")
    .select("id, local_id, service_date, total_amount, status, void_reason, replaces_id")
    .eq("local_id", local.id)
    .order("service_date", { ascending: false });

  const records = ((data ?? []) as any[]).map((r) => ({
    ...r,
    total_amount: r.total_amount === null ? null : Number(r.total_amount),
  })) as AbuluyanRecord[];

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
          <AbuluyanForm action={createAbuluyan} timezone={local.timezone} path={ABULUYAN_BASE} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga Naitalang Abuluyan">
          <AbuluyanList records={records} timezone={local.timezone} path={ABULUYAN_BASE} mode="local" />
        </Panel>
      </div>
    </>
  );
}
