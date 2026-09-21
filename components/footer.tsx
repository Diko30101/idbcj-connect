"use client";

import { usePathname } from "next/navigation";

// Ang portal at ang privacy notice ay may sarili nang layout
const HIDDEN_ON = ["/portal", "/consent"];

export function Footer() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <footer className="py-8 px-4 bg-emerald-950 text-center text-emerald-400 text-sm border-t border-emerald-900">
      <p>
        &copy; {new Date().getFullYear()} Iglesia ng Dios na Buhay kay Cristo Jesus. Founded 1954. SEC Reg. No. 13708
        (registered 1958).
      </p>
      <p className="mt-3">
        <a
          href="https://idbcj13708.online.church/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 underline underline-offset-4 hover:text-white"
        >
          Join Live Stream
        </a>
      </p>
    </footer>
  );
}
