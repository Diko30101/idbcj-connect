import { getPagsambaContext, fmtDate } from "@/lib/portal";
import { monthLabel, monthToDate, currentMonthPH } from "@/lib/finance";
import { sundaysOfMonth, type PagsambaTopic } from "@/lib/pagsamba";
import { uploadPagsambaTexto, updatePagsambaTopic, createPagsambaTopic } from "./actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";

// Paksa sa Pagsamba (regular na Linggong worship service): church-wide, iisa para sa buong Iglesia
// bawat Linggo ng buwan, Admin lang ang nag-e-encode. Hiwalay ito sa Schedule ng Sugo (tingnan ang
// /portal/sugo) -- magkaiba ang saklaw (church-wide dito, per-local doon) at ang nagpapasya sa
// bawat isa (Admin lang dito, Leader ng Pastoral Ministry o Admin doon).
export default async function PagsambaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; buwan?: string }>;
}) {
  const { ok, error, buwan: buwanParam } = await searchParams;
  const ctx = await getPagsambaContext();
  const { supabase } = ctx;

  const buwan = /^\d{4}-(0[1-9]|1[0-2])$/.test(buwanParam ?? "") ? buwanParam! : currentMonthPH();
  const periodMonth = monthToDate(buwan);
  const dates = sundaysOfMonth(buwan);

  const { data: topicRows } = await supabase
    .from("pagsamba_topics")
    .select("id, period_month, week_number, paksa, source_docx_path")
    .eq("period_month", periodMonth);

  const topicByWeek = new Map<number, PagsambaTopic>();
  for (const t of (topicRows ?? []) as PagsambaTopic[]) topicByWeek.set(t.week_number, t);

  return (
    <>
      <PageHeader title="Paksa sa Pagsamba" subtitle={`Paksa ng Buwan, iisa para sa buong Iglesia · ${monthLabel(buwan)}`} />
      <Notice ok={ok} error={error} />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Buwan">
          <input type="month" name="buwan" defaultValue={buwan} className={inputCls} />
        </Field>
        <button className={btnGhostCls}>Tingnan</button>
      </form>

      <Panel title="Paksa ng Buwan (iisa para sa buong Iglesia)">
        {ctx.canWritePaksa && (
          <form
            action={uploadPagsambaTexto}
            encType="multipart/form-data"
            className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-emerald-50/50 p-3"
          >
            <input type="hidden" name="period_month" value={buwan} />
            <input type="hidden" name="buwan" value={buwan} />
            <Field label="I-upload ang Texto ng Buwan (.docx)">
              <input type="file" name="docx" accept=".docx" required className={inputCls} />
            </Field>
            <button className={btnCls}>I-upload at Kunin ang Paksa</button>
            <p className="w-full text-xs text-gray-500">
              Awtomatikong babasahin ang file at mapupunan ang Paksa ng bawat Linggo. Suriin pa rin sa ibaba kung tama, at ayusin kung kailangan.
            </p>
          </form>
        )}
        {dates.length === 0 ? (
          <Empty>Di-wastong buwan.</Empty>
        ) : (
          <ol className="space-y-3">
            {dates.map((date, i) => {
              const week = i + 1;
              const topic = topicByWeek.get(week);
              return (
                <li key={week} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-medium text-gray-400">
                    Linggo {week} · {fmtDate(date)}
                  </p>
                  {ctx.canWritePaksa ? (
                    topic ? (
                      <form action={updatePagsambaTopic} className="mt-1 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={topic.id} />
                        <input type="hidden" name="buwan" value={buwan} />
                        <input name="paksa" defaultValue={topic.paksa} className={`${inputCls} flex-1`} />
                        <button className={btnGhostCls}>I-save</button>
                      </form>
                    ) : (
                      <form action={createPagsambaTopic} className="mt-1 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="period_month" value={buwan} />
                        <input type="hidden" name="week_number" value={week} />
                        <input type="hidden" name="buwan" value={buwan} />
                        <input name="paksa" placeholder="Ilagay ang Paksa" className={`${inputCls} flex-1`} />
                        <button className={btnGhostCls}>Idagdag</button>
                      </form>
                    )
                  ) : (
                    <p className="mt-1 text-sm text-gray-700">{topic?.paksa ?? "Wala pang Paksa."}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </>
  );
}
