import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MinistriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">

       {/* --- BACK BUTTON --- */}
    <div className="w-full max-w-6xl mx-auto px-6 pt-6">
      <Link href="/">
        <Button variant="ghost" className="text-gray-600 hover:text-gray-900 pl-0 hover:bg-transparent">
          ← Back to Home
        </Button>
      </Link>
    </div>      

      {/* --- PAGE HEADER --- */}
      <section className="bg-white py-16 text-center shadow-sm border-b">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Our Ministries</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto px-4">
          "For even the Son of Man came not to be served but to serve."
          <br />
          <span className="text-sm text-gray-400 mt-2 block">- Mark 10:45</span>
        </p>
      </section>

      {/* --- LEADERSHIP / PASTOR BIO --- */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <div className="flex flex-col md:flex-row gap-10 items-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          {/* Photo Placeholder */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
            {/* You can replace '/pastor.jpg' with a real image in your public folder later */}
    <Image 
            src="/rod.png" 
            alt="Elder Bro. Rodelio Villaverde, Presiding Minister" 
            fill 
            className="object-cover"
          />
          </div>

          {/* Bio Text */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold text-gray-900">Elder Bro. Rodelio Villaverde</h3>
            <p className="text-blue-600 font-medium">Presiding Minister</p>
            <p className="text-gray-600 text-sm mt-1 mb-4">Fort McMurray, Alberta, Canada</p>
            <p className="text-gray-600 leading-relaxed mb-4">
              We are a small church of Christians serving the living God and the brethren. If you have 
              a question or a request we can help with, within our small ability, you are welcome to write to us.
            </p>
            <p className="text-gray-500 leading-relaxed italic">
              Kami ay maliit na simbahan ng mga Cristiano na naglilingkod sa Dios na buhay at sa mga 
              kapatiran. Kung may tanong o kahilingang maipaglilingkod sa abot ng aming maliit na 
              kakayahan, malaya kang sumulat sa amin.
            </p>
          </div>
        </div>

        {/* --- CONTACT BUTTON --- */}
        <div className="mt-6 text-center">
          <Link href="/contact">
            <Button variant="outline">Contact Leadership</Button>
          </Link>
        </div>

        {/* --- OTHER MINISTERS --- */}
        <div className="grid gap-6 md:grid-cols-2 mt-8">

          {/* Bro. Abondio Mangubat */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mangubat.jpg"
                alt="Bro. Abondio Mangubat, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Abondio Mangubat</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Magallanes, Cavite, Philippines</p>
            </div>
          </div>

          {/* Bro. Felicisimo Mangubat */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mangubat-felicisimo.jpg"
                alt="Bro. Felicisimo Mangubat, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Felicisimo Mangubat</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Sto. Tomas, Batangas, Philippines</p>
            </div>
          </div>

          {/* Bro. Jimmy Villaverde */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/villaverde-jimmy.jpg"
                alt="Bro. Jimmy Villaverde, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Jimmy Villaverde</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Lipa City, Batangas, Philippines</p>
            </div>
          </div>

          {/* Bro. Ariel Mencias */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mencias-ariel.jpg"
                alt="Bro. Ariel Mencias, Student Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Ariel Mencias</h3>
              <p className="text-blue-600 text-sm font-medium">Student Minister</p>
              <p className="text-gray-600 text-sm mt-1">Lipa City, Batangas, Philippines</p>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}