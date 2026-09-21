import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SermonList } from "@/components/sermon-list";
import { getPublishedSermons } from "@/lib/sermons";

export const metadata: Metadata = {
  title: "Sermon Library | IDBCJ",
  description: "Watch and study sermons with summaries, Bible verses, and review questions.",
};

export default function SermonsPage() {
  const sermons = getPublishedSermons();

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* --- HERO --- */}
      <section className="relative w-full py-12 px-4 md:px-12">
        <div className="absolute inset-0">
          <Image
            src="/background.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover brightness-25"
            priority
          />
          <div className="absolute inset-0 bg-emerald-900/80 mix-blend-multiply" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-white">
          <Link href="/">
            <Button variant="ghost" className="text-emerald-100 hover:text-white hover:bg-white/10 pl-0 mb-6">
              ← Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold">Sermon Library</h1>
          <p className="mt-3 text-lg text-emerald-50 max-w-2xl">
            Watch, study, and review. Each message has a summary, Bible verses, and review questions.
          </p>
          <p className="mt-1 text-sm text-emerald-100 italic max-w-2xl">
            Manood, mag-aral, at magbalik-aral. May buod, mga talata, at mga tanong ang bawat mensahe.
          </p>
        </div>
      </section>

      {/* --- LIST --- */}
      <section className="max-w-7xl mx-auto py-12 px-6">
        <SermonList sermons={sermons} />
      </section>
    </div>
  );
}
