import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact-form";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      
      {/* --- NAVIGATION BAR --- */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between p-4 md:px-8 border-b border-green-100 shadow-sm">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition mb-4 md:mb-0">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-emerald-100 shrink-0 shadow-sm">
             <Image src="/logo.png" alt="IDBCJ Logo" fill className="object-cover" />
          </div>
          <div className="text-sm md:text-base font-bold text-emerald-950 leading-tight max-w-[220px]">
            Iglesia ng Dios na Buhay kay Cristo Jesus
          </div>
        </Link>

        {/* MENU (Now includes Member Login) */}
        <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-semibold text-gray-600">
          <Link href="/" className="text-emerald-700">Home</Link>
          <Link href="/sermons" className="hover:text-emerald-600 transition">Sermons</Link>
          <Link href="/about" className="hover:text-emerald-600 transition">Our History</Link>
          <Link href="/events" className="hover:text-emerald-600 transition">Events</Link>
          
          {/* Moved Member Login Here */}
          <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1 border-l border-gray-300 pl-6 ml-2">
            <span>🔒</span>Login
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION (Background Image) --- */}
      <section className="relative h-[550px] flex items-center justify-center text-center px-4 overflow-hidden">
        {/* Background Image */}
        <Image 
          src="/background.jpg"
          alt="Church Worship"
          fill
          className="object-cover"
          priority
        />
        {/* Green Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-emerald-900/30 to-emerald-900/80" />

        {/* Text Content */}
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
          
          {/* HERO BUTTONS (Updated) */}
          <div className="flex gap-4 justify-center pt-4">
            
            {/* JOIN US Button (Moved here) */}
            <Link href="/auth/login">
              <Button className="h-12 px-8 text-lg bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-lg">
                Join Us
              </Button>
            </Link>

            {/* Watch Sermons Button */}
            <Link href="/sermons">
              <Button variant="outline" className="h-12 px-8 text-lg text-white border-white bg-transparent hover:bg-white hover:text-emerald-900">
                Watch Sermons
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- MISSION STATEMENT (Founder Portrait Section) --- */}
      <section className="py-20 px-6 bg-emerald-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          
          {/* PHOTO COLUMN */}
          <div className="w-full md:w-1/3 flex justify-center">
             <div className="relative w-56 h-72 md:w-64 md:h-80 shadow-2xl rounded-lg overflow-hidden border-4 border-white rotate-2 hover:rotate-0 transition duration-500">
                <Image 
                  src="/founder.jpg" 
                  alt="Mr. Avelino C. Santiago" 
                  fill 
                  className="object-cover" 
                />
                
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-center py-2 text-xs backdrop-blur-sm">
                  Mr. Avelino C. Santiago
                </div>
             </div>
          </div>

          {/* TEXT COLUMN */}
          <div className="w-full md:w-2/3 space-y-6 text-center md:text-left">
            <h2 className="text-3xl font-bold text-emerald-900">Faithful to the Original Foundation</h2>
            <div className="h-1 w-20 bg-emerald-500 mx-auto md:mx-0 rounded-full"></div>
            <p className="text-lg text-gray-700 leading-relaxed">
              We, represented by <strong>idbcj.org</strong> and its affiliated locales (including Canada), 
              are the members who remained faithful to the original <strong>1954 registration (SEC 13708)</strong>, 
              doctrine, and leadership structure established by our founder, <strong>Mr. Avelino C. Santiago</strong>.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              We believe the true Church of the Living God remains steadfast in the truth 
              of God's Word without human changes in leadership. We continue to actively 
              worship, study the Bible, and spread the Gospel worldwide.
            </p>
            <div className="pt-2">
              <Link href="/about">
                 <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-100">
                   Read Our History
                 </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- CARDS SECTION (Ministries) --- */}
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
                <Image src="https://images.unsplash.com/photo-1510936111840-65e151ad71bb?q=80&w=2090&auto=format&fit=crop" alt="Bible Study" fill className="object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <div className="p-6 bg-white">
                <h3 className="text-xl font-bold text-emerald-900 mb-2">Our Sermons</h3>
                <p className="text-gray-600 mb-4">Listen to the word of God and grow in your faith journey.</p>
                <Link href="/sermons" className="text-emerald-600 font-bold hover:underline">Listen Now →</Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition duration-300">
              <div className="relative h-56 w-full">
                <Image src="/founder.jpg" alt="History" fill className="object-cover object-top group-hover:scale-105 transition duration-500" />
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
                <Image src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=2070&auto=format&fit=crop" alt="Events" fill className="object-cover group-hover:scale-105 transition duration-500" />
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

      {/* --- SERVICE TIMES & LOCATION --- */}
      <section className="py-20 px-6 bg-emerald-900 text-white">
        <div className="max-w-4xl mx-auto grid gap-10 md:grid-cols-2 items-center">
          
          <div className="bg-emerald-800/50 p-8 rounded-2xl backdrop-blur-sm border border-emerald-700">
            <h2 className="text-2xl font-bold mb-6 text-emerald-100">Service Times</h2>
            <ul className="space-y-4 text-lg text-emerald-50">
              <li className="flex justify-between border-b border-emerald-700 pb-2">
                <span>Sunday Worship</span>
                <span className="font-bold">10:00 AM</span>
              </li>
              <li className="flex justify-between border-b border-emerald-700 pb-2">
                <span>Wednesday Bible Study</span>
                <span className="font-bold">7:00 PM</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-3xl font-bold">Join Us This Week</h2>
            <p className="text-emerald-100 text-lg">
              We would love to see you. Parking is available and we have programs for all ages.
            </p>
            <div className="text-xl font-semibold mt-4">
              123 Faith Avenue<br />
              Cityname, State 54321
            </div>
            <Button className="mt-4 bg-white text-emerald-900 hover:bg-gray-100 font-bold">
              Get Directions
            </Button>
          </div>

        </div>
      </section>

      {/* --- CONTACT SECTION --- */}
      <section className="py-20 px-6 bg-slate-50 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Contact Us</h2>
          <p className="text-gray-600 mt-2">
            Reach out to our leadership directly. Your messages are sent securely to our email.
          </p>
        </div>
        
        <ContactForm />
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-8 bg-emerald-950 text-center text-emerald-400 text-sm border-t border-emerald-900">
        <p>&copy; 2025 Iglesia ng Dios na Buhay kay Cristo Jesus (SEC 13708).</p> 
        <p className="mt-1 opacity-60">Founded 1954. All rights reserved.</p>
      </footer>

    </div>
  );
}