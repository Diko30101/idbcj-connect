"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  Gift,
  HandHeart,
  HandHelping,
  HeartHandshake,
  Home,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Menu,
  Mic,
  Network,
  PiggyBank,
  Receipt,
  ScrollText,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { PortalNav, type NavItem } from "./portal-nav";
import { NotificationBell } from "./notification-bell";

// Lokal na kopya ng role labels — hindi ini-import ang @/lib/portal dito
// dahil may server-only code ito (next/headers).
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin (Presiding Minister)",
  secretary: "Secretary",
  leader: "Ministry Leader",
  member: "Member",
  treasurer: "Treasurer",
};

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

// Icon bawat nav href; fallback kung may bagong idagdag na link sa hinaharap.
const ICONS: Record<string, LucideIcon> = {
  "/portal": Home,
  "/portal/inbox": Inbox,
  "/portal/announcements": Megaphone,
  "/portal/ministries": Network,
  "/portal/prayer": HeartHandshake,
  "/portal/profile": User,
  "/portal/attendance": ClipboardCheck,
  "/portal/members": Users,
  "/portal/sermons": Mic,
  "/portal/events": CalendarDays,
  "/portal/finance": Wallet,
  "/portal/finance/report": FileSearch,
  "/portal/finance/expenses": Receipt,
  "/portal/finance/local": Building2,
  "/portal/courses": BookOpen,
  "/portal/finance/abuluyan": HandHeart,
  "/portal/finance/ambagan": PiggyBank,
  "/portal/finance/tulong": HandHelping,
  "/portal/finance/pasalamat": Gift,
  "/portal/roster": ClipboardList,
  "/portal/attendance-record": ClipboardCheck,
  "/portal/audit": ScrollText,
};

function SidebarLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = ICONS[item.href] ?? LayoutDashboard;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
        active
          ? "bg-[#d8f5e7] font-semibold text-[#083e31]"
          : "font-medium text-[#dceae4]/90 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      )}
    </Link>
  );
}

// Expandable na subgroup (hal. Finance → Financial Management, Audit Report, Expenses).
// Ang label mismo ay link sa parent href; ang chevron ang nagbubukas ng mga anak.
// Recursive na active check -- kasama ang mga nested na submenu (hal. Finance Record
// sa loob ng Local Ministry).
function hasActiveDescendant(pathname: string, items: NavItem[]): boolean {
  return items.some((c) => pathname === c.href || hasActiveDescendant(pathname, c.children ?? []));
}

function SidebarGroup({
  item,
  pathname,
  onNavigate,
  depth = 0,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
  depth?: number;
}) {
  const Icon = ICONS[item.href] ?? LayoutDashboard;
  const children = item.children ?? [];
  const childActive = hasActiveDescendant(pathname, children);
  const sectionActive = isActive(pathname, item.href) || childActive;
  const [open, setOpen] = useState(sectionActive);

  // Kapag lumipat sa isang child route, awtomatikong buksan ang grupo.
  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <div>
      <div
        className={`flex items-center rounded-lg transition ${
          sectionActive && !open
            ? "bg-[#d8f5e7] font-semibold text-[#083e31]"
            : "font-medium text-[#dceae4]/90 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={sectionActive && !open ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${item.label}: ${open ? "isara" : "buksan"} ang submenu`}
          className="mr-1 shrink-0 rounded-md p-2 transition hover:bg-white/10"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
      {open && (
        <ul className={`mb-1 mt-1 space-y-0.5 border-l border-white/15 pl-3 ${depth === 0 ? "ml-5" : "ml-2"}`}>
          {children.map((child) => {
            if (child.children && child.children.length > 0) {
              return (
                <li key={`${child.label}-${child.href}`}>
                  <SidebarGroup item={child} pathname={pathname} onNavigate={onNavigate} depth={depth + 1} />
                </li>
              );
            }
            const active = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-[13px] transition ${
                    active
                      ? "bg-[#d8f5e7] font-semibold text-[#083e31]"
                      : "text-[#dceae4]/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

import { SignOutMenu } from "./sign-out-menu";

const signOutClassic = <SignOutMenu />;

const signOutDark = <SignOutMenu dark />;

// Klasikong shell — eksaktong kapareho ng dating layout para sa lahat ng
// portal page maliban sa home.
function ClassicShell({
  navItems,
  displayName,
  children,
}: {
  navItems: NavItem[];
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-emerald-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/portal" className="flex items-center gap-3 text-lg font-bold text-emerald-900">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-emerald-100 shadow-sm">
              <Image src="/logo.png" alt="IDBCJ Logo" fill sizes="40px" className="object-cover" />
            </span>
            IDBCJ Connect
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">{displayName}</span>
            <NotificationBell />
            {signOutClassic}
          </div>
        </div>
      </header>
      <PortalNav items={navItems} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

// Bagong emerald sidebar shell — para lang sa portal home (/portal).
function SidebarShell({
  navItems,
  displayName,
  role,
  children,
}: {
  navItems: NavItem[];
  displayName: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  // Ang mga dropdown group (hal. Finance, Gawain, Local Ministry) ay
  // nire-render nang direkta bilang expandable na SidebarGroup sa sidebar.
  const sidebarItems: NavItem[] = navItems;

  // Isara ang drawer kapag lumipat ng page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Isara sa Escape; i-lock ang scroll ng body habang bukas sa mobile.
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia("(max-width: 1023.5px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-label="Buksan ang menu"
          className="rounded-lg p-2 text-gray-600 transition hover:bg-emerald-50 hover:text-[#075f47]"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <span className="text-base font-bold text-[#075f47]">IDBCJ Connect</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </header>

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed sa desktop, slide-out drawer sa mobile */}
      <aside
        aria-label="Pangunahing menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#075f47] text-[#dceae4] shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Link href="/portal" onClick={closeDrawer} className="flex min-w-0 items-center gap-3">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20">
              <Image src="/logo.png" alt="IDBCJ Logo" fill sizes="40px" className="object-cover" />
            </span>
            <span className="truncate text-lg font-bold text-white">IDBCJ Connect</span>
          </Link>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Isara ang menu"
            className="ml-auto shrink-0 rounded-lg p-2 text-[#b7d2c4] transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Portal navigation">
          <ul className="space-y-1">
            {sidebarItems.map((item) => (
              <li key={item.href}>
                {item.children && item.children.length > 0 ? (
                  <SidebarGroup item={item} pathname={pathname} onNavigate={closeDrawer} />
                ) : (
                  <SidebarLink item={item} pathname={pathname} onNavigate={closeDrawer} />
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c6eedb] text-sm font-bold text-[#084533]"
              aria-hidden="true"
            >
              {initialsOf(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-[#b7d2c4]">{ROLE_LABEL[role] ?? role}</p>
            </div>
          </div>
          <div className="mt-3">{signOutDark}</div>
        </div>
      </aside>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

export function PortalShell({
  navItems,
  displayName,
  role,
  children,
}: {
  navItems: NavItem[];
  displayName: string;
  role: string;
  status: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Ang sidebar theme ay para lang sa portal home (/portal); lahat ng ibang
  // portal page ay nananatili sa klasikong header + pill nav shell.
  if (pathname === "/portal") {
    return (
      <SidebarShell navItems={navItems} displayName={displayName} role={role}>
        {children}
      </SidebarShell>
    );
  }
  return (
    <ClassicShell navItems={navItems} displayName={displayName}>
      {children}
    </ClassicShell>
  );
}
