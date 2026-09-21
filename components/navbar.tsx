"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react"; // Icons for the menu
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/ministries", label: "Ministries" },
  { href: "/sermons", label: "Sermons" },
  { href: "/history", label: "Our History" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact Us" },
];

// Ang portal at ang privacy notice ay may sarili nang menu bar
const HIDDEN_ON = ["/portal", "/consent"];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState("");
  const pathname = usePathname();

  // Kung naka-login na, ang pangalan niya at "Logout" ang ipapakita imbes na "Login"
  useEffect(() => {
    const supabase = createClient();

    async function apply(session: { user: { id: string; email?: string } } | null) {
      setLoggedIn(!!session);
      if (!session) {
        setName("");
        return;
      }
      // Pansamantala, email muna habang kinukuha ang pangalan sa profile
      setName((prev) => prev || (session.user.email ?? ""));
      const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Isara ang mobile menu kapag lumipat ng pahina
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  const closeMenu = () => setIsOpen(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-green-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* --- LOGO --- */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition" onClick={closeMenu}>
            <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-full border-2 border-emerald-100 shrink-0 shadow-sm">
              <Image src="/logo.png" alt="IDBCJ Logo" fill className="object-cover" />
            </div>
            <div className="font-bold text-gray-800 leading-tight">
              <span className="min-[1700px]:hidden text-xl">IDBCJ</span>
              <span className="hidden min-[1700px]:block text-lg">Iglesia ng Dios na Buhay kay Cristo Jesus</span>
            </div>
          </Link>

          {/* --- DESKTOP MENU (Hidden on Mobile) --- */}
          <div className="hidden xl:flex items-center gap-6">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "whitespace-nowrap text-sm font-semibold transition " +
                  (isActive(l.href) ? "text-emerald-700" : "text-gray-600 hover:text-emerald-600")
                }
              >
                {l.label}
              </Link>
            ))}

            <div className="flex items-center gap-3 ml-2 border-l border-gray-200 pl-5">
              {loggedIn ? (
                <>
                  <Link href="/portal" title="Buksan ang IDBCJ Connect" className="flex max-w-[14rem] flex-col leading-tight hover:opacity-80 transition">
                    <span className="truncate text-sm font-semibold text-emerald-700">{name || "IDBCJ Connect"}</span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      You&apos;re connected
                    </span>
                  </Link>
                  <form action="/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/auth/login" className="whitespace-nowrap text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1">
                  Login to Connect
                </Link>
              )}
            </div>
          </div>

          {/* --- MOBILE MENU BUTTON (Visible only on Mobile) --- */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              className="text-emerald-900 hover:text-emerald-600 focus:outline-none p-2"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE FULL-SCREEN DROPDOWN --- */}
      {isOpen && (
        <div className="xl:hidden absolute top-20 left-0 w-full bg-white border-b border-green-100 shadow-xl animate-in slide-in-from-top-5 duration-300">
          <div className="flex flex-col p-6 space-y-4 text-center">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeMenu}
                className={
                  "text-lg font-semibold py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg " +
                  (isActive(l.href) ? "text-emerald-900" : "text-gray-600")
                }
              >
                {l.label}
              </Link>
            ))}

            <div className="pt-4 flex flex-col gap-3">
              {loggedIn ? (
                <>
                  <Link href="/portal" onClick={closeMenu}>
                    <Button variant="outline" className="h-auto w-full flex-col gap-0 border-emerald-600 py-2 text-emerald-700">
                      <span className="max-w-full truncate">{name || "IDBCJ Connect"}</span>
                      <span className="text-[11px] font-normal text-gray-500">You&apos;re connected</span>
                    </Button>
                  </Link>
                  <form action="/auth/sign-out" method="post">
                    <Button type="submit" variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                      Logout
                    </Button>
                  </form>
                </>
              ) : (
                <Link href="/auth/login" onClick={closeMenu}>
                  <Button variant="outline" className="w-full border-emerald-600 text-emerald-700">
                    Login to Connect
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
