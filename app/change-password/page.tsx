import { getPortalContext } from "@/lib/portal";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Baguhin ang Password | IDBCJ Connect", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const { profile } = await getPortalContext();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Baguhin ang Password</h1>
          <p className="text-sm text-gray-500">
            {profile.must_change_password
              ? "Kailangan mo munang palitan ang temporary password bago magpatuloy."
              : "Mag-set ng bagong password para sa iyong account."}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
