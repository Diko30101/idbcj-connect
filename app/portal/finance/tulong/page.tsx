import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { createTulong, updateTulong, submitTulong, submitManyTulong, searchMembers } from "./actions";
import { Notice, PageHeader, Panel } from "@/components/portal/ui";
import { AmbaganForm } from "@/components/portal/ambagan-form";
import { AmbaganList } from "@/components/portal/ambagan-list";
import { GIVING_BASE, type AmbaganRecord } from "@/lib/giving";

// Tulong sa Klase Ministeryal (per-member): Local Finance (sariling local) at church-wide Finance (lahat ng local). Walang ibang nakakakita
// ng halaga ng bawat kaanib (Admin, Local Admin, Administrative, ordinaryong kaanib): ipinapatupad ng RLS.
export default async function TulongPage({
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
  const path = `${GIVING_BASE}/tulong${ctx.isChurch && selected ? `?local=${selected.id}` : ""}`;

  let records: AmbaganRecord[] = [];
  const names: Record<string, string> = {};
  if (selected) {
    const { data } = await supabase
      .from("tulong_klase_records")
      .select("id, local_id, member_id, period_month, amount, date_received, notes, status")
      .eq("local_id", selected.id)
      .order("date_received", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);
    records = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as AmbaganRecord[];
    const ids = [...new Set(records.map((r) => r.member_id))];
    if (ids.length > 0) {
      const { data: nm } = await supabase.rpc("member_display_names", { p_ids: ids });
      for (const n of (nm ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
    }
  }

  return (
    <>
      <PageHeader
        title="Tulong sa Klase Ministeryal"
        subtitle={selected ? `Pag-e-encode ng tulong ng bawat kaanib · ${selected.name}` : "Pag-e-encode ng tulong ng bawat kaanib"}
      />
      <Notice ok={ok} error={error} />

      {ctx.isChurch && locals.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {locals.map((l) => (
            <Link
              key={l.id}
              href={`${GIVING_BASE}/tulong?local=${l.id}`}
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
            <Panel title="Bagong Tulong sa Klase Ministeryal">
              <AmbaganForm
                action={createTulong}
                timezone={selected.timezone}
                path={path}
                search={searchMembers}
                periodLabel="Buwan ng tulong"
                hidden={ctx.isChurch ? { local_id: selected.id } : undefined}
              />
              <p className="mt-3 text-xs text-gray-500">
                Kaanib lang ang tinatanggap: kumpirmado ng Admin at Active (o Inactive na may aktibong pahintulot ng Pastoral Ministry). Ang kaanib ay maaaring
                mula sa ibang local.
              </p>
            </Panel>
          </div>
          <div className="mt-6">
            <Panel title="Mga Naitalang Tulong">
              <AmbaganList
                records={records}
                names={names}
                timezone={selected.timezone}
                path={path}
                mode={ctx.isChurch ? "church" : "local"}
                actions={{ update: updateTulong }}
                labels={{ monthPhrase: "Tulong para sa", empty: "Wala pang naitatalang Tulong sa Klase Ministeryal.", periodLabel: "Buwan ng tulong" }}
                actions={{ update: updateTulong, submit: submitTulong }}
                submitMany={{ action: submitManyTulong }}
                bulkItemLabel="Tulong sa Klase Ministeryal"
              />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
