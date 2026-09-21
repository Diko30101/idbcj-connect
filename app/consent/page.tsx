import { redirect } from "next/navigation";
import { getPortalContext, DPO_CONTACT } from "@/lib/portal";
import { acceptConsent } from "./actions";
import { Notice, btnCls } from "@/components/portal/ui";

export const metadata = { title: "Privacy Notice | IDBCJ", robots: { index: false, follow: false } };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { profile } = await getPortalContext();
  if (profile.consent_at) redirect("/portal");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Privacy Notice at Pahintulot</h1>
          <p className="text-sm text-gray-500">Bago mo gamitin ang Member Portal ng IDBCJ, pakibasa ito.</p>
        </div>

        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          DRAFT: Ang teksto na ito ay dapat i-review ng Data Protection Officer o abogado sa Pilipinas
          bago gamitin ng lahat ng members.
        </p>

        <Notice error={error} />

        <div className="space-y-4 text-sm leading-relaxed text-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900">Anong impormasyon ang kinokolekta</h2>
            <p>
              Pangalan, email, numero ng telepono, kaarawan, lungsod o bayan, contact sa oras ng
              emergency, ministry, status ng pagiging member, petsa ng binyag, at ang iyong attendance.
              Ang pagiging member ng simbahan at ang binyag ay maaaring ituring na sensitibong
              impormasyon tungkol sa relihiyon.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Bakit ito kinokolekta</h2>
            <p>
              Para maayos ang talaan ng mga kapatiran, maalagaan ang bawat isa, makapagpadala ng mga
              anunsyo, at maiplano ang mga gawain at iskedyul ng paglilingkod.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Sino ang makakakita</h2>
            <ul className="list-disc pl-5">
              <li>Ikaw: ang lahat ng iyong impormasyon.</li>
              <li>Presiding Minister at Secretary: ang talaan ng members at attendance.</li>
              <li>Ministry Leader: pangalan, telepono at status ng mga miyembro ng sarili niyang grupo lamang.</li>
              <li>Prayer requests: ikaw at ang Presiding Minister lamang.</li>
              <li>Hindi ipinapakita sa publiko at hindi ibinebenta sa iba.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Ang iyong mga karapatan</h2>
            <p>
              Maaari mong tingnan at itama ang iyong impormasyon sa pahinang My Profile, at humiling na
              alisin o itigil ang paggamit nito. Makipag-ugnayan sa: <strong>{DPO_CONTACT}</strong>.
            </p>
          </div>
        </div>

        <form action={acceptConsent} className="space-y-4 border-t border-gray-100 pt-4">
          <label className="flex items-start gap-3 text-sm text-gray-800">
            <input type="checkbox" name="agree" className="mt-1 h-4 w-4" />
            <span>
              Nabasa ko at naiintindihan ko ang Privacy Notice, at pumapayag akong iproseso ng IDBCJ ang
              aking impormasyon para sa mga layuning nakasaad dito.
            </span>
          </label>
          <button type="submit" className={btnCls}>
            Sumasang-ayon ako, magpatuloy
          </button>
        </form>
      </div>
    </div>
  );
}
