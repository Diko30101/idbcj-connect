"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlayCircle, Search, User, Calendar } from "lucide-react";
import type { Sermon } from "@/lib/sermons";
import { formatSermonDate } from "@/lib/sermons";

export function SermonList({ sermons }: { sermons: Sermon[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(sermons.map((s) => s.category)))],
    [sermons]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sermons.filter((s) => {
      if (category !== "All" && s.category !== category) return false;
      if (!q) return true;
      const haystack = [
        s.title,
        s.titleTl,
        s.speaker,
        s.category,
        s.summary,
        s.summaryTl,
        ...(s.verses ?? []).map((v) => v.ref),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sermons, query, category]);

  return (
    <div>
      {/* Search + category */}
      <div className="mb-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, speaker, or verse..."
            aria-label="Search sermons"
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white"
          />
        </div>

        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  category === c
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">No sermons found. / Walang nahanap na sermon.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/sermons/${s.slug}`}
              className="group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative h-48 bg-gray-200">
                {s.videoId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle className="w-8 h-8 text-emerald-700" />
                  </div>
                </div>
              </div>
              <div className="p-5">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  {s.category}
                </span>
                <h3 className="font-bold text-gray-900 mt-2 text-lg line-clamp-2 group-hover:text-emerald-700">
                  {s.title}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1">
                    <User size={12} /> {s.speaker}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {formatSermonDate(s.date)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-3 line-clamp-2">{s.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
