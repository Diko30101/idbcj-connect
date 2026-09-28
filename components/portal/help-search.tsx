"use client";

// Search box sa Help page: nagta-type ang user ng tanong, at hinahanap dito nang live
// (walang reload) sa parehong GUIDES at FAQ na laman ng pahina -- pareho lang ang datos,
// dinadala lang bilang props mula sa server component (app/portal/help/page.tsx).

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type GuideSection = { title: string; body: string[] };
type Faq = { q: string; a: string };

type SearchResult =
  | { kind: "faq"; key: string; q: string; a: string }
  | { kind: "guide"; key: string; title: string; body: string[] };

export function HelpSearch({ guides, faq }: { guides: GuideSection[]; faq: Faq[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchResult[];

    const faqMatches: SearchResult[] = faq
      .filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
      .map((f) => ({ kind: "faq" as const, key: `faq-${f.q}`, q: f.q, a: f.a }));

    const guideMatches: SearchResult[] = guides
      .filter((g) => g.title.toLowerCase().includes(q) || g.body.some((p) => p.toLowerCase().includes(q)))
      .map((g) => ({ kind: "guide" as const, key: `guide-${g.title}`, title: g.title, body: g.body }));

    return [...faqMatches, ...guideMatches];
  }, [query, faq, guides]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Maghanap sa Help</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='I-type ang gusto mong itanong (hal. "paano magpalit ng password")...'
          className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>

      {query.trim() !== "" && (
        <div className="mt-3 space-y-2">
          {results.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500">
              Walang nahanap na tugma sa &ldquo;{query.trim()}&rdquo;. Subukan ibang salita, o gamitin ang{" "}
              <span className="font-semibold">Inbox</span> para direktang tanungin ang Admin.
            </p>
          ) : (
            results.map((r) => (
              <div key={r.key} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-800">{r.kind === "faq" ? r.q : r.title}</p>
                {r.kind === "faq" ? (
                  <p className="mt-1 text-sm text-gray-600">{r.a}</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {r.body.map((p, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
