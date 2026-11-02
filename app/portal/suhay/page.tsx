import Link from "next/link";
import { requirePortalAccess } from "@/lib/portal";
import { Panel } from "@/components/portal/ui";
import {
  suhayLessons,
  suhayYugto,
  suhayCore,
  suhayWelcome,
  resolveSuhayMedia,
} from "@/lib/suhay";

// SUHAY hub: ang pintuan ng programa ng pag-aaral ng Biblia para sa mga
// estudyanteng ministro. Nasa loob ng portal, kaya ang portal login ang bantay.
export default async function SuhayHub() {
  await requirePortalAccess();

  const welcome = suhayWelcome();
  const welcomeHtml = welcome ? await resolveSuhayMedia(welcome.html) : "";
  const yugto = suhayYugto();
  const lessons = suhayLessons();
  const core = suhayCore();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-emerald-950">
          📚 SUHAY
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Programa ng Pag-aaral ng Biblia para sa mga Estudyanteng Ministro —
          Iglesia ng Dios na Buhay kay Cristo Jesus
        </p>
      </div>

      {welcome && (
        <Panel className="mb-6">
          <div
            className="suhay-content"
            dangerouslySetInnerHTML={{ __html: welcomeHtml }}
          />
        </Panel>
      )}

      <Panel title="Mga Yugto ng Programa" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {yugto.map((p) => (
            <Link
              key={p.slug}
              href={`/portal/suhay/${p.slug}`}
              className="block rounded-lg border border-gray-200 border-t-4 border-t-emerald-600 bg-white p-4 transition hover:border-t-amber-500 hover:shadow"
            >
              <span className="block font-serif font-bold text-emerald-900">
                {p.title}
              </span>
              {p.audio && (
                <span className="mt-1 block text-xs text-gray-500">
                  🎧 May audio narasyon
                </span>
              )}
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="Mga Aralin (1–22)" className="mb-6">
        <ol className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {lessons.map((p) => (
            <li key={p.slug} className="text-sm">
              <Link
                href={`/portal/suhay/${p.slug}`}
                className="font-medium text-emerald-800 hover:underline"
              >
                {p.title}
              </Link>
              {p.audio && <span className="ml-1 text-xs text-gray-400">🎧</span>}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Mga Gabay at Sanggunian">
        <div className="grid gap-3 sm:grid-cols-2">
          {core.map((p) => (
            <Link
              key={p.slug}
              href={`/portal/suhay/${p.slug}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow"
            >
              <span className="block font-serif font-bold text-emerald-900">
                {p.title}
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
