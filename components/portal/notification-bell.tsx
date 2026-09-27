"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadInboxCount } from "@/app/portal/actions";

// Simple bell notification: nagpapakita ng bilang ng hindi pa nababasang
// inbox letters (pareho sa sidebar badge). Pag-click, diretso sa /portal/inbox.
export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const { count } = await getUnreadInboxCount();
      setUnread(count);
    } catch {
      // tahimik lang; susubukan ulit sa susunod na poll
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // poll kada minuto
    return () => clearInterval(t);
  }, [load]);

  return (
    <Link
      href="/portal/inbox"
      aria-label="Inbox"
      className={`relative rounded-full p-2 transition ${
        dark
          ? "text-[#b7d2c4] hover:bg-white/10 hover:text-white"
          : "text-gray-500 hover:bg-emerald-50 hover:text-emerald-700"
      }`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
