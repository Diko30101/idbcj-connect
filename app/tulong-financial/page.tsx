import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { fmtPeso } from "@/lib/finance";
import { Empty, Notice, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import { borrowerLogout, getBorrowerSessionToken, submitLoanRequest, changeBorrowerPassword } from "./actions";
import { isTulongFinancePortalUser } from "./finance-check";

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

export default async function TulongBorrowerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const token = await getBorrowerSessionToken();
  if (!token) {
    // Ang Finance Ministry ay may sariling workspace sa bagong portal.
    if (await isTulongFinancePortalUser()) redirect("/tulong-financial/finance");
    redirect("/tulong-financial/login");
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const [{ data }, { data: myRequests }] = await Promise.all([
    supabase.rpc("tulong_borrower_record", { p_token: token }),
    supabase.rpc("tulong_my_loan_requests", { p_token: token }),
  ]);
  const record = data as { member_name: string; loans: Loan[]; password_is_temporary?: boolean } | null;
  if (!record) {
    const cs = await cookies();
    cs.delete("tulong_session");
    redirect("/tulong-financial/login?error=" + encodeURIComponent("Paso na ang session. Mag-login ulit."));
  }

  const loans = (record.loans ?? []).map((l) => {
    const amount = Number(l.amount);
    const paid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
    return { ...l, amount, paid, balance: Math.round((amount - paid) * 100) / 100 };
  });
  const totalBorrowed = loans.reduce((s, l) => s + l.amount, 0);
  const totalPaid = loans.reduce((s, l) => s + l.paid, 0);
  const totalBalance = Math.round(loans.reduce((s, l) => s + Math.max(l.balance, 0), 0) * 100) / 100;

  const requests = ((myRequests ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) }));
  const hasPendingRequest = requests.some((r) => r.status === "pending" || r.status === "sent");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <Notice ok={ok} error={error} />
      {record.password_is_temporary && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Temporary password pa ang gamit mo. Palitan ito ngayon sa &ldquo;Palitan ang password&rdquo; sa ibaba.
          </p>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Aking Record — Tulong Financial</h1>
          <p className="mt-1 text-sm text-gray-500">
            {record.member_name} · Ito ang talaan ng iyong mga hiram at bayad.
          </p>
        </div>
        <form action={borrowerLogout}>
          <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Mag-logout
          </button>
        </form>
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
            <form action={submitLoanRequest} className="grid gap-3 sm:grid-cols-2">
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
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Mga hiram">
          {loans.length === 0 ? (
            <Empty>Wala ka pang naitatalang hiram.</Empty>
          ) : (
            <div className="grid gap-4">
              {loans.map((l) => {
                const st = statusOf(l.amount, l.paid);
                return (
                  <div key={l.id} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-gray-500">
                        Hiniram noong <span className="font-semibold text-gray-800">{l.date_borrowed}</span>
                        {l.target_return_date && (
                          <>
                            {" "}· target balik <span className="font-semibold text-gray-800">{l.target_return_date}</span>
                          </>
                        )}
                      </div>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-6 text-sm">
                      <span className="text-gray-500">Hiniram: <strong className="text-gray-900">{fmtPeso(l.amount)}</strong></span>
                      <span className="text-gray-500">Nabayaran: <strong className="text-gray-900">{fmtPeso(l.paid)}</strong></span>
                      <span className="text-gray-500">Balanse: <strong className="text-red-700">{fmtPeso(Math.max(l.balance, 0))}</strong></span>
                    </div>
                    {l.notes && <p className="mt-1 text-sm text-gray-500">Tala: {l.notes}</p>}
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mga bayad</p>
                      {l.payments.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-400">Wala pang bayad.</p>
                      ) : (
                        <ul className="mt-1 divide-y divide-gray-50 text-sm">
                          {l.payments.map((p, i) => (
                            <li key={i} className="flex justify-between py-1.5">
                              <span className="text-gray-600">{p.date_paid}</span>
                              <span className="font-medium text-gray-800">{fmtPeso(Number(p.amount))}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Kung may tanong sa record na ito, makipag-ugnayan sa Finance Ministry.
      </p>

      <div className="mt-6">
        <Panel title="Palitan ang password">
          <form action={changeBorrowerPassword} className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Kasalukuyang password</span>
              <input name="current_password" type="password" required className={inputCls} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Bagong password (min. 6)</span>
              <input name="new_password" type="password" required minLength={6} className={inputCls} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Kumpirmahin ang bagong password</span>
              <input name="confirm_password" type="password" required minLength={6} className={inputCls} />
            </label>
            <div className="sm:col-span-3">
              <button className={btnGhostCls}>Palitan ang password</button>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
