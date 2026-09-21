import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, User, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SermonPlayer } from "@/components/sermon-player";
import { getPublishedSermons, getSermon, formatSermonDate } from "@/lib/sermons";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedSermons().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sermon = getSermon(slug);
  if (!sermon) return {};
  return {
    title: `${sermon.title} | IDBCJ Sermons`,
    description: sermon.summary.slice(0, 160),
  };
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sermon = getSermon(slug);
  if (!sermon) notFound();

  const verses = sermon.verses ?? [];
  const questions = sermon.questions ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/sermons">
          <Button variant="ghost" className="text-gray-600 hover:text-gray-900 pl-0 hover:bg-transparent">
            ← Sermon Library
          </Button>
        </Link>

        {/* Title */}
        <header className="mt-4 space-y-3">
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wider rounded-full uppercase">
            {sermon.category}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{sermon.title}</h1>
          {sermon.titleTl && <p className="text-lg text-gray-500 italic">{sermon.titleTl}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <User size={16} /> {sermon.speaker}
            </span>
            <span className="flex items-center gap-2">
              <Calendar size={16} /> {formatSermonDate(sermon.date)}
            </span>
          </div>
        </header>

        {/* Video */}
        {sermon.videoId && (
          <div className="mt-6">
            <SermonPlayer videoId={sermon.videoId} title={sermon.title} />
          </div>
        )}

        {/* Summary */}
        <section className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Summary / Buod</h2>
          <p className="text-gray-700 leading-relaxed">{sermon.summary}</p>
          {sermon.summaryTl && (
            <p className="text-gray-600 leading-relaxed italic border-t border-gray-100 pt-3">{sermon.summaryTl}</p>
          )}
        </section>

        {/* Verses */}
        {verses.length > 0 && (
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Bible Verses / Mga Talata</h2>
            <ul className="space-y-4">
              {verses.map((v) => (
                <li key={v.ref} className="border-l-4 border-emerald-500 pl-4">
                  <p className="font-semibold text-gray-900">
                    {v.ref}
                    {v.translation && <span className="ml-2 text-xs font-normal text-gray-500">({v.translation})</span>}
                  </p>
                  {v.text && <p className="text-gray-700 mt-1 leading-relaxed">&ldquo;{v.text}&rdquo;</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Review questions */}
        {questions.length > 0 && (
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">Review Questions / Mga Tanong</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-700 leading-relaxed">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>
        )}

        {/* PDF */}
        {sermon.pdf && (
          <div className="mt-8">
            <a href={sermon.pdf} download>
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Download className="mr-2 h-4 w-4" />
                Download PDF / I-download ang PDF
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
