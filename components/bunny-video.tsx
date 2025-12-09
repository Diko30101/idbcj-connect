"use client";

interface BunnyVideoProps {
  libraryId: string; // Keep this as 'string'
  videoId: string;   // Keep this as 'string'
  title?: string;    // Keep this as 'string'
}

export function BunnyVideo({ libraryId, videoId, title }: BunnyVideoProps) {
  // This constructs the secure embed URL for Bunny Stream
  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

  return (
    <div className="w-full">
      {title && <h3 className="font-bold text-gray-800 mb-3">{title}</h3>}
      <div className="relative pt-[56.25%] rounded-xl overflow-hidden shadow-md border border-gray-200 bg-black">
        <iframe
          src={embedUrl}
          loading="lazy"
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen={true}
        ></iframe>
      </div>
    </div>
  );
}