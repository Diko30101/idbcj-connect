import Link from "next/link";
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
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">About Us</h1>
        <p className="text-xl text-gray-500">Founded on Faith, Established by Love, Sustained by Hope</p>
      </section>

      {/* --- WHO WE ARE --- */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-slate-50 rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 space-y-6 text-center">
          <div className="h-1 w-20 bg-emerald-500 mx-auto rounded-full"></div>

          <p className="text-xl text-gray-800 leading-relaxed">
            We are a small church of Christians continuing the spiritual work of serving the living God. 
            Our purpose is to keep serving God and the brethren, who are overseen with full faithfulness 
            and deep fear of God.
          </p>

          <p className="text-lg text-gray-600 leading-relaxed border-t border-gray-200 pt-6">
            <em>
              Kami ay isang maliit na simbahan ng mga Cristiano na nagpapatuloy sa mga gawaing pang-espiritu. 
              Layunin naming magpatuloy sa paglilingkod sa Dios na buhay at sa mga kapatiran, na 
              pinapangasiwaan nang may buong katapatan at malaking pagkatakot sa Dios.
            </em>
          </p>

          <div className="pt-4">
            <Link href="/contact">
              <Button>Contact Us to Learn More</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- FAITH, LOVE, HOPE --- */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h3 className="text-2xl font-bold text-center mb-10">Our Core Values</h3>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">🙏</div>
            <h4 className="font-bold">Pananampalataya</h4>
            <p className="text-gray-500 text-xs mb-2">Faith</p>
            <p className="text-gray-600 text-sm">&ldquo;Work of faith&rdquo;</p>
          </div>
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">❤️</div>
            <h4 className="font-bold">Pag-ibig</h4>
            <p className="text-gray-500 text-xs mb-2">Love</p>
            <p className="text-gray-600 text-sm">&ldquo;Labour of love&rdquo;</p>
          </div>
          <div className="p-6 border rounded-xl">
            <div className="text-4xl mb-4">🌟</div>
            <h4 className="font-bold">Pag-asa</h4>
            <p className="text-gray-500 text-xs mb-2">Hope</p>
            <p className="text-gray-600 text-sm">&ldquo;Patience of hope&rdquo;</p>
          </div>
        </div>
        <p className="text-center text-gray-400 text-xs mt-6">
          1 Thessalonians 1:3 (KJV); see also 1 Corinthians 13:13
        </p>
      </section>

    </div>
  );
}