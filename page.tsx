import Link from "next/link";
import { getRosterContext } from "@/lib/portal";
import { sendAttendanceReportToAdmin } from "./actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls } from "@/components/portal/ui";
import { isValidMonth, nextMonth, prevMonth } from "@/lib/abuluyan";
import { currentMonthPH } from "@/lib/finance";
import { ATTENDANCE_REPORT_BASE } from "@/lib/attendance-report";
import { getAttendanceReportSummary, getDraftAttendanceGatherings } from "./summary";
import { PrintButton } from "./print-button";

// Attendance Report: buwanang ulat ng pagdalo per lokal — talaan ng bawat
// pagkakatipon sa buwan (mga kaanib, bisita, ibang lokal) na ipinapadala
// bilang liham sa Administrative Ministry. Admin: pipili ng lokal.
// Local Admin Ministry: sariling lokal lang.
export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ buwan?: string; local?: string; ok?: string; error?: string }>;
}) {
  const { buwan: buwanParam, local: localParam, ok, error } = await searchParams;
  const { supabase, locals, isAdmin } = await getRosterContext();

  type L = { id: string; name: string };
  const allLocals: L[] = isAdmin
    ? (((await supabase.from("locals").select("id, name").order("name")).data ?? []) as L[])
    : (locals as L[]);
  if (allLocals.length === 0) {
    return (
      <>
        <PageHeader title="Attendance Report" subtitle="Buwanang ulat ng pagdalo" />
        <Empty>Wala kang sakop na lokal.</Empty>
      </>
    );
  }
  const selected = allLocals.find((l) => l.id === localParam) ?? allLocals[0];

  const buwan = buwanParam && isValidMonth(buwanParam) ? buwanParam : currentMonthPH();
  const pagePath = (b: string, localId: string) => `${ATTENDANCE_REPORT_BASE}?buwan=${b}&local=${localId}`;
  const summary = await getAttendanceReportSummary(supabase, selected.id, selected.name, buwan);
  // Admin lang ang nakakakita ng mga naka-draft (hindi pa naipapasa).
  const drafts = isAdmin
    ? await getDraftAttendanceGatherings(supabase, selected.id, buwan)
    : [];

  const th = "border border-gray-400 bg-emerald-700 px-2 py-1.5 text-left font-semibold text-white";
  const thRight = "border border-gray-400 bg-emerald-700 px-2 py-1.5 text-right font-semibold text-white";
  const td = "border border-gray-400 px-2 py-1.5 text-gray-800";
  const tdRight = "border border-gray-400 px-2 py-1.5 text-right tabular-nums text-gray-800";
  const totalTd = "border border-gray-400 bg-emerald-100 px-2 py-1.5 font-bold text-emerald-950 [print-color-adjust:exact]";
  const totalTdRight = "border border-gray-400 bg-emerald-100 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-950 [print-color-adjust:exact]";

  return (
    <>
      <style>{`@media print {
  header, nav, .no-print { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  body { background: #fff !important; }
}`}</style>

      <PageHeader
        title="Attendance Report"
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

      {isAdmin && allLocals.length > 1 && (
        <div className="no-print mt-6 flex flex-wrap gap-2">
          {allLocals.map((l) => (
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
          title="IDBCJ — Ulat ng Pagdalo"
          subtitle={`Lokal: ${summary.localName} · Buwan: ${summary.monthLabel}`}
        >
          {summary.gatheringCount === 0 ? (
            <Empty>Walang naisumiteng pagdalo para sa buwang ito sa lokal na ito.</Empty>
          ) : (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>Petsa</th>
                  <th className={th}>Uri ng Pagkakatipon</th>
                  <th className={thRight}>Mga Kaanib</th>
                  <th className={thRight}>Bisita</th>
                  <th className={thRight}>Ibang Lokal</th>
                  <th className={thRight}>Kabuuan</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={`${r.serviceDate}|${r.serviceType}`}>
                    <td className={td}>{r.serviceDate}</td>
                    <td className={td}>{r.typeLabel}</td>
                    <td className={tdRight}>{r.members}</td>
                    <td className={tdRight}>{r.visitors}</td>
                    <td className={tdRight}>{r.otherLocal}</td>
                    <td className={tdRight}>{r.total}</td>
                  </tr>
                ))}
                <tr>
                  <td className={totalTd} colSpan={2}>Kabuuan sa buwan</td>
                  <td className={totalTdRight}>{summary.membersTotal}</td>
                  <td className={totalTdRight}>{summary.visitorsTotal}</td>
                  <td className={totalTdRight}>{summary.otherLocalTotal}</td>
                  <td className={totalTdRight}>{summary.grandTotal}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {isAdmin && (
        <div className="no-print mt-6">
          <Panel
            title="Nasa draft pa — hindi pa naipapasa"
            subtitle={`Lokal: ${summary.localName} · Buwan: ${summary.monthLabel} · Admin lang ang nakakakita nito`}
          >
            {drafts.length === 0 ? (
              <Empty>Walang naka-draft na pagdalo para sa buwang ito sa lokal na ito.</Empty>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200 text-sm">
                {drafts.map((d) => (
                  <li key={`${d.serviceDate}|${d.serviceType}`} className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-800">
                      {d.serviceDate} · {d.typeLabel}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      Draft · {d.attendeeCount} dumalo
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <div className="no-print mt-6">
        <Panel title="Submit">
          <form action={sendAttendanceReportToAdmin} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="buwan" value={buwan} />
            <input type="hidden" name="local" value={selected.id} />
            <button type="submit" className={btnCls}>
              Ipadala sa Administrative Ministry
            </button>
            <p className="text-xs text-gray-500">
              Isusumite ang ulat na ito bilang liham sa Administrative Ministry.
            </p>
          </form>
        </Panel>
      </div>
    </>
  );
}
