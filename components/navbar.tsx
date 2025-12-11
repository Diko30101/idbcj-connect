"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react"; // Icons for the menu

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  // Function to close menu when a link is clicked
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-green-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* --- LOGO --- */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition" onClick={closeMenu}>
            <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-full border-2 border-emerald-100 shrink-0 shadow-sm">
              <Image src="/logo.png" alt="IDBCJ Logo" fill className="object-cover" />
            </div>
            <div className="text-sm md:text-base font-bold text-emerald-950 leading-tight max-w-[200px]">
              Iglesia ng Dios na Buhay kay Cristo Jesus
            </div>
          </Link>

          {/* --- DESKTOP MENU (Hidden on Mobile) --- */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-500 transition">
              Home
            </Link>

          {/* --- ADD THIS NEW LINK --- */}
          <Link href="/ministries" className="text-sm font-medium hover:text-emerald-600 transition-colors">
              Ministries
            </Link>
            <Link href="/sermons" className="text-sm font-semibold text-gray-600 hover:text-emerald-600 transition">
              Sermons
            </Link>
            <Link href="/about" className="text-sm font-semibold text-gray-600 hover:text-emerald-600 transition">
              Our History
            </Link>
            <Link href="/events" className="text-sm font-semibold text-gray-600 hover:text-emerald-600 transition">
              Events
            </Link>
            
            <div className="flex items-center gap-3 ml-4 border-l border-gray-200 pl-6">
              <Link href="/auth/login" className="text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1">
                <span>🔒</span> Login
              </Link>
              <Link href="/auth/login">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-full px-6">
                  Join Us
                </Button>
              </Link>
            </div>
          </div>

          {/* --- MOBILE MENU BUTTON (Visible only on Mobile) --- */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-emerald-900 hover:text-emerald-600 focus:outline-none p-2"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE FULL-SCREEN DROPDOWN --- */}
      {/* This section only appears when isOpen is true */}
      {isOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-green-100 shadow-xl animate-in slide-in-from-top-5 duration-300">
          <div className="flex flex-col p-6 space-y-4 text-center">
            
            <Link href="/" onClick={closeMenu} className="text-lg font-semibold text-emerald-900 py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg">
              Home
            </Link>

            {/* --- PASTE THE NEW LINK HERE --- */}
            <Link href="/ministries" onClick={closeMenu} className="text-lg font-semibold text-gray-600 py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg">
              Ministries
            </Link>
            <Link href="/sermons" onClick={closeMenu} className="text-lg font-semibold text-gray-600 py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg">
              Sermons
            </Link>
            <Link href="/about" onClick={closeMenu} className="text-lg font-semibold text-gray-600 py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg">
              Our History
            </Link>
            <Link href="/events" onClick={closeMenu} className="text-lg font-semibold text-gray-600 py-2 border-b border-gray-50 hover:bg-emerald-50 rounded-lg">
              Events
            </Link>

            <div className="pt-4 flex flex-col gap-3">
              <Link href="/auth/login" onClick={closeMenu}>
                <Button variant="outline" className="w-full border-emerald-600 text-emerald-700">
                  Member Login
                </Button>
              </Link>
              <Link href="/auth/login" onClick={closeMenu}>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Join Us
                </Button>
              </Link>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
}