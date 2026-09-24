import Link from "next/link";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { sendAbuluyanMonthlySummary } from "../actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls } from "@/components/portal/ui";
import {
  ABULUYAN_BUWANAN_PATH,
  isValidMonth,
  nextMonth,
  prevMonth,
} from "@/lib/abuluyan";
import { currentMonthPH, fmtPeso, monthLabel } from "@/lib/finance";
import { getMonthlySummary, type AbuluyanSummaryScope } from "./summary";
import { PrintButton } from "./print-button";

// Buwanang Ulat ng Abuluyan: printable monthly summary receipt.
// Church-wide Finance at Admin: lahat ng local. Local Finance: sariling local lang.
export default async function AbuluyanBuwananPage({
  searchParams,
}: {
  searchParams: Promise<{ buwan?: string; ok?: string; error?: string }>;
}) {
  const { buwan: buwanParam, ok, error } = await searchParams;
  const ctx = await getAbuluyanContext();
  const wide = ctx.isChurch || ctx.isAdmin;

  let scope: AbuluyanSummaryScope;
  let scopeLabel: string;
  if (wide) {
    scope = { wide: true };
    scopeLabel = "Lahat ng local";
  } else {
    const local = ctx.local;
    if (!local) denyAbuluyan();
    scope = { wide: false, localId: local.id, localName: local.name };
    scopeLabel = local.name;
  }

  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const { summary, submittedCount } = await getMonthlySummary(ctx.supabase, scope, buwan);
  const withRecords = summary.locals.filter((l) => l.weeks.length > 0);

  return (
    <>
      <style>{`@media print {
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
}`}</style>

      <PageHeader
        title="Buwanang Ulat ng Abuluyan"
        subtitle={`Buwan: ${monthLabel(buwan)} · ${scopeLabel}`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Link href={`${ABULUYAN_BUWANAN_PATH}?buwan=${prevMonth(buwan)}`} className={btnGhostCls}>
              ← Nakaraan
            </Link>
            <PrintButton />
            <Link href={`${ABULUYAN_BUWANAN_PATH}?buwan=${nextMonth(buwan)}`} className={btnGhostCls}>
              Susunod →
            </Link>
            <Link href={`/portal/finance/resibo?buwan=${buwan}`} className={btnGhostCls}>
              Buwanang Resibo
            </Link>
          </div>
        }
      />
      <Notice ok={ok} error={error} />

      <Panel title="IDBCJ — Buwanang Ulat ng Abuluyan" subtitle={`Buwan: ${summary.monthLabel} · Nabuo: ${summary.generatedLabel}`}>
        {submittedCount === 0 ? (
          <Empty>Walang naipadalang Abuluyan para sa buwang ito.</Empty>
        ) : (
          <div className="space-y-6">
            {withRecords.map((l) => (
              <div key={l.localId}>
                <h3 className="font-semibold text-gray-900">
                  {l.localName}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    · {l.weeks.length} {l.weeks.length === 1 ? "linggo" : "mga linggo"}
                  </span>
                </h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-1 pr-4 font-medium">Linggo</th>
                      <th className="py-1 text-right font-medium">Halaga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.weeks.map((w) => (
                      <tr key={w.serviceDate} className="border-t border-gray-100">
                        <td className="py-1.5 pr-4 text-gray-700">{w.serviceDate}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">{fmtPeso(w.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                      <td className="py-1.5 pr-4">Kabuuan ng local</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtPeso(l.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            <div className="flex items-center justify-between border-t-2 border-gray-300 pt-3 text-base font-bold text-gray-900">
              <span>Pangkalahatang kabuuan</span>
              <span className="tabular-nums">{fmtPeso(summary.grandTotal)}</span>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {summary.missingLocalNames.length > 0 ? (
                <p>
                  <span className="font-semibold">Hindi pa naipapadala:</span>{" "}
                  {summary.missingLocalNames.join(", ")}
                </p>
              ) : (
                <p>Lahat ng local ay may naipadalang Abuluyan ngayong buwan.</p>
              )}
            </div>
          </div>
        )}
      </Panel>

      <div className="no-print mt-6">
        <Panel title="Submit">
          <form action={sendAbuluyanMonthlySummary} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="buwan" value={buwan} />
            <button type="submit" className={btnCls}>
              Submit
            </button>
            <p className="text-xs text-gray-500">
              Isusumite ang ulat na ito bilang liham sa Finance Ministry.
            </p>
          </form>
        </Panel>
      </div>
    </>
  );
}
