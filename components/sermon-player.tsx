"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";

// Magaan na video player: thumbnail lang muna ang nilo-load.
// Ang YouTube player ay bubukas lang kapag pinindot ang play (tipid sa data).
export function SermonPlayer({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play: ${title}`}
          className="group absolute inset-0 w-full h-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white/90 rounded-full p-3 shadow-lg">
              <PlayCircle className="w-10 h-10 text-emerald-700" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
