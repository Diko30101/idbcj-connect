"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadInboxCount, getNotifications, markNotificationsSeen, type NotificationItem } from "@/app/portal/actions";

// Maikling petsa (hal. "Sep 29") para sa listahan ng abiso sa dropdown.
function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Bell notification: pinagsasama ang (1) hindi pa nababasang Inbox letters (sariling
// read-tracking, may link sa /portal/inbox) at (2) mga bagong pangkalahatang abiso --
// Announcements, iskedyul ng ministry, at bagong serbisyo (getNotifications/markNotificationsSeen
// sa app/portal/actions.ts, may sariling notifications_seen_at column sa profile -- dati nang
// gawa ito pero hindi pa na-konekta sa UI). Pag-click, lumalabas ang dropdown na may parehong uri;
// "nakita na" awtomatiko ang mga pangkalahatang abiso pagsara ng dropdown -- hindi ito nakakaapekto
// sa Inbox, na sariling proseso ng "nabasa na" sa /portal/inbox mismo.
export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [unreadInbox, setUnreadInbox] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const seenPending = useRef(false);

  const load = useCallback(async () => {
    try {
      const [inboxRes, notifRes] = await Promise.all([getUnreadInboxCount(), getNotifications()]);
      setUnreadInbox(inboxRes.count);
      setItems(notifRes.items);
    } catch {
      // tahimik lang; susubukan ulit sa susunod na poll
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // poll kada minuto
    return () => clearInterval(t);
  }, [load]);

  const closePanel = useCallback(() => {
    setOpen(false);
    if (seenPending.current) {
      seenPending.current = false;
      setItems([]);
    }
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) closePanel();
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open, closePanel]);

  function togglePanel() {
    if (open) {
      closePanel();
      return;
    }
    setOpen(true);
    if (items.length > 0) {
      seenPending.current = true;
      markNotificationsSeen().catch(() => {});
    }
  }

  const totalUnseen = unreadInbox + items.length;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Mga Abiso"
        aria-expanded={open}
        className={`relative rounded-full p-2 transition ${
          dark
            ? "text-[#b7d2c4] hover:bg-white/10 hover:text-white"
            : "text-gray-500 hover:bg-emerald-50 hover:text-emerald-700"
        }`}
      >
        <Bell className="h-5 w-5" />
        {totalUnseen > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {totalUnseen > 9 ? "9+" : totalUnseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-lg">
          <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">Mga Abiso</p>
          <Link
            href="/portal/inbox"
            onClick={closePanel}
            className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50"
          >
            <span className="font-medium text-gray-800">Inbox</span>
            {unreadInbox > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{unreadInbox} bago</span>
            ) : (
              <span className="text-xs text-gray-400">Wala pang bago</span>
            )}
          </Link>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Walang bagong anunsyo/iskedyul.</p>
            ) : (
              items.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  onClick={closePanel}
                  className="block border-b border-gray-50 px-4 py-3 text-sm last:border-0 hover:bg-gray-50"
                >
                  <p className="font-medium text-gray-800">{it.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{it.subtitle}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{fmtShortDate(it.date)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
