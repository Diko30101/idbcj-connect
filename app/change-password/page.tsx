import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Palitan ang Password | IDBCJ Connect", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const { profile } = await getPortalContext();
  if (!profile.must_change_password) redirect("/portal");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Palitan ang Password</h1>
          <p className="mt-1 text-sm text-gray-600">
            Temporary password lang ang ibinigay sa iyo. Bago ka magpatuloy sa IDBCJ Connect, gumawa ng sarili mong
            password na ikaw lang ang nakakaalam.
          </p>
        </div>
        <ChangePasswordForm />
        <form action="/auth/sign-out" method="post" className="border-t border-gray-100 pt-4 text-center">
          <button className="text-sm text-gray-500 hover:text-red-600">Mag-sign out</button>
        </form>
      </div>
    </div>
  );
}
