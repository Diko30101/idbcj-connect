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
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Church Leadership</h2>
        
        <div className="flex flex-col md:flex-row gap-10 items-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          {/* Photo Placeholder */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
            {/* You can replace '/pastor.jpg' with a real image in your public folder later */}
    <Image 
            src="/rod.png" 
            alt="Minister Rodelio S. Villaverde" 
            fill 
            className="object-cover"
          />
          </div>

          {/* Bio Text */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold text-gray-900">Minister [Rodelio S. Villaverde]</h3>
            <p className="text-blue-600 font-medium mb-4">Elder Pastor</p>
            <p className="text-gray-600 leading-relaxed mb-6">
              Welcome to IDBCJ. Our goal is to spread the word of God and build a community 
              founded on faith, truth, and love. We are dedicated to shepherding the flock 
              and ensuring that every member feels at home.
            </p>
            <Link href="/contact">
              <Button variant="outline">Contact Leadership</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- MINISTRIES GRID --- */}
      <section className="max-w-6xl mx-auto py-12 px-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-10 text-center">Get Involved</h2>
        
        <div className="grid gap-8 md:grid-cols-3">
          
          {/* Card 1: Music */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4 text-2xl">
              🎵
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Music Ministry</h3>
            <p className="text-gray-600 mb-4">
              Join the choir or worship team to lead the congregation in praise through music and song.
            </p>
          </div>

          {/* Card 2: Youth */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4 text-2xl">
              🔥
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Youth Ministry</h3>
            <p className="text-gray-600 mb-4">
              Building the next generation of believers through bible study, activities, and fellowship.
            </p>
          </div>

          {/* Card 3: Ushers/Welcoming */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 text-2xl">
              🤝
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Ushers & Greeters</h3>
            <p className="text-gray-600 mb-4">
              Be the first smile people see. Help welcome guests and maintain order during services.
            </p>
          </div>

           {/* Card 4: Sunday School */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 text-2xl">
              📖
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sunday School</h3>
            <p className="text-gray-600 mb-4">
              Teaching children the foundations of the bible in a fun and engaging environment.
            </p>
          </div>

        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <p className="text-lg text-gray-600 mb-4">Want to serve in one of these areas?</p>
          <Link href="/contact">
             <Button size="lg">Join a Ministry</Button>
          </Link>
        </div>
      </section>

        {/* --- BOTTOM BACK BUTTON --- */}
      <div className="py-10 text-center">
        <Link href="/">
          <Button variant="outline">Return to Home Page</Button>
        </Link>
      </div>

    </div>
  );
}