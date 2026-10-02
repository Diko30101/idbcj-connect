"use client";

// YouTube live embed: awtomatikong ipinapakita ang kasalukuyang live
// stream ng channel. Kung walang live, ang pinakahuling stream ang lalabas.
export function LivestreamPlayer({ channelId }: { channelId: string }) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&rel=0`}
        title="IDBCJ Live Stream"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
