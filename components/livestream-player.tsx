"use client";

import { useState } from "react";

export function LivestreamPlayer({
  channelId,
  fallbackVideoId,
}: {
  channelId: string;
  fallbackVideoId?: string;
}) {
  const [useFallback, setUseFallback] = useState(false);

  const src = useFallback && fallbackVideoId
    ? `https://www.youtube-nocookie.com/embed/${fallbackVideoId}?rel=0`
    : `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&rel=0`;

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
      <iframe
        key={src}
        src={src}
        title="IDBCJ Live Stream"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
      {fallbackVideoId && !useFallback && (
        <button
          onClick={() => setUseFallback(true)}
          className="absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-black/90"
        >
          Panoorin ang pinakahuling video
        </button>
      )}
    </div>
  );
}
