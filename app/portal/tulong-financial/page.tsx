import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { fmtPeso } from "@/lib/finance";
import { Empty, Notice, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { submitLoanRequestAsPortalUser } from "@/app/tulong-financial/actions";

export const metadata = { title: "Tulong Financial — Aking Record" };
export const dynamic = "force-dynamic";

type Loan = {
  id: string;
  amount: number;
  date_borrowed: string;
  target_return_date: string | null;
  notes: string | null;
  payments: { amount: number; date_paid: string }[];
};

function statusOf(amount: number, paid: number) {
  if (paid >= amount - 0.005) return { label: "Bayad na", cls: "bg-emerald-100 text-emerald-800" };
  if (paid > 0) return { label: "Bahagyang nabayaran", cls: "bg-amber-100 text-amber-800" };
  return { label: "Hindi pa nababayaran", cls: "bg-red-100 text-red-700" };
}

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Naghihintay sa Finance Ministry", cls: "bg-amber-100 text-amber-800" },
  sent: { label: "Ipinadala na sa admin — naghihintay ng apruba", cls: "bg-blue-100 text-blue-800" },
  approved: { label: "Aprubado", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Tinanggihan", cls: "bg-red-100 text-red-700" },
};

export default async function PortalTulongFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const [{ data: portalRecord }, { data: portalRequests }] = await Promise.all([
    supabase.rpc("tulong_borrower_record_by_profile"),
    supabase.rpc("tulong_my_loan_requests_by_profile"),
  ]);

  if (!portalRecord) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-emerald-900">Tulong Financial</h1>
        <p className="mt-2 text-sm text-gray-500">
          Wala ka pang aprubadong Tulong Financial record. Makipag-ugnayan sa Finance Ministry.
        </p>
      </main>
    );
  }

  const record = portalRecord as { member_name: string; loans: Loan[] };
  const requests = ((portalRequests ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) }));

  const loans = (record.loans ?? []).map((l) => {
    const amount = Number(l.amount);
    const paid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
    return { ...l, amount, paid, balance: Math.round((amount - paid) * 100) / 100 };
  });
  const totalBorrowed = loans.reduce((s, l) => s + l.amount, 0);
  const totalPaid = loans.reduce((s, l) => s + l.paid, 0);
  const totalBalance = Math.round(loans.reduce((s, l) => s + Math.max(l.balance, 0), 0) * 100) / 100;
  const hasPendingRequest = requests.some((r) => r.status === "pending" || r.status === "sent");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Notice ok={ok} error={error} />
      <div>
        <h1 className="text-2xl font-bold text-emerald-900">Aking Record — Tulong Financial</h1>
        <p className="mt-1 text-sm text-gray-500">
          {record.member_name} · Ito ang talaan ng iyong mga hiram at bayad.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Panel title="Kabuuang hiniram">
          <p className="text-2xl font-bold text-emerald-900">{fmtPeso(totalBorrowed)}</p>
        </Panel>
        <Panel title="Kabuuang nabayaran">
          <p className="text-2xl font-bold text-emerald-900">{fmtPeso(totalPaid)}</p>
        </Panel>
        <Panel title="Natitirang balanse">
          <p className="text-2xl font-bold text-red-700">{fmtPeso(totalBalance)}</p>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Humiling ng hiram">
          {hasPendingRequest ? (
            <p className="text-sm text-gray-500">
              May naghihintay ka pang kahilingan sa ibaba. Hintayin muna ang desisyon bago humiling ulit.
            </p>
          ) : (
            <form action={submitLoanRequestAsPortalUser} className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Halagang hihiramin (₱)</span>
                <input name="amount" type="number" min="1" step="0.01" required className={inputCls} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Target na petsa ng pagbalik</span>
                <input name="target_return_date" type="date" className={inputCls} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Tala (opsyonal)</span>
                <input name="notes" type="text" maxLength={200} className={inputCls} placeholder="Dahilan ng paghiram" />
              </label>
              <div className="sm:col-span-2">
                <button className={btnGhostCls}>Ipadala ang kahilingan</button>
                <p className="mt-2 text-xs text-gray-400">
                  Ang kahilingan ay dadaan sa Finance Ministry at kailangan ng apruba ng admin.
                </p>
              </div>
            </form>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga kahilingan ko">
          {requests.length === 0 ? (
            <Empty>Wala ka pang kahilingan ng hiram.</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((r) => {
                const st = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900">{fmtPeso(r.amount)}</span>
                      {r.target_return_date && (
                        <span className="text-gray-500"> · target balik {r.target_return_date}</span>
                      )}
                      {r.notes && <span className="text-gray-500"> · {r.notes}</span>}
                      <div className="text-xs text-gray-400">
                        Hiniling noong {new Date(r.requested_at).toLocaleString("en-PH")}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga hiram ko">
          {loans.length === 0 ? (
            <Empty>Wala ka pang hiram.</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {loans.map((l) => {
                const st = statusOf(l.amount, l.paid);
                return (
                  <li key={l.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900">{fmtPeso(l.amount)}</span>
                        <span className="text-gray-500"> · hiniram noong {l.date_borrowed}</span>
                        {l.target_return_date && (
                          <span className="text-gray-500"> · target balik {l.target_return_date}</span>
                        )}
                        {l.notes && <div className="text-gray-500">{l.notes}</div>}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Nabayaran: {fmtPeso(l.paid)} · Balanse: {fmtPeso(Math.max(l.balance, 0))}
                    </div>
                    {l.payments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {l.payments.map((p, i) => (
                          <li key={i} className="text-xs text-gray-500">
                            Bayad {fmtPeso(Number(p.amount))} noong {p.date_paid}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}
