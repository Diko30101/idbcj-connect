"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type NavItem = { href: string; label: string; children?: NavItem[] };

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

// Recursive na active check -- kasama ang mga nested na submenu (hal. Finance Record
// sa loob ng Local Ministry), para umilaw ang parent pill kapag nasa loob ang user.
function isActiveDeep(pathname: string, item: NavItem): boolean {
  if (isActive(pathname, item.href)) return true;
  return (item.children ?? []).some((c) => isActiveDeep(pathname, c));
}

// Nested na submenu sa loob ng dropdown (hal. Finance Record): bumubukas
// pakanan bilang flyout. Hover sa desktop, tap sa touch devices.
function NavSubmenuRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rowRef = useRef<HTMLLIElement>(null);
  const closeTimer = useRef<number | null>(null);

  const subActive = (item.children ?? []).some((c) => isActiveDeep(pathname, c));

  function place() {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 200;
    // Iwasang lumampas sa kanan ng viewport: buksan pakaliwa kung kinakailangan.
    const left = rect.right + 4 + width > window.innerWidth ? Math.max(8, rect.left - width - 4) : rect.right + 4;
    setPos({ top: Math.max(8, rect.top - 4), left });
  }
  function openMenu() {
    place();
    setOpen(true);
  }
  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }
  function toggle() {
    if (open) {
      cancelClose();
      setOpen(false);
    } else {
      openMenu();
    }
  }

  useEffect(() => cancelClose, []);
  useEffect(() => {
    if (!open) return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open ]);

  return (
    <li ref={rowRef} onMouseEnter={() => { cancelClose(); openMenu(); }} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-sm transition ${
          subActive || open
            ? "bg-emerald-50 font-medium text-emerald-800"
            : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"
        }`}
      >
        <span>{item.label}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open
        ? createPortal(
            <ul
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="z-50 min-w-[190px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              {(item.children ?? []).map((child) => {
                const childActive = isActive(pathname, child.href);
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className={`block px-4 py-2 text-sm ${
                        childActive
                          ? "bg-emerald-50 font-medium text-emerald-800"
                          : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      {child.label}
                    </Link>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </li>
  );
}

function NavDropdown({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Isara ang dropdown kapag lumipat ng page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // I-kalkula ang posisyon ng dropdown (nasa document.body ito, hindi naka-clip sa loob ng
  // nav na may overflow-x-auto)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <li>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition ${
          active ? "bg-emerald-700 text-white" : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"
        }`}
      >
        {item.label}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {mounted && open
        ? createPortal(
            <ul
              ref={menuRef}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              {item.children!.map((child) => {
                if (child.children && child.children.length > 0) {
                  return (
                    <NavSubmenuRow
                      key={`${child.label}-${child.href}`}
                      item={child}
                      onNavigate={() => setOpen(false)}
                    />
                  );
                }
                const childActive = pathname === child.href;
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-2 text-sm ${
                        childActive
                          ? "bg-emerald-50 font-medium text-emerald-800"
                          : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      {child.label}
                    </Link>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </li>
  );
}

export function PortalNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4">
        <ul className="flex gap-1 py-2 whitespace-nowrap">
          {items.map((item) => {
            // Kapag may children (dropdown), i-check kung active ang alinman sa mga ito --
            // hindi lang ang sarili nitong href, dahil hindi lahat ng dropdown (hal. "Gawain")
            // ay may iisang shared na URL prefix gaya ng Finance.
            const active =
              item.children && item.children.length > 0
                ? item.children.some((c) => isActiveDeep(pathname, c))
                : isActive(pathname, item.href);
            if (item.children && item.children.length > 0) {
              return <NavDropdown key={item.href} item={item} active={active} />;
            }
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
