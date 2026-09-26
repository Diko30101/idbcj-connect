import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { Empty, Notice, PageHeader, Panel } from "@/components/portal/ui";
import { inputCls, btnCls, btnGhostCls } from "@/components/portal/form-bits";
import { isValidMonth, nextMonth, prevMonth } from "@/lib/abuluyan";
import { currentMonthPH, fmtPeso } from "@/lib/finance";
import { pasalamatTypeLabel } from "@/lib/giving";
import { getKaanibResiboSummary } from "./summary";
import { PrintButton } from "../print-button";

export const KAANIB_RESIBO_BASE = "/portal/finance/resibo/kaanib";

// Buwanang Resibo ng Kaanib: per-member na resibo para sa Local Finance Ministry.
// - Abuluyan: lingguhang total ng lokal sa buwan (walang per-member na tala)
// - Ambagan / Tulong sa Aral / Pasalamat: per-member records ng napiling kaanib
export default async function KaanibResiboPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; member_id?: string; buwan?: string; ok?: string; error?: string }>;
}) {
  const { q, member_id, buwan: buwanParam, ok, error } = await searchParams;
  const ctx = await getAbuluyanContext();
  const local = ctx.local;
  // Local Finance Ministry lang ang gumagamit; sariling lokal lang.
  if (!local) denyAbuluyan();

  const th = "border border-gray-400 bg-emerald-700 px-2 py-1.5 text-left font-semibold text-white";
  const thRight = "border border-gray-400 bg-emerald-700 px-2 py-1.5 text-right font-semibold text-white";
  const td = "border border-gray-400 px-2 py-1.5 text-gray-800";
  const tdRight = "border border-gray-400 px-2 py-1.5 text-right tabular-nums text-gray-800";
  const totalTd = "border border-gray-400 bg-emerald-100 px-2 py-1.5 font-bold text-emerald-950 [print-color-adjust:exact]";
  const totalTdRight =
    "border border-gray-400 bg-emerald-100 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-950 [print-color-adjust:exact]";

  // ---- Pagpili ng kaanib ----
  type MemberHit = { id: string; full_name: string };
  let member: MemberHit | null = null;
  let hits: MemberHit[] = [];
  const term = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (member_id) {
    const { data } = await ctx.supabase
      .from("members")
      .select("id, full_name")
      .eq("id", member_id)
      .eq("local_id", local.id)
      .maybeSingle();
    member = (data as MemberHit | null) ?? null;
    if (!member) denyAbuluyan();
  } else if (term.length >= 2) {
    const { data } = await ctx.supabase
      .from("members")
      .select("id, full_name")
      .eq("local_id", local.id)
      .eq("status", "Active")
      .ilike("full_name", `%${term}%`)
      .order("full_name", { ascending: true })
      .limit(20);
    hits = ((data ?? []) as MemberHit[]);
  }

  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const summary =
    member != null ? await getKaanibResiboSummary(ctx.supabase, local.id, local.name, member.id, member.full_name, buwan) : null;
  const pagePath = (b: string) => `${KAANIB_RESIBO_BASE}?member_id=${member!.id}&buwan=${b}`;

  return (
    <>
      <style>{`@media print {
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
}`}</style>

      <PageHeader
        title="Resibo ng Kaanib"
        subtitle={`Buwanang resibo ng isang kaanib · Lokal: ${local.name}`}
        action={
          summary && (
            <div className="no-print flex flex-wrap gap-2">
              <Link href={pagePath(prevMonth(buwan))} className={btnGhostCls}>
                ← Nakaraan
              </Link>
              <PrintButton />
              <Link href={pagePath(nextMonth(buwan))} className={btnGhostCls}>
                Susunod →
              </Link>
            </div>
          )
        }
      />
      <Notice ok={ok} error={error} />

      {/* Hakbang 1: Piliin ang kaanib */}
      <Panel title="Kaanib" subtitle={member ? member.full_name : "Hanapin ang kaanib sa iyong lokal"}>
        {!member ? (
          <>
            <form method="get" action={KAANIB_RESIBO_BASE} className="no-print flex flex-wrap gap-2">
              <input
                name="q"
                defaultValue={term}
                placeholder="Maghanap ng pangalan (min. 2 titik)…"
                className={inputCls}
                autoComplete="off"
              />
              <button type="submit" className={btnCls}>
                Hanapin
              </button>
            </form>
            {term.length >= 2 && (
              <div className="mt-4">
                {hits.length === 0 ? (
                  <Empty>Walang kaanib na tumutugma sa &ldquo;{term}&rdquo; sa lokal na ito.</Empty>
                ) : (
                  <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <Link
                          href={`${KAANIB_RESIBO_BASE}?member_id=${h.id}`}
                          className="block px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
                        >
                          {h.full_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="no-print flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">
              Piniling kaanib: <strong>{member.full_name}</strong>
            </span>
            <Link href={KAANIB_RESIBO_BASE} className={btnGhostCls}>
              Palitan
            </Link>
            <form method="get" action={KAANIB_RESIBO_BASE} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="member_id" value={member.id} />
              <input type="month" name="buwan" defaultValue={buwan} className={inputCls} />
              <button type="submit" className={btnCls}>
                Buuin ang Resibo
              </button>
            </form>
          </div>
        )}
      </Panel>

      {/* Hakbang 2: Ang resibo */}
      {summary && (
        <div className="mt-6">
          <Panel
            title="IDBCJ — Buwanang Resibo ng Kaanib"
            subtitle={`Kaanib: ${summary.memberName} · Lokal: ${summary.localName} · Buwan: ${summary.monthLabel} · Nabuo: ${summary.generatedLabel}`}
          >
            {summary.submittedCount === 0 ? (
              <Empty>Walang naipadalang handog para sa kaanib na ito sa buwang ito.</Empty>
            ) : (
              <div className="space-y-8">
                <section>
                  <h3 className="font-semibold text-gray-900">
                    Abuluyan <span className="text-xs font-normal text-gray-500">· lingguhang pinagsamang handog ng lokal</span>
                  </h3>
                  {summary.abuluyan.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">(walang naipadalang Abuluyan sa lokal sa buwang ito)</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Linggo</th>
                          <th className={thRight}>Halaga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.abuluyan.map((w) => (
                          <tr key={w.serviceDate}>
                            <td className={td}>{w.serviceDate}</td>
                            <td className={tdRight}>{fmtPeso(w.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className={totalTd}>Kabuuan ng Abuluyan (lokal)</td>
                          <td className={totalTdRight}>{fmtPeso(summary.abuluyanTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">Ambagan</h3>
                  {summary.ambagan.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">(walang naipadalang Ambagan ang kaanib sa buwang ito)</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Petsa</th>
                          <th className={thRight}>Halaga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.ambagan.map((r, i) => (
                          <tr key={`${r.date}-${i}`}>
                            <td className={td}>{r.date}</td>
                            <td className={tdRight}>{fmtPeso(r.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className={totalTd}>Kabuuan ng Ambagan</td>
                          <td className={totalTdRight}>{fmtPeso(summary.ambaganTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">Tulong sa Aral</h3>
                  {summary.tulong.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">(walang naipadalang Tulong sa Aral ang kaanib sa buwang ito)</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Petsa</th>
                          <th className={thRight}>Halaga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.tulong.map((r, i) => (
                          <tr key={`${r.date}-${i}`}>
                            <td className={td}>{r.date}</td>
                            <td className={tdRight}>{fmtPeso(r.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className={totalTd}>Kabuuan ng Tulong sa Aral</td>
                          <td className={totalTdRight}>{fmtPeso(summary.tulongTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900">Pasalamat</h3>
                  {summary.pasalamat.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">(walang naipadalang Pasalamat ang kaanib sa buwang ito)</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Uri</th>
                          <th className={th}>Petsa</th>
                          <th className={thRight}>Halaga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.pasalamat.map((r, i) => (
                          <tr key={`${r.date}-${i}`}>
                            <td className={td}>
                              {pasalamatTypeLabel(r.type)}
                              {r.notes && <span className="block text-xs text-gray-500">{r.notes}</span>}
                            </td>
                            <td className={td}>{r.date}</td>
                            <td className={tdRight}>{fmtPeso(r.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className={totalTd} colSpan={2}>
                            Kabuuan ng Pasalamat
                          </td>
                          <td className={totalTdRight}>{fmtPeso(summary.pasalamatTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      <tr>
                        <td className={totalTd}>Kabuuan ng kaanib (Ambagan + Tulong sa Aral + Pasalamat)</td>
                        <td className={totalTdRight}>{fmtPeso(summary.memberTotal)}</td>
                      </tr>
                      <tr>
                        <td className={totalTd}>Pangkalahatang kabuuan (kasama ang Abuluyan ng lokal)</td>
                        <td className={totalTdRight}>{fmtPeso(summary.grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
