"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Megaphone } from "lucide-react";
import { getNotifications, markNotificationsSeen, type NotificationItem } from "@/app/portal/actions";

// Ilang minuto bago mag-poll ulit para sa bagong notification
const POLL_MS = 90_000;

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "ngayon lang";
  if (mins < 60) return `${mins}m ang nakalipas`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ang nakalipas`;
  return `${Math.floor(hrs / 24)}d ang nakalipas`;
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await getNotifications();
      setItems(items);
      setUnread(items.length);
    } catch {
      // tahimik lang; susubukan ulit sa susunod na poll
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await markNotificationsSeen();
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Mga notification"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative rounded-full p-2 text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
        >
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">Mga Bagong Notification</p>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-500">Wala pang bagong notification.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-emerald-50"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-700">
                      {it.kind === "announcement" ? <Megaphone className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{it.title}</span>
                      <span className="block truncate text-xs text-gray-500">{it.subtitle}</span>
                      <span className="block text-[11px] text-gray-400">{timeAgo(it.date)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
