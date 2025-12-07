import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      
      {/* --- RESPONSIVE NAVIGATION BAR --- */}
      {/* 'flex-col' means stack vertically by default (Mobile) */}
      {/* 'md:flex-row' means switch to side-by-side on Medium screens (Tablets/Laptops) */}
      <nav className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 border-b border-gray-100 shadow-sm gap-4">
        
        {/* LOGO AND NAME */}
        <div className="flex items-center gap-3 text-center md:text-left">
          {/* The Logo Image - Shrinks slightly on mobile to fit better */}
          <div className="relative h-10 w-10 md:h-12 md:w-12 overflow-hidden rounded-full border border-gray-200 shrink-0">
             <Image 
               src="/logo.png" 
               alt="IDBCJ Logo" 
               fill 
               className="object-cover"
             />
          </div>
          
          {/* The Church Name */}
          <div className="text-base md:text-lg font-bold text-gray-800 leading-tight">
            Iglesia ng Dios na Buhay kay Cristo Jesus
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex w-full md:w-auto gap-3 justify-center">
          <Link href="/sign-in" className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto">Member Login</Button>
          </Link>
          <Link href="/sign-in" className="w-full md:w-auto">
            <Button className="w-full md:w-auto">Join Us</Button>
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="flex flex-col items-center justify-center text-center py-16 md:py-24 px-4 bg-slate-50">
        
        {/* Big Logo */}
        <div className="mb-6 md:mb-8 relative w-24 h-24 md:w-32 md:h-32">
           <Image 
             src="/logo.png" 
             alt="IDBCJ Logo" 
             fill
             className="object-contain"
           />
        </div>

        {/* Responsive Text Sizes */}
        <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-4 md:mb-6">
          Welcome Home
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-8 md:mb-10 px-2">
          We are a community dedicated to faith, hope, and love. 
          Whether you are new to the area or looking for a place to belong, 
          you are welcome here.
        </p>
        <div className="flex gap-4 w-full md:w-auto justify-center">
          <Link href="/sign-in" className="w-full md:w-auto">
            <Button className="h-12 px-8 text-lg w-full md:w-auto">Plan a Visit</Button>
          </Link>
        </div>
      </section>

      {/* --- SERVICE TIMES (Responsive Grid) --- */}
      <section className="py-12 md:py-20 px-4 md:px-6">
        {/* grid-cols-1 (Mobile) -> md:grid-cols-2 (Desktop) */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Service Times</h2>
            <ul className="space-y-3 text-base md:text-lg text-gray-600">
              <li className="flex justify-between border-b pb-2 border-gray-50 last:border-0">
                <span>Sunday Worship</span>
                <span className="font-semibold">10:00 AM</span>
              </li>
              <li className="flex justify-between border-b pb-2 border-gray-50 last:border-0">
                <span>Wednesday Bible Study</span>
                <span className="font-semibold">7:00 PM</span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Visit Us</h2>
            <p className="text-base md:text-lg text-gray-600 mb-4">
              123 Faith Avenue<br />
              Cityname, State 54321
            </p>
            <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
              (Map View Placeholder)
            </div>
          </div>

        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-8 md:py-10 text-center text-gray-500 text-xs md:text-sm border-t px-4">
        &copy; 2025 Iglesia ng Dios na Buhay kay Cristo Jesus. All rights reserved.
      </footer>

    </div>
  );
}