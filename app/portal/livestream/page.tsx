import type { Metadata } from "next";
import { requirePortalAccess } from "@/lib/portal";
import { LivestreamPlayer } from "@/components/livestream-player";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Live Stream | IDBCJ",
  description: "Watch the IDBCJ Sunday livestream live. Members only.",
};

// YouTube Channel ID ng IDBCJ
const CHANNEL_ID = "UC2w4L4NiiVrcGlE0c1XW-Hw";

export default async function PortalLivestreamPage() {
  // Members lang na naka-login sa portal ang makakapasok dito
  await requirePortalAccess();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-extrabold text-slate-900">Live Stream</h1>
      <p className="mt-2 text-slate-600">
        Mapanood nang live ang ating pagsamba tuwing Linggo.
      </p>

      <div className="mt-6">
        <LivestreamPlayer channelId={CHANNEL_ID} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Kung walang live ngayon, ipinapakita ang pinakahuling stream.
      </p>
    </div>
  );
}
