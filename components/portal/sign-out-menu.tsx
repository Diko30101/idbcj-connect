"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Dropdown sa Sign Out button: "Bumalik sa Website" (mananatiling naka-login)
// o tuluyang "Sign Out".
export function SignOutMenu({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const btnCls = dark
    ? "flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-[#dceae4] transition hover:bg-white/10 hover:text-white"
    : "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50";
  const menuCls = dark
    ? "absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-white/20 bg-[#0b3d2e] shadow-lg"
    : "absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg";
  const itemCls = dark
    ? "block w-full px-4 py-2 text-left text-sm text-[#dceae4] hover:bg-white/10 hover:text-white"
    : "block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50";

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={btnCls} aria-haspopup="menu" aria-expanded={open}>
        Sign Out <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={menuCls} role="menu">
            <Link href="/" className={itemCls} onClick={() => setOpen(false)} role="menuitem">
              Bumalik sa Website
              <span className={dark ? "block text-xs text-[#9fc3b5]" : "block text-xs text-gray-400"}>
                Mananatiling naka-login
              </span>
            </Link>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className={`${itemCls} ${dark ? "text-red-300 hover:text-red-200" : "text-red-600"}`} role="menuitem">
                Sign Out
                <span className={dark ? "block text-xs text-[#9fc3b5]" : "block text-xs text-gray-400"}>
                  Tuluyang mag-log out
                </span>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
