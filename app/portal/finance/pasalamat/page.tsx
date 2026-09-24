import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { createPasalamat, searchMembers } from "./actions";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { PasalamatForm } from "@/components/portal/pasalamat-form";
import { PasalamatList } from "@/components/portal/pasalamat-list";
import { GIVING_BASE, type PasalamatRecord } from "@/lib/giving";

// Pasalamat (per-member): Local Finance (sariling local) at church-wide Finance (lahat ng local). Walang ibang nakakakita
// ng halaga ng bawat kaanib (Admin, Local Admin, Administrative, ordinaryong kaanib): ipinapatupad ng RLS.
export default async function PasalamatPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; local?: string }>;
}) {
  const { ok, error, local: localParam } = await searchParams;
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
  const path = `${GIVING_BASE}/pasalamat${ctx.isChurch && selected ? `?local=${selected.id}` : ""}`;

  let records: PasalamatRecord[] = [];
  const names: Record<string, string> = {};
  if (selected) {
    const { data } = await supabase
      .from("pasalamat_records")
      .select("id, local_id, member_id, type, date, amount, notes, status")
      .eq("local_id", selected.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);
    records = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PasalamatRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
  }

  return (
    <>
      <PageHeader
        title="Pasalamat"
        subtitle={selected ? `Pag-e-encode ng pasalamat ng bawat kaanib · ${selected.name}` : "Pag-e-encode ng pasalamat ng bawat kaanib"}
      />
      <Notice ok={ok} error={error} />

      {ctx.isChurch && locals.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {locals.map((l) => (
            <Link
              key={l.id}
              href={`${GIVING_BASE}/pasalamat?local=${l.id}`}
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
            <Panel title="Bagong Pasalamat">
              <PasalamatForm
                action={createPasalamat}
                timezone={selected.timezone}
                path={path}
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
