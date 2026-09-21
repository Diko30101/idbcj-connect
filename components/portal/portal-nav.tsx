"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function PortalNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4">
        <ul className="flex gap-1 py-2 whitespace-nowrap">
          {items.map((item) => {
            const active =
              item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-700 text-white"
                      : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
