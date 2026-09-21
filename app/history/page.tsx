import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">

      {/* --- HERO HEADER --- */}
      <section className="bg-white border-b py-16 text-center px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Our History & Legacy
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Standing firm on the foundation laid in 1954.
        </p>
      </section>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        
        {/* 1. FOUNDATION SECTION */}
        <div className="grid md:grid-cols-3 gap-8 items-start">
          
          {/* Founder Image Column */}
          <div className="md:col-span-1 flex flex-col items-center">
            <div className="relative w-48 h-64 bg-gray-200 rounded-lg overflow-hidden shadow-lg border-4 border-white">
              {/* This is the image that caused the error - it will work now! */}
              <Image 
                src="/founder.jpg" 
                alt="Mr. Avelino C. Santiago"
                fill
                className="object-cover"
              />
            </div>
            <p className="mt-3 text-sm font-bold text-gray-800">Mr. Avelino C. Santiago</p>
            <p className="text-xs text-gray-500">Founding Minister (1954)</p>
          </div>

          {/* Text Column */}
          <div className="md:col-span-2 space-y-4 text-gray-700 leading-relaxed text-justify">
            <h2 className="text-2xl font-bold text-blue-900">The Foundation (1954)</h2>
            <p>
              The <strong>Church of the Living God in Christ Jesus</strong> was founded in 1954 by 
              <strong> Mr. Avelino C. Santiago</strong> in Sampaloc, San Rafael, Bulacan.
            </p>
            <p>
              Although the church began in 1954, it was officially registered with the Securities and Exchange Commission (SEC) in 1958 under 
              <strong> Registration No. 13708</strong>.
            </p>
          </div>
        </div>

        {/* 2. WHO WE ARE TODAY */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Who We Are Today</h2>
          <p className="text-gray-700 leading-relaxed text-justify">
            We continue to actively worship, study the Bible, and spread the Gospel worldwide, 
            holding steadfast to the truth of God's Word.
          </p>
        </div>

      </div>

    </div>
  );
}