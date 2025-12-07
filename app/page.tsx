import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">

      {/* NAVIGATION BAR */}
      <nav className="flex items-center justify-between p-4 border-b border-gray-200 shadow-sm">
        <div className="text-xl font-bold">
          Iglesia ng Dios na Buhay kay Cristo Jesus
        </div>

        <div className="flex gap-4">
          <Link href="/">
            <Button>Home</Button>
          </Link>

          <Link href="/about">
            <Button>About</Button>
          </Link>

          <Link href="/contact">
            <Button>Contact</Button>
          </Link>
        </div>
      </nav>

      {/* LOGO + NAME */}
      <div className="flex items-center gap-3 p-8">

        {/* Logo */}
        <div className="relative h-12 w-12 overflow-hidden rounded-full border border-gray-200">
          <Image
            src="/logo.png"
            alt="IDCBJ Logo"
            fill
            className="object-cover"
          />
        </div>

        {/* Church name */}
        <div className="text-lg font-bold tracking-wide">
          Iglesia ng Dios na Buhay kay Cristo Jesus
        </div>

      </div>

    </div>
  );
}
