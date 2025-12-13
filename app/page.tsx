import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact-form";
import { Navbar } from "@/components/navbar"; // <--- Import your new component

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      
      {/* 1. USE THE NEW NAVBAR COMPONENT */}
      <Navbar />

      {/* 2. HERO SECTION */}
      <section className="relative h-[550px] flex items-center justify-center text-center px-4 overflow-hidden">
        <Image 
          src="/background.jpg"
          alt="Church Worship"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-emerald-900/30 to-emerald-900/80" />

        <div className="relative z-10 max-w-4xl space-y-6 animate-in fade-in zoom-in duration-1000">
          <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-50 backdrop-blur-sm text-sm font-medium mb-2">
            Welcome to IDBCJ.ORG
          </div>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-md">
            Walking in Faith,<br/> Living in Truth
          </h1>
          <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-sm">
            The pillar and ground of the truth. Join us as we worship the Living God.
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Link href="/about">
              <Button className="h-12 px-8 text-lg bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-lg rounded-full">
                About Us
              </Button>
            </Link>
            <Link href="https://idbcj.online.church/">
              <Button variant="outline" className="h-12 px-8 text-lg text-white border-white bg-transparent hover:bg-white hover:text-emerald-900 rounded-full">
                Join Live Stream
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. FOUNDER SECTION */}
      <section className="py-20 px-6 bg-emerald-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/3 flex justify-center">
             <div className="relative w-56 h-72 md:w-64 md:h-80 shadow-2xl rounded-lg overflow-hidden border-4 border-white rotate-2 hover:rotate-0 transition duration-500">
                <Image src="/founder.jpg" alt="Mr. Avelino C. Santiago" fill className="object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-center py-2 text-xs backdrop-blur-sm">
                  Mr. Avelino C. Santiago
                </div>
             </div>
          </div>
          <div className="w-full md:w-2/3 space-y-6 text-center md:text-left">
            <h2 className="text-3xl font-bold text-emerald-900">Faithful to the Original Foundation</h2>
            <div className="h-1 w-20 bg-emerald-500 mx-auto md:mx-0 rounded-full"></div>
            <p className="text-lg text-gray-700 leading-relaxed">
              We, represented by <strong>idbcj.org</strong> and its affiliated locales, 
              are the members who remained faithful to the original <strong>registration (SEC 13708)</strong>, 
              doctrine, and leadership structure established by our founder, <strong>Mr. Avelino C. Santiago</strong>.
            </p>
            <div className="pt-2">
              <Link href="/about">
                 <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-100 rounded-full">
                   Read Our History
                 </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CARDS SECTION */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Connect With Us</h2>
            <p className="text-gray-500 mt-2">Discover how you can get involved.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition duration-300">
              <div className="relative h-56 w-full">
                <Image src="/rod.png" alt="Bible Study" fill className="object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <div className="p-6 bg-white">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">Our Sermons</h3>
                <p className="text-gray-600 mb-4">Listen to the word of God and grow in your faith journey.</p>
                <Link href="/sermons" className="text-emerald-600 font-bold hover:underline">Watch Now →</Link>
              </div>
            </div>
            {/* Card 2 */}
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition duration-300">
              <div className="relative h-56 w-full">
                <Image src="/founder.jpg" alt="History" fill className="object-contain bg-gray-200" />
              </div>
              <div className="p-6 bg-white">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">Our History</h3>
                <p className="text-gray-600 mb-4">Learn about our founder Avelino C. Santiago and our 1954 legacy.</p>
                <Link href="/about" className="text-emerald-600 font-bold hover:underline">Read More →</Link>
              </div>
            </div>
            {/* Card 3 */}
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition duration-300">
              <div className="relative h-56 w-full">
                <Image src="/sermon-pic.jpg" alt="Events" fill className="object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <div className="p-6 bg-white">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">Upcoming Events</h3>
                <p className="text-gray-600 mb-4">Join us for worship, bible studies, and community gatherings.</p>
                <Link href="/events" className="text-emerald-600 font-bold hover:underline">See Calendar →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CONTACT & FOOTER */}
      <section className="py-20 px-6 bg-slate-50 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Contact Us</h2>
          <p className="text-gray-600 mt-2">Reach out to our leadership directly.</p>
        </div>
        <ContactForm />
      </section>

      <footer className="py-8 bg-emerald-950 text-center text-emerald-400 text-sm border-t border-emerald-900">
        <p>&copy; 2025 Iglesia ng Dios na Buhay kay Cristo Jesus (SEC 13708). Est 1954</p> 
      </footer>

    </div>
  );
}