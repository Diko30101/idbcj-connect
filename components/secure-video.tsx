"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function SecureVideo({ filename }: { filename: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchVideo() {
      const supabase = createClient();
      
      // Request a temporary link that works for 1 hour (3600 seconds)
      const { data, error } = await supabase
        .storage
        .from("sermon-videos")
        .createSignedUrl(filename, 3600);

      if (error) {
        console.error("Error loading video:", error);
        setError(true);
      } else {
        setVideoUrl(data.signedUrl);
      }
    }

    fetchVideo();
  }, [filename]);

  if (error) return <div className="bg-gray-100 p-10 text-center text-red-500">Video failed to load.</div>;
  if (!videoUrl) return <div className="bg-gray-100 p-10 text-center animate-pulse">Loading Secure Video...</div>;

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border-4 border-emerald-700 bg-black">
      <video 
        controls 
        className="w-full h-auto"
        controlsList="nodownload" 
        onContextMenu={(e) => e.preventDefault()} 
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}