import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      
      {/* --- BACK BUTTON (Top Left) --- */}
      <div className="max-w-6xl mx-auto px-6 pt-8">
        <Link href="/">
          <Button variant="ghost" className="text-gray-600 hover:text-gray-900 pl-0 hover:bg-transparent">
            ← Back to Home
          </Button>
        </Link>
      </div>

      {/* --- PAGE TITLE --- */}
      <section className="text-center py-10 px-4">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Our History & Legacy</h1>
        <p className="text-xl text-gray-500">Founded on Truth, Established in Love</p>
      </section>

      {/* --- FOUNDER SECTION --- */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-slate-50 rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-12 items-center">
          
          {/* Founder Image */}
          <div className="relative w-full md:w-1/3 aspect-[3/4] rounded-xl overflow-hidden shadow-lg border-4 border-white">
            <Image 
              src="/founder.jpg"  // <--- Make sure founder.jpg is in your public folder
              alt="Founder Avelino C. Santiago"
              fill
              className="object-cover"
            />
          </div>

          {/* History Text */}
          <div className="md:w-2/3 space-y-6">
            <div className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Est. 1954
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900">
              The Foundation
            </h2>
            
            <p className="text-lg text-gray-700 leading-relaxed">
              The <strong>Iglesia ng Dios na Buhay kay Cristo Jesus</strong> (IDBCJ) traces its roots back to 1954. 
              It was established through the dedication and spiritual leadership of our founder, 
              <strong> Elder Bro. Avelino C. Santiago</strong>.
            </p>

            <p className="text-lg text-gray-700 leading-relaxed">
              From humble beginnings, the church has grown into a vibrant community dedicated to spreading 
              the Gospel and living out the teachings of Christ. We remain faithful to the original 
              registration (SEC 13708), doctrine, and leadership structure established by our founder.
            </p>

            <div className="pt-4">
              <Link href="/contact">
                <Button>Contact Us to Learn More</Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* --- TIMELINE / VALUES (Optional) --- */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h3 className="text-2xl font-bold text-center mb-10">Our Core Values</h3>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">🙏</div>
            <h4 className="font-bold mb-2">Faith</h4>
            <p className="text-gray-600 text-sm">Unwavering trust in God's plan and His holy word.</p>
          </div>
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">📖</div>
            <h4 className="font-bold mb-2">Truth</h4>
            <p className="text-gray-600 text-sm">Upholding the original doctrines and teachings.</p>
          </div>
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">❤️</div>
            <h4 className="font-bold mb-2">Love</h4>
            <p className="text-gray-600 text-sm">Serving one another and our community with compassion.</p>
          </div>
        </div>
      </section>

    </div>
  );
}