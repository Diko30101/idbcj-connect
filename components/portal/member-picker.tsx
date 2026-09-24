"use client";

import { useEffect, useRef, useState } from "react";
import { inputCls, btnGhostCls } from "./form-bits";
import type { MemberChoice } from "@/lib/giving";

// Pagpili ng kaanib para sa handog. Naghahanap gamit ang search_members (database function; kumpirmado at Active lang,
// o Inactive na may aktibong pahintulot). Walang free-text na pangalan: ang tanging isinusumite ay ang id ng napili.
// Magagamit muli sa Ambagan, Tulong sa Klase Ministeryal at Pasalamat.
export function MemberPicker({
  search,
  name = "member_id",
}: {
  search: (q: string) => Promise<MemberChoice[]>;
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MemberChoice[]>([]);
  const [chosen, setChosen] = useState<MemberChoice | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chosen) return;
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await search(q));
      } catch {
        setResults([]);
      }
      setSearching(false);
      setSearched(true);
    }, 300);
    return () => clearTimeout(t);
  }, [q, chosen, search]);

  // Ang field ay "required" hangga't walang napili (katutubong validation ng browser)
  useEffect(() => {
    input.current?.setCustomValidity(chosen ? "" : "Pumili ng kaanib mula sa listahan.");
  }, [chosen, q]);

  if (chosen) {
    return (
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Kaanib</span>
        <input type="hidden" name={name} value={chosen.id} />
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-semibold">{chosen.full_name}</span>
          <span className="text-emerald-700">
            · {chosen.local_name} · {chosen.status}
          </span>
          <button
            type="button"
            className={`${btnGhostCls} ml-auto`}
            onClick={() => {
              setChosen(null);
              setQ("");
              setResults([]);
            }}
          >
            Palitan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-1.5">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-gray-700">Kaanib (hanapin ang pangalan)</span>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          required
          className={inputCls}
        />
      </label>
      {searching && <span className="text-xs text-gray-500">Hinahanap…</span>}
      {results.length > 0 && (
        <ul className="max-h-56 overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-emerald-50" onClick={() => setChosen(m)}>
                <span className="font-medium text-gray-800">{m.full_name}</span>
                <span className="text-gray-500">
                  {" "}
                  · {m.local_name} · {m.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && !searching && results.length === 0 && q.trim().length >= 2 && (
        <span className="text-xs text-gray-500">
          Walang nakita. Ang mga kumpirmadong kaanib lang ang lumalabas (at ang Inactive na may aktibong pahintulot).
        </span>
      )}
    </div>
  );
}
