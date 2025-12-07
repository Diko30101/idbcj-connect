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
          Standing firm on the original foundation laid in 1954.
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
              It was originally registered with the Securities and Exchange Commission (SEC) under 
              <strong> Registration No. 13708</strong>. We stand by this registration as the true, 
              original, and historical legal identity of the church.
            </p>
          </div>
        </div>

        {/* 2. THE TRANSITION & STAND */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Our Stand on Leadership</h2>
          <p className="text-gray-700 leading-relaxed text-justify">
            After the passing of Mr. Avelino C. Santiago in 1992, distinct groups emerged. 
            In 2008, a new entity was registered with the SEC under the name 
            <em>"THE PRESIDING MINISTER OF IGLESIA NG DIOS NA BUHAY KAY CRISTO JESUS"</em> (SEC CN2008458), 
            led by descendants of the founder.
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-6">
            <h3 className="font-bold text-blue-900 mb-2">We Remained Faithful</h3>
            <p className="text-blue-800 text-sm italic">
              "We, represented by idbcj.org and its affiliated locales (including Canada), 
              are the members who remained faithful to the original 1958 registration (SEC 13708), 
              doctrine, and leadership structure established by Mr. Avelino C. Santiago."
            </p>
            <p className="mt-4 text-blue-900 font-semibold text-sm">
              We did not join the new 2008 registration or the groups that departed from the original teachings.
            </p>
          </div>

          <p className="text-gray-700">
            We continue to actively worship, study the Bible, and spread the Gospel worldwide, 
            holding steadfast to the truth of God's Word without human changes in leadership structure.
          </p>
        </div>

        {/* 3. PROOF OF REGISTRATION (Placeholder) */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">Historical Document Archive</h3>
          <p className="text-gray-400 text-sm mb-4">
            (Scan of Original SEC 13708 Registration Paper to be uploaded here)
          </p>
          <Button variant="outline" disabled>View Original SEC 13708</Button>
        </div>

      </div>

      {/* --- FOOTER DISCLAIMER --- */}
      <footer className="bg-gray-900 text-white py-12 px-4 text-center mt-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          <p className="text-lg font-bold text-yellow-500 tracking-wide">
            ORIGINAL 1954 CHURCH – SEC REG. NO. 13708
          </p>
          <div className="h-px w-24 bg-gray-700 mx-auto"></div>
          <p className="text-gray-300">
            Founded by Avelino C. Santiago
          </p>
          <p className="text-sm text-gray-400 bg-gray-800 inline-block px-4 py-2 rounded-full">
            Not affiliated with the 2008 group (CN2008458) or Ruel Santiago
          </p>
          
          <div className="pt-8">
            <Link href="/">
              <Button variant="secondary" size="sm">Return Home</Button>
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}