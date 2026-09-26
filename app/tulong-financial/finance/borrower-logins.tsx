import { requireTulongFinancialAccess } from "@/lib/portal";
import { Empty, Panel, btnGhostCls, inputCls } from "@/components/portal/ui";
import {
  requestTulongUsername,
  resetBorrowerPassword,
  setBorrowerActive,
} from "@/app/portal/finance/tulong-financial/actions";

// Pamamahala ng mga login ng pinahiram — nasa bagong Tulong Financial portal lang
// (Finance Ministry at Admin). Ang paggawa ng username ay dumadaan sa apruba ng
// admin: ang Finance Ministry ay humihiling, at pag-apruba saka lang nalilikha
// ang account (aktibo agad). Wala ito sa main portal page.
export async function BorrowerLoginsPanel({ returnTo }: { returnTo: string }) {
  const { supabase } = await requireTulongFinancialAccess();

  const [{ data: borrowerRows }, { data: memberRows }, { data: usernameRequests }] = await Promise.all([
    supabase
      .from("tulong_financial_borrowers")
      .select("id, member_id, username, is_active, created_at, last_login_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("members").select("id, full_name").eq("status", "Active").order("full_name").limit(2000),
    supabase
      .from("tulong_username_requests")
      .select("id, member_id, username, status, requested_at, decided_at")
      .order("requested_at", { ascending: false })
      .limit(500),
  ]);

  const memberById = new Map(((memberRows ?? []) as any[]).map((m) => [m.id, m]));
  // Sa dropdown: Active members na WALA PANG account lang (para sa unang account).
  // Hindi kasama ang may borrower login na o may naghihintay pang kahilingan —
  // pagka-approve ng admin, automatic na silang kasapi ng Tulong Financial Members.
  const borrowerMemberIds = new Set(((borrowerRows ?? []) as any[]).map((b) => b.member_id));
  const pendingMemberIds = new Set(
    ((usernameRequests ?? []) as any[]).filter((r) => r.status === "pending").map((r) => r.member_id),
  );
  const eligibleMembers = ((memberRows ?? []) as any[]).filter(
    (m) => !borrowerMemberIds.has(m.id) && !pendingMemberIds.has(m.id),
  );
  const borrowers = ((borrowerRows ?? []) as any[]).map((b) => ({
    ...b,
    memberName: memberById.get(b.member_id)?.full_name ?? "—",
  }));
  const unameRequests = ((usernameRequests ?? []) as any[]).map((r) => ({
    ...r,
    memberName: memberById.get(r.member_id)?.full_name ?? "—",
  }));

  return (
    <Panel title="Mga login ng pinahiram (username/password)">
      <p className="mb-4 text-sm text-gray-500">
        Ang Finance Ministry ang gumagawa ng username at password para sa active member na
        magre-request ng Tulong Financial. Ang kahilingan ay ipapadala sa admin — pag-apruba
        ng admin sa Inbox letter, saka lang malilikha ang account. Makikita ng kaanib ang
        sarili niyang record sa <span className="font-medium text-gray-700">idbcj.org/tulong-financial/login</span>.
      </p>
      <form action={requestTulongUsername} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="return_to" value={returnTo} />
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">Kaanib (Active, walang account)</span>
          <select name="member_id" required className={inputCls} defaultValue="">
            <option value="" disabled>
              Pumili ng kaanib
            </option>
            {eligibleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">Username</span>
          <input name="username" type="text" required minLength={3} maxLength={30} className={inputCls} placeholder="hal. juan.delacruz" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700">Password (min. 6)</span>
          <input name="password" type="text" required minLength={6} className={inputCls} />
        </label>
        <div className="flex items-end">
          <button className={btnGhostCls}>Ipadala sa admin</button>
        </div>
      </form>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Mga kahilingan ng username</h3>
        {unameRequests.length === 0 ? (
          <Empty>Wala pang kahilingan ng username.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {unameRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-gray-800">
                  <strong>{r.memberName}</strong> · <span className="text-gray-600">@{r.username}</span>
                  <span className="text-xs text-gray-400"> · {new Date(r.requested_at).toLocaleDateString("en-PH")}</span>
                </span>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : r.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {r.status === "approved" ? "Aprubado" : r.status === "rejected" ? "Tinanggihan" : "Naghihintay ng apruba ng admin"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Mga kasalukuyang login</h3>
        {borrowers.length === 0 ? (
          <Empty>Wala pang login na nalikha.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Kaanib</th>
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Aktibo</th>
                  <th className="py-2 pr-3">Huling login</th>
                  <th className="py-2 pr-3">Reset password</th>
                  <th className="py-2 pr-3">Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {borrowers.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{b.memberName}</td>
                    <td className="py-2 pr-3 text-gray-600">{b.username}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                        {b.is_active ? "Oo" : "Hindi"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {b.last_login_at ? new Date(b.last_login_at).toLocaleString("en-PH") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <form action={resetBorrowerPassword} className="flex gap-2">
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="borrower_id" value={b.id} />
                        <input name="password" type="text" required minLength={6} placeholder="Bagong password" className={inputCls + " w-36"} />
                        <button className={btnGhostCls}>I-reset</button>
                      </form>
                    </td>
                    <td className="py-2 pr-3">
                      <form action={setBorrowerActive}>
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="borrower_id" value={b.id} />
                        <input type="hidden" name="active" value={b.is_active ? "false" : "true"} />
                        <button className={btnGhostCls}>{b.is_active ? "I-deactivate" : "I-activate"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}
