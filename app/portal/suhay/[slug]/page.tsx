import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuhayAccess } from "@/lib/portal";
import {
  getSuhayPage,
  suhayLessons,
  resolveSuhayMedia,
  suhayMediaUrl,
} from "@/lib/suhay";

// Isang SUHAY na pahina (aralin, yugto, o gabay) sa loob ng portal.
export default async function SuhayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSuhayAccess();
  const { slug } = await params;

  const page = getSuhayPage(slug);
  if (!page) notFound();

  const html = await resolveSuhayMedia(page.html);
  const audioUrl = page.audio ? await suhayMediaUrl(page.audio) : null;

  let prev: { slug: string; label: string } | null = null;
  let next: { slug: string; label: string } | null = null;
  if (page.group === "aralin" && page.num) {
    const lessons = suhayLessons();
    const p = lessons.find((l) => l.num === page.num! - 1);
    const n = lessons.find((l) => l.num === page.num! + 1);
    if (p) prev = { slug: p.slug, label: `← Aralin ${page.num - 1}` };
    if (n) next = { slug: n.slug, label: `Aralin ${page.num + 1} →` };
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/portal/suhay"
          className="text-sm font-semibold text-emerald-700 hover:underline"
        >
          ← Bumalik sa SUHAY
        </Link>
      </div>

      <h1 className="mb-4 font-serif text-3xl font-bold leading-tight text-emerald-950">
        {page.title}
      </h1>

      {audioUrl && (
        <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-2 text-sm font-semibold text-emerald-900">
            🎧 Pakinggan ang narasyon ng aralin
          </div>
          <audio controls preload="none" src={audioUrl} className="w-full" />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div
          className="suhay-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {(prev || next) && (
        <div className="mt-6 flex items-center justify-between gap-3">
          {prev ? (
            <Link
              href={`/portal/suhay/${prev.slug}`}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/portal/suhay/${next.slug}`}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {next.label}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
