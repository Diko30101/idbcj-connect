import type { Metadata } from "next";
import Image from "next/image";
import { LivestreamPlayer } from "@/components/livestream-player";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Live Stream | IDBCJ",
  description: "Watch the IDBCJ Sunday livestream live.",
};

// Palitan ng tunay na YouTube Channel ID (magsisimula sa "UC").
// Makikita sa YouTube Studio → Settings → Channel → Advanced settings.
const CHANNEL_ID = "UC2w4L4NiiVrcGlE0c1XW-Hw";

export default function LivestreamPage() {
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
          <h1 className="text-4xl md:text-5xl font-extrabold">Live Stream</h1>
          <p className="mt-3 text-lg text-emerald-50 max-w-2xl">
            Watch our Sunday worship live, wherever you are.
          </p>
          <p className="mt-1 text-sm text-emerald-100 italic max-w-2xl">
            Mapanood nang live ang ating pagsamba tuwing Linggo, saan ka man naroroon.
          </p>
        </div>
      </section>

      {/* --- PLAYER --- */}
      <section className="max-w-5xl mx-auto py-12 px-6">
        <LivestreamPlayer channelId={CHANNEL_ID} />
        <p className="mt-6 text-center text-sm text-slate-500">
          Kung walang live ngayon, ipinapakita ang pinakahuling stream.
          <br />
          <span className="italic">If nothing is live right now, the most recent stream is shown.</span>
        </p>
      </section>
    </div>
  );
}
