"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, Lock, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isInternalEmail } from "@/lib/username";
import { WORSHIP } from "@/lib/worship";

type Item = { href: string; label: string; gated?: boolean; external?: boolean };
type Entry = { label: string; href?: string; gated?: boolean; children?: Item[] };

// Ang "gated" ay mga pahinang kailangan pa ng login (ayon sa proxy). May maliit na kandado ito para hindi magulat ang bisita.
const MENU: Entry[] = [
  { label: "I’m New", href: "/im-new" },
  {
    label: "About",
    children: [
      { href: "/about", label: "About Us" },
      { href: "/history", label: "Our History" },
      { href: "/ministries", label: "Leadership", gated: true },
    ],
  },
  { label: "Events", href: "/events", gated: true },
  {
    label: "Watch",
    children: [
      { href: WORSHIP.streamUrl, label: "Live Stream", external: true },
      { href: "/sermons", label: "Sermon Library", gated: true },
    ],
  },
  {
    label: "Connect",
    children: [
      { href: "/contact", label: "Contact Us" },
      { href: "/portal/prayer", label: "Prayer Request", gated: true },
    ],
  },
];

// Ang portal at ang privacy notice ay may sarili nang menu bar
const HIDDEN_ON = ["/portal", "/consent", "/change-password"];

const linkBase =
  "font-display whitespace-nowrap text-[15px] font-semibold transition-colors";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState("");
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Kung naka-login na, ang pangalan niya at "Logout" ang ipapakita
  useEffect(() => {
    const supabase = createClient();

    async function apply(session: { user: { id: string; email?: string } } | null) {
      setLoggedIn(!!session);
      if (!session) {
        setName("");
        return;
      }
      // Pansamantala, email muna habang kinukuha ang pangalan sa profile
      setName((prev) => prev || (isInternalEmail(session.user.email) ? "" : (session.user.email ?? "")));
      const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Isara ang mga menu kapag lumipat ng pahina
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Isara ang dropdown kapag nag-click sa labas o pinindot ang Esc
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  const isActive = (href?: string) =>
    !!href && !href.startsWith("http") && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const entryActive = (e: Entry) => isActive(e.href) || !!e.children?.some((c) => isActive(c.href));
  const closeAll = () => {
    setMobileOpen(false);
    setOpenMenu(null);
  };

  const lock = (gated?: boolean) =>
    gated && !loggedIn ? <Lock className="ml-1.5 inline h-3 w-3 shrink-0 text-emerald-700/50" aria-label="Para sa members" /> : null;

  return (
    <nav ref={navRef} className="sticky top-0 z-50 border-b border-emerald-900/10 bg-white shadow-sm" aria-label="Main">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-6">
          {/* --- LOGO --- */}
          <Link href="/" className="flex shrink-0 items-center gap-3 transition hover:opacity-80" onClick={closeAll}>
            <span className="font-display text-xl font-extrabold tracking-tight text-emerald-950">IDBCJ</span>
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-emerald-100 shadow-sm md:h-12 md:w-12">
              <Image src="/logo.png" alt="IDBCJ Logo" fill sizes="48px" className="object-cover" />
            </span>
            <span className="font-display hidden text-[11px] font-medium leading-tight text-emerald-800/80 sm:block">
              Iglesia ng Dios na Buhay
              <br />
              kay Cristo Jesus
            </span>
          </Link>

          {/* --- DESKTOP MENU --- */}
          <div className="hidden items-center gap-7 lg:flex">
            <ul className="flex items-center gap-7">
              {MENU.map((e) => {
                const active = entryActive(e);
                const color = active ? "text-emerald-700" : "text-emerald-950 hover:text-emerald-700";
                if (!e.children) {
                  return (
                    <li key={e.label}>
                      <Link href={e.href!} className={`${linkBase} ${color}`}>
                        {e.label}
                        {lock(e.gated)}
                      </Link>
                    </li>
                  );
                }
                const open = openMenu === e.label;
                return (
                  <li
                    key={e.label}
                    className="relative"
                    onMouseEnter={() => setOpenMenu(e.label)}
                    onMouseLeave={() => setOpenMenu((m) => (m === e.label ? null : m))}
                  >
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={open}
                      onClick={() => setOpenMenu(open ? null : e.label)}
                      className={`${linkBase} ${color} inline-flex items-center gap-1 py-6`}
                    >
                      {e.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 rounded-2xl border border-emerald-900/10 bg-white p-2 shadow-xl">
                        {e.children.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            className={`font-display flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-emerald-50 hover:text-emerald-800 ${
                              isActive(c.href) ? "text-emerald-700" : "text-emerald-950"
                            }`}
                          >
                            <span>
                              {c.label}
                              {lock(c.gated)}
                            </span>
                            {c.external && <ExternalLink className="h-3.5 w-3.5 text-emerald-700/60" />}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-3 border-l border-emerald-900/10 pl-6">
              {loggedIn ? (
                <>
                  <span className="hidden max-w-[10rem] truncate font-display text-sm font-semibold text-emerald-900 xl:block">
                    {name || "Member"}
                  </span>
                  <Link
                    href="/portal"
                    className="font-display rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                  >
                    Member Portal
                  </Link>
                  <form action="/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="font-display rounded-full px-3 py-2 text-sm font-semibold text-emerald-900/70 transition hover:bg-red-50 hover:text-red-600"
                    >
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="font-display rounded-full border border-emerald-800 px-5 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-800 hover:text-white"
                >
                  Members
                </Link>
              )}
            </div>
          </div>

          {/* --- MOBILE MENU BUTTON --- */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="p-2 text-emerald-900 hover:text-emerald-600 focus:outline-none lg:hidden"
          >
            {mobileOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* --- MOBILE PANEL --- */}
      {mobileOpen && (
        <div className="absolute left-0 top-20 max-h-[calc(100vh-5rem)] w-full overflow-y-auto border-b border-emerald-900/10 bg-white shadow-xl lg:hidden">
          <div className="space-y-1 px-5 py-4">
            {MENU.map((e) =>
              e.children ? (
                <div key={e.label} className="pt-3">
                  <p className="font-display px-3 pb-1 text-xs font-bold uppercase tracking-widest text-emerald-700/70">{e.label}</p>
                  {e.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={closeAll}
                      {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className={`font-display flex items-center justify-between rounded-xl px-3 py-3 text-base font-semibold hover:bg-emerald-50 ${
                        isActive(c.href) ? "text-emerald-700" : "text-emerald-950"
                      }`}
                    >
                      <span>
                        {c.label}
                        {lock(c.gated)}
                      </span>
                      {c.external && <ExternalLink className="h-4 w-4 text-emerald-700/60" />}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={e.label}
                  href={e.href!}
                  onClick={closeAll}
                  className={`font-display block rounded-xl px-3 py-3 text-base font-semibold hover:bg-emerald-50 ${
                    isActive(e.href) ? "text-emerald-700" : "text-emerald-950"
                  }`}
                >
                  {e.label}
                  {lock(e.gated)}
                </Link>
              ),
            )}

            <div className="flex flex-col gap-3 border-t border-emerald-900/10 pt-5">
              {loggedIn ? (
                <>
                  <p className="font-display truncate px-1 text-sm font-semibold text-emerald-900">{name || "Member"}</p>
                  <Link
                    href="/portal"
                    onClick={closeAll}
                    className="font-display rounded-full bg-emerald-800 px-5 py-3 text-center text-base font-semibold text-white hover:bg-emerald-900"
                  >
                    Member Portal
                  </Link>
                  <form action="/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="font-display w-full rounded-full border border-red-300 px-5 py-3 text-base font-semibold text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={closeAll}
                  className="font-display rounded-full border border-emerald-800 px-5 py-3 text-center text-base font-semibold text-emerald-900 hover:bg-emerald-800 hover:text-white"
                >
                  Members Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
