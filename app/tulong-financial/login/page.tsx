import { borrowerLogin } from "../actions";
import { inputCls, btnCls } from "@/components/portal/ui";
import { isTulongFinancePortalUser, isTulongMemberPortalUser } from "../finance-check";

export const metadata = { title: "Tulong Financial — Login" };
export const dynamic = "force-dynamic";

export default async function TulongLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const financeAuthed = await isTulongFinancePortalUser();
  const memberAuthed = !financeAuthed && (await isTulongMemberPortalUser());

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-12">
      <div className="grid w-full gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-emerald-900">Tulong Financial</h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-semibold text-gray-700">Para sa mga pinahiram na walang portal account:</span> ilagay ang
            username at password na ibinigay ng Finance Ministry para makita ang iyong record.
          </p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          )}
          <form action={borrowerLogin} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Username</span>
              <input name="username" type="text" autoComplete="username" required className={inputCls} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
            </label>
            <button className={btnCls}>Mag-login</button>
          </form>
          <p className="mt-4 text-xs text-gray-400">
            Kung nakalimutan ang password, makipag-ugnayan sa Finance Ministry para i-reset ito.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-emerald-900">Portal Account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Kung may portal account ka na at aprubado ka ng admin bilang kasapi ng Tulong Financial,
            gamitin ang iyong portal account — hindi na kailangan ng bagong username/password.
            Ang Finance Ministry ay dito rin pumapasok para pamahalaan ang mga login.
          </p>
          <div className="mt-6">
            {financeAuthed ? (
              <a href="/tulong-financial/finance" className={`${btnCls} inline-block text-center`}>
                Magpatuloy sa portal
              </a>
            ) : memberAuthed ? (
              <a href="/tulong-financial" className={`${btnCls} inline-block text-center`}>
                Magpatuloy sa aking record
              </a>
            ) : (
              <>
                <a href="/auth/login" className={`${btnCls} inline-block text-center`}>
                  Mag-login sa portal
                </a>
                <p className="mt-3 text-xs text-gray-400">
                  Pagkatapos mag-login sa portal, bumalik sa pahinang ito para magpatuloy.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
