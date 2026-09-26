"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WORSHIP, WORSHIP_ALBERTA, WORSHIP_BATANGAS } from "@/lib/worship";

// Ang portal, ang privacy notice, at ang pagpalit ng password ay may sarili nang layout
const HIDDEN_ON = ["/portal", "/consent", "/change-password"];

const linkCls = "text-emerald-100/80 underline-offset-4 hover:text-white hover:underline";
const headCls = "font-display mb-4 text-xs font-bold uppercase tracking-widest text-amber-300";

export function Footer() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <footer className="bg-emerald-800 text-sm text-emerald-100/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* Church */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-emerald-400">
              <Image src="/logo.png" alt="IDBCJ Logo" fill sizes="48px" className="object-cover" />
            </span>
            <span className="font-display text-lg font-extrabold leading-tight text-white">IDBCJ</span>
          </div>
          <p className="leading-relaxed">Iglesia ng Dios na Buhay kay Cristo Jesus</p>
          <p className="text-xs text-emerald-100/75">Founded 1954 &middot; SEC Reg. No. 13708 (registered 1958)</p>
        </div>

        {/* Explore */}
        <div>
          <h2 className={headCls}>Explore</h2>
          <ul className="space-y-2.5">
            <li><Link href="/im-new" className={linkCls}>I&rsquo;m New</Link></li>
            <li><Link href="/about" className={linkCls}>About Us</Link></li>
            <li><Link href="/history" className={linkCls}>Our History</Link></li>
            <li><Link href="/ministries" className={linkCls}>Leadership</Link></li>
            <li><Link href="/sermons" className={linkCls}>Sermon Library</Link></li>
            <li><Link href="/events" className={linkCls}>Events</Link></li>
          </ul>
        </div>

        {/* Visit */}
        <div>
          <h2 className={headCls}>Worship With Us</h2>
          <ul className="space-y-2.5">
            <li>Medina, Magallanes, Cavite: Every {WORSHIP.day}, {WORSHIP.displayTime}</li>
            <li>Sto. Tomas, Batangas: Every {WORSHIP_BATANGAS.day}, {WORSHIP_BATANGAS.displayTimes.join(" and ")}</li>
            <li>Fort McMurray, Alberta: Every {WORSHIP_ALBERTA.day}, {WORSHIP_ALBERTA.displayTime}</li>
            <li>
              <a href={WORSHIP.streamUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
                Join Live Stream
              </a>
            </li>
          </ul>
        </div>

        {/* Connect */}
        <div>
          <h2 className={headCls}>Connect</h2>
          <ul className="space-y-2.5">
            <li><Link href="/contact" className={linkCls}>Contact Us</Link></li>
            <li><Link href="/auth/login?next=/" className={linkCls}>Members Login</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-emerald-600">
        <div className="mx-auto max-w-7xl px-6 py-5 text-center text-xs text-emerald-100/75 lg:px-8">
          &copy; {new Date().getFullYear()} Iglesia ng Dios na Buhay kay Cristo Jesus. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
