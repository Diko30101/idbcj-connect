import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { sendResiboToAdmin } from "./actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls } from "@/components/portal/ui";
import { isValidMonth, nextMonth, prevMonth } from "@/lib/abuluyan";
import { currentMonthPH, fmtPeso } from "@/lib/finance";
import { PASALAMAT_TYPE_LABEL } from "@/lib/giving";
import { RESIBO_BASE } from "@/lib/resibo";
import { getResiboSummary } from "./summary";
import { PrintButton } from "./print-button";

// Buwanang Resibo: printable monthly receipt per lokal — pinagsasama sa iisang
// buwan ang Abuluyan, Ambagan, Tulong sa Aral, at Pasalamat.
// Church-wide Finance at Admin: pipili ng lokal. Local Finance: sariling lokal lang.
export default async function ResiboPage({
  searchParams,
}: {
  searchParams: Promise<{ buwan?: string; local?: string; ok?: string; error?: string }>;
}) {
  const { buwan: buwanParam, local: localParam, ok, error } = await searchParams;
  const ctx = await getAbuluyanContext();
  const wide = ctx.isChurch || ctx.isAdmin;

  type L = { id: string; name: string };
  let locals: L[];
  if (wide) {
    const { data } = await ctx.supabase.from("locals").select("id, name").order("name");
    locals = (data ?? []) as L[];
  } else {
    const local = ctx.local;
    if (!local) denyAbuluyan();
    locals = [{ id: local.id, name: local.name }];
  }
  if (locals.length === 0) denyAbuluyan();
  const selected =
    locals.find((l) => l.id === localParam) ?? locals.find((l) => l.id === ctx.local?.id) ?? locals[0];

  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const pagePath = (b: string, localId: string) => `${RESIBO_BASE}?buwan=${b}&local=${localId}`;
  const summary = await getResiboSummary(ctx.supabase, selected.id, selected.name, buwan);

  const th = "py-1 pr-4 font-medium";
  const thRight = "py-1 text-right font-medium";
  const td = "py-1.5 pr-4 text-gray-700";
  const tdRight = "py-1.5 text-right tabular-nums text-gray-700";
  const totalRow = "border-t-2 border-gray-200 font-semibold text-gray-900";

  return (
    <>
      <style>{`@media print {
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
}`}</style>

      <PageHeader
        title="Buwanang Resibo"
        subtitle={`Buwan: ${summary.monthLabel} · Lokal: ${summary.localName}`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Link href={pagePath(prevMonth(buwan), selected.id)} className={btnGhostCls}>
              ← Nakaraan
            </Link>
            <PrintButton />
            <Link href={pagePath(nextMonth(buwan), selected.id)} className={btnGhostCls}>
              Susunod →
            </Link>
          </div>
        }
      />
      <Notice ok={ok} error={error} />

      {wide && locals.length > 1 && (
        <div className="no-print mt-6 flex flex-wrap gap-2">
          {locals.map((l) => (
            <Link
              key={l.id}
              href={pagePath(buwan, l.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                l.id === selected.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Panel
          title="IDBCJ — Buwanang Resibo"
          subtitle={`Lokal: ${summary.localName} · Buwan: ${summary.monthLabel} · Nabuo: ${summary.generatedLabel}`}
        >
          {summary.submittedCount === 0 ? (
            <Empty>Walang naitalang handog para sa buwang ito sa lokal na ito.</Empty>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="font-semibold text-gray-900">Abuluyan <span className="text-xs font-normal text-gray-500">· lingguhang pinagsamang handog</span></h3>
                {summary.abuluyan.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">(walang naipadalang Abuluyan)</p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className={th}>Linggo</th>
                        <th className={thRight}>Halaga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.abuluyan.map((w) => (
                        <tr key={w.serviceDate} className="border-t border-gray-100">
                          <td className={td}>{w.serviceDate}</td>
                          <td className={tdRight}>{fmtPeso(w.amount)}</td>
                        </tr>
                      ))}
                      <tr className={totalRow}>
                        <td className="py-1.5 pr-4">Kabuuan ng Abuluyan</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtPeso(summary.abuluyanTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="font-semibold text-gray-900">Ambagan</h3>
                {summary.ambagan.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">(walang naipadalang Ambagan)</p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className={th}>Kaanib</th>
                        <th className={th}>Petsa</th>
                        <th className={thRight}>Halaga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.ambagan.map((r, i) => (
                        <tr key={`${r.memberId}-${i}`} className="border-t border-gray-100">
                          <td className={td}>{r.memberName}</td>
                          <td className={td}>{r.date}</td>
                          <td className={tdRight}>{fmtPeso(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className={totalRow}>
                        <td className="py-1.5 pr-4" colSpan={2}>Kabuuan ng Ambagan</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtPeso(summary.ambaganTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="font-semibold text-gray-900">Tulong sa Aral</h3>
                {summary.tulong.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">(walang naipadalang Tulong sa Aral)</p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className={th}>Kaanib</th>
                        <th className={th}>Petsa</th>
                        <th className={thRight}>Halaga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.tulong.map((r, i) => (
                        <tr key={`${r.memberId}-${i}`} className="border-t border-gray-100">
                          <td className={td}>{r.memberName}</td>
                          <td className={td}>{r.date}</td>
                          <td className={tdRight}>{fmtPeso(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className={totalRow}>
                        <td className="py-1.5 pr-4" colSpan={2}>Kabuuan ng Tulong sa Aral</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtPeso(summary.tulongTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="font-semibold text-gray-900">Pasalamat</h3>
                {summary.pasalamat.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">(walang naipadalang Pasalamat)</p>
                ) : (
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className={th}>Kaanib</th>
                        <th className={th}>Uri</th>
                        <th className={th}>Petsa</th>
                        <th className={thRight}>Halaga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.pasalamat.map((r, i) => (
                        <tr key={`${r.memberId}-${i}`} className="border-t border-gray-100">
                          <td className={td}>
                            {r.memberName}
                            {r.notes && <span className="block text-xs text-gray-500">{r.notes}</span>}
                          </td>
                          <td className={td}>{PASALAMAT_TYPE_LABEL[r.type]}</td>
                          <td className={td}>{r.date}</td>
                          <td className={tdRight}>{fmtPeso(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className={totalRow}>
                        <td className="py-1.5 pr-4" colSpan={3}>Kabuuan ng Pasalamat</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtPeso(summary.pasalamatTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>

              <div className="flex items-center justify-between border-t-2 border-gray-300 pt-3 text-base font-bold text-gray-900">
                <span>Pangkalahatang kabuuan</span>
                <span className="tabular-nums">{fmtPeso(summary.grandTotal)}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="no-print mt-6">
        <Panel title="Ipadala sa Admin">
          <form action={sendResiboToAdmin} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="buwan" value={buwan} />
            <input type="hidden" name="local" value={selected.id} />
            <button type="submit" className={btnCls}>
              Ipadala sa Admin
            </button>
            <p className="text-xs text-gray-500">
              Ipapadala ang resibong ito bilang liham sa lahat ng aktibong Admin.
            </p>
          </form>
        </Panel>
      </div>
    </>
  );
}
