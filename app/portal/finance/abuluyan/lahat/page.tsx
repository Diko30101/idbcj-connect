import Link from "next/link";
import { redirect } from "next/navigation";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { createAbuluyan } from "../actions";
import { Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AbuluyanForm } from "@/components/portal/abuluyan-form";
import { AbuluyanList } from "@/components/portal/abuluyan-list";
import { ABULUYAN_BASE, ABULUYAN_BUWANAN_PATH, type AbuluyanRecord } from "@/lib/abuluyan";

// Pahina ng church-wide Finance: lahat ng local. Dito nagvo-void at gumagawa ng kapalit.
export default async function AbuluyanChurchPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; local?: string }>;
}) {
  const { ok, error, local: localParam } = await searchParams;
  const ctx = await getAbuluyanContext();
  if (!ctx.isChurch) {
    if (ctx.local) redirect(ABULUYAN_BASE);
    if (ctx.isAdmin) redirect(`${ABULUYAN_BASE}/void`);
    denyAbuluyan();
  }
  const { supabase } = ctx;

  const { data: localsData } = await supabase.from("locals").select("id, name, timezone").order("name");
  const locals = (localsData ?? []) as { id: string; name: string; timezone: string }[];
  // Default: ang sarili nilang local kung mayroon (kasapi rin sila ng Local Finance), kung hindi ang una sa listahan
  const selected = locals.find((l) => l.id === localParam) ?? locals.find((l) => l.id === ctx.local?.id) ?? locals[0];

  const path = selected ? `${ABULUYAN_BASE}/lahat?local=${selected.id}` : `${ABULUYAN_BASE}/lahat`;

  const { data } = selected
    ? await supabase
        .from("abuluyan_totals")
        .select("id, local_id, service_date, total_amount, status, void_reason, replaces_id")
        .eq("local_id", selected.id)
        .order("service_date", { ascending: false })
    : { data: [] };

  const records = ((data ?? []) as any[]).map((r) => ({
    ...r,
    total_amount: r.total_amount === null ? null : Number(r.total_amount),
  })) as AbuluyanRecord[];

  return (
    <>
      <PageHeader
        title="Abuluyan — lahat ng local"
        subtitle="Church-wide Finance: i-void ang naipadala at gumawa ng kapalit"
        action={
          <Link href={ABULUYAN_BUWANAN_PATH} className={btnGhostCls}>
            Buwanang Ulat
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="mt-6 flex flex-wrap gap-2">
        {locals.map((l) => (
          <Link
            key={l.id}
            href={`${ABULUYAN_BASE}/lahat?local=${l.id}`}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              l.id === selected?.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {l.name}
          </Link>
        ))}
      </div>

      {selected && (
        <>
          <div className="mt-6">
            <Panel title={`Bagong Abuluyan · ${selected.name}`}>
              <AbuluyanForm
                action={createAbuluyan}
                timezone={selected.timezone}
                path={path}
                hidden={{ local_id: selected.id }}
              />
            </Panel>
          </div>
          <div className="mt-6">
            <Panel title={`Mga Naitalang Abuluyan · ${selected.name}`}>
              <AbuluyanList records={records} timezone={selected.timezone} path={path} mode="church" />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
