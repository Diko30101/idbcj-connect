import { requireTulongFinancialAccess } from "@/lib/portal";
import { fmtPeso } from "@/lib/finance";
import { Empty, Notice, PageHeader, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import {
  forwardLoanRequestToAdmin,
  addTulongPayment,
} from "@/app/portal/finance/tulong-financial/actions";

type StatusFilter = "lahat" | "bukas" | "bahagya" | "bayad";

function loanStatus(amount: number, paid: number): { key: Exclude<StatusFilter, "lahat">; label: string } {
  if (paid >= amount - 0.005) return { key: "bayad", label: "Bayad na" };
  if (paid > 0) return { key: "bahagya", label: "Bahagyang nabayaran" };
  return { key: "bukas", label: "Hindi pa nababayaran" };
}

const STATUS_BADGE: Record<string, string> = {
  bayad: "bg-emerald-100 text-emerald-800",
  bahagya: "bg-amber-100 text-amber-800",
  bukas: "bg-red-100 text-red-700",
};

const REQUEST_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

const REQUEST_LABEL: Record<string, string> = {
  pending: "Naghihintay — ipadala sa admin",
  sent: "Nasa admin — naghihintay ng apruba",
  approved: "Aprubado",
  rejected: "Tinanggihan",
};

export type TulongSearchParams = { ok?: string; error?: string; status?: string };

// Iisang workspace ng mga transaction (hiram at bayad) na ginagamit ng main portal page.
// - returnTo: saan babalik ang mga form pagkatapos ng action (hidden "return_to" field).
// Ang pamamahala ng mga login ng pinahiram ay nasa bagong Tulong Financial portal
// (app/tulong-financial/finance/borrower-logins.tsx), hindi dito.
export async function TulongFinanceWorkspace({
  returnTo,
  sp,
}: {
  returnTo: string;
  sp: TulongSearchParams;
}) {
  const { supabase } = await requireTulongFinancialAccess();

  const statusFilter: StatusFilter =
    sp.status === "bukas" || sp.status === "bahagya" || sp.status === "bayad" ? sp.status : "lahat";

  const [
    { data: loanRows },
    { data: paymentRows },
    { data: memberRows },
    { data: localRows },
    { data: requestRows },
  ] = await Promise.all([
    supabase
      .from("tulong_financial_loans")
      .select("id, member_id, local_id, amount, date_borrowed, target_return_date, notes")
      .order("date_borrowed", { ascending: false })
      .limit(2000),
    supabase.from("tulong_financial_payments").select("loan_id, amount, date_paid").limit(10000),
    supabase.from("members").select("id, full_name, local_id").eq("status", "Active").order("full_name").limit(2000),
    supabase.from("locals").select("id, name").order("name"),
    supabase
      .from("tulong_loan_requests")
      .select("id, member_id, amount, target_return_date, notes, status, requested_at, sent_at, decided_at")
      .order("requested_at", { ascending: false })
      .limit(2000),
  ]);

  const memberById = new Map(((memberRows ?? []) as any[]).map((m) => [m.id, m]));
  const localNameById = new Map(((localRows ?? []) as any[]).map((l) => [l.id, l.name]));
  const paidByLoan = new Map<string, number>();
  for (const p of (paymentRows ?? []) as any[]) {
    paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) ?? 0) + Number(p.amount));
  }

  const loans = ((loanRows ?? []) as any[]).map((l) => {
    const amount = Number(l.amount);
    const paid = Math.round((paidByLoan.get(l.id) ?? 0) * 100) / 100;
    const balance = Math.round((amount - paid) * 100) / 100;
    const member = memberById.get(l.member_id);
    return {
      ...l,
      amount,
      paid,
      balance,
      memberName: member?.full_name ?? "—",
      localName: localNameById.get(l.local_id ?? member?.local_id) ?? "—",
      status: loanStatus(amount, paid),
    };
  });

  const visible = loans.filter((l) => statusFilter === "lahat" || l.status.key === statusFilter);
  const openLoans = loans.filter((l) => l.status.key !== "bayad");

  const requests = ((requestRows ?? []) as any[]).map((r) => ({
    ...r,
    amount: Number(r.amount),
    memberName: memberById.get(r.member_id)?.full_name ?? "—",
    localName: localNameById.get(memberById.get(r.member_id)?.local_id) ?? "—",
  }));

  const totalBorrowed = loans.reduce((s, l) => s + l.amount, 0);
  const totalPaid = loans.reduce((s, l) => s + l.paid, 0);
  const totalBalance = Math.round(loans.reduce((s, l) => s + Math.max(l.balance, 0), 0) * 100) / 100;

  return (
    <>
      <PageHeader
        title="Tulong Financial"
        subtitle="Talaan ng mga nahiram na salapi ng mga active members — Finance Ministry at Admin lang ang nakakakita."
      />
      <Notice ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel title="Kabuuang hiniram">
          <p className="text-2xl font-bold text-emerald-900">{fmtPeso(totalBorrowed)}</p>
        </Panel>
        <Panel title="Kabuuang nabayaran">
          <p className="text-2xl font-bold text-emerald-900">{fmtPeso(totalPaid)}</p>
        </Panel>
        <Panel title={`Natitirang balanse (${openLoans.length} bukas)`}>
          <p className="text-2xl font-bold text-red-700">{fmtPeso(totalBalance)}</p>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga kahilingan ng hiram">
          <p className="mb-4 text-sm text-gray-500">
            Ang kaanib na may username ay humihiling ng hiram sa idbcj.org/tulong-financial.
            Suriin at ipadala sa admin — ang admin ang mag-aapruba sa loob ng Inbox letter.
          </p>
          {requests.length === 0 ? (
            <Empty>Wala pang kahilingan ng hiram.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Kaanib</th>
                    <th className="py-2 pr-3">Lokal</th>
                    <th className="py-2 pr-3 text-right">Halaga</th>
                    <th className="py-2 pr-3">Target balik</th>
                    <th className="py-2 pr-3">Hiniling noong</th>
                    <th className="py-2 pr-3">Katayuan</th>
                    <th className="py-2 pr-3">Aksyon</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">
                        {r.memberName}
                        {r.notes && <div className="text-xs font-normal text-gray-500">{r.notes}</div>}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{r.localName}</td>
                      <td className="py-2 pr-3 text-right text-gray-700">{fmtPeso(r.amount)}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.target_return_date ?? "—"}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {new Date(r.requested_at).toLocaleDateString("en-PH")}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${REQUEST_BADGE[r.status] ?? REQUEST_BADGE.pending}`}>
                          {REQUEST_LABEL[r.status] ?? r.status}
                        </span>
                        {(r.status === "approved" || r.status === "rejected") && r.decided_at && (
                          <div className="text-xs text-gray-400">
                            {new Date(r.decided_at).toLocaleDateString("en-PH")}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.status === "pending" ? (
                          <form action={forwardLoanRequestToAdmin}>
                            <input type="hidden" name="return_to" value={returnTo} />
                            <input type="hidden" name="request_id" value={r.id} />
                            <button className={btnGhostCls}>Ipadala sa admin</button>
                          </form>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Magtala ng bayad">
          {openLoans.length === 0 ? (
            <Empty>Wala pang bukas na hiram.</Empty>
          ) : (
            <form action={addTulongPayment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Hiram</span>
                <select name="loan_id" required className={inputCls} defaultValue="">
                  <option value="" disabled>
                    Pumili ng hiram
                  </option>
                  {openLoans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.memberName} · balanse {fmtPeso(l.balance)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Halaga ng bayad (₱)</span>
                <input name="amount" type="number" min="1" step="0.01" required className={inputCls} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Petsa ng bayad</span>
                <input name="date_paid" type="date" required className={inputCls} />
              </label>
              <div className="flex items-end gap-3">
                <input name="notes" type="text" maxLength={300} placeholder="Tala (opsiyonal)" className={inputCls} />
                <button className={btnGhostCls}>Itala ang bayad</button>
              </div>
            </form>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel
          title={`Mga hiram${statusFilter === "lahat" ? "" : ` · ${loanStatus(1, statusFilter === "bayad" ? 1 : statusFilter === "bahagya" ? 0.5 : 0).label}`}`}
        >
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Katayuan</span>
              <select name="status" defaultValue={statusFilter} className={inputCls}>
                <option value="lahat">Lahat</option>
                <option value="bukas">Hindi pa nababayaran</option>
                <option value="bahagya">Bahagyang nabayaran</option>
                <option value="bayad">Bayad na</option>
              </select>
            </label>
            <button className={btnGhostCls}>Ipakita</button>
          </form>

          {visible.length === 0 ? (
            <Empty>Wala pang naitatalang hiram.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Kaanib</th>
                    <th className="py-2 pr-3">Lokal</th>
                    <th className="py-2 pr-3 text-right">Hiniram</th>
                    <th className="py-2 pr-3 text-right">Nabayaran</th>
                    <th className="py-2 pr-3 text-right">Balanse</th>
                    <th className="py-2 pr-3">Hiniram noong</th>
                    <th className="py-2 pr-3">Target balik</th>
                    <th className="py-2 pr-3">Katayuan</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">{l.memberName}</td>
                      <td className="py-2 pr-3 text-gray-600">{l.localName}</td>
                      <td className="py-2 pr-3 text-right text-gray-700">{fmtPeso(l.amount)}</td>
                      <td className="py-2 pr-3 text-right text-gray-700">{fmtPeso(l.paid)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-900">{fmtPeso(Math.max(l.balance, 0))}</td>
                      <td className="py-2 pr-3 text-gray-600">{l.date_borrowed}</td>
                      <td className="py-2 pr-3 text-gray-600">{l.target_return_date ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[l.status.key]}`}>
                          {l.status.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
