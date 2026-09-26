import { BorrowerLoginsPanel } from "./borrower-logins";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tulong Financial Portal" };

// Bagong Tulong Financial portal — para sa Finance Ministry (portal account):
// dito pinamamahalaan ang mga login ng pinahiram. Ang pagtatala ng hiram at bayad
// ay nasa main portal pa rin. Ang guard ay nasa panel (requireTulongFinancialAccess):
// kapag hindi naka-login, dadalhin sa /auth/login; kapag walang access, sa /portal.
export default function TulongFinancePortalPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Tulong Financial Portal</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pamamahala ng mga login ng pinahiram — Finance Ministry at Admin lang ang nakakakita.
          </p>
        </div>
        <a href="/portal" className="shrink-0 text-sm font-medium text-emerald-700 hover:underline">
          ← Bumalik sa portal
        </a>
      </div>
      <BorrowerLoginsPanel returnTo="/tulong-financial/finance" />
    </main>
  );
}
