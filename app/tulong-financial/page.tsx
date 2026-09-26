import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { fmtPeso } from "@/lib/finance";
import { Empty, Panel } from "@/components/portal/ui";
import { borrowerLogout, getBorrowerSessionToken } from "./actions";

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

export default async function TulongBorrowerPage() {
  const token = await getBorrowerSessionToken();
  if (!token) redirect("/tulong-financial/login");

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase.rpc("tulong_borrower_record", { p_token: token });
  const record = data as { member_name: string; loans: Loan[] } | null;
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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
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
    </main>
  );
}
