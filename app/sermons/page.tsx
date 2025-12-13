"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, PlayCircle } from "lucide-react"; // Icons

// --- 1. MOCK DATABASE (Replace this with real data later) ---
const ALL_SERMONS = [
  {
    id: 1,
    title: "Walking in Faith, Not by Sight",
    speaker: "Elder Bro. Rod S. Villaverde",
    date: "December 9, 2025",
    series: "Faith Series",
    videoUrl: "https://www.youtube.com/embed/oEBwRr2aILc?si=ybehzjKuT8KLjmB5", // Replace with real YouTube Embed Link
    description: "Discover what it means to truly trust God when the path ahead is unclear.",
    thumbnail: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2073&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "The Power of Prayer",
    speaker: "Bro. Abon Mangubat",
    date: "November 26, 2025",
    series: "Prayer Works",
    videoUrl: "https://www.youtube.com/watch?v=FwhLi7YOOSs",
    description: "Prayer is not just asking; it is connecting with the heart of the Father.",
    thumbnail: "https://images.unsplash.com/photo-1510936111840-65e151ad71bb?q=80&w=2090&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Living a Life of Gratitude",
    speaker: "Bro. Abon Mangubat",
    date: "November 19, 2025",
    series: "Thanksgiving",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    description: "Gratitude turns what we have into enough. Learn the secret of contentment.",
    thumbnail: "https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 4,
    title: "Overcoming Fear with Love",
    speaker: "Bro. Abon Mangubat",
    date: "November 12, 2025",
    series: "Freedom",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    description: "Perfect love casts out fear. How to stand strong in difficult times.",
    thumbnail: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=2070&auto=format&fit=crop"
  },
];

export default function SermonsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Logic to filter sermons based on search
  const filteredSermons = ALL_SERMONS.filter((sermon) =>
    sermon.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sermon.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // The latest sermon is always the first one in the list
  const featuredSermon = ALL_SERMONS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* --- NAVIGATION (Simple) --- */}
      <nav className="bg-white border-b border-emerald-100 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-bold text-emerald-900 text-lg">
            ← Back to Home
          </Link>
          <div className="font-semibold text-emerald-800">Sermon Archive</div>
        </div>
      </nav>

      {/* --- FEATURED SERMON (Hero Section) --- */}
      <section className="bg-emerald-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          
          {/* Text Info */}
          <div className="space-y-6">
            <div className="inline-block bg-emerald-700 text-emerald-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Latest Message
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              {featuredSermon.title}
            </h1>
            <div className="flex items-center gap-4 text-emerald-200 text-sm">
              <div className="flex items-center gap-1">
                <User size={16} /> {featuredSermon.speaker}
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={16} /> {featuredSermon.date}
              </div>
            </div>
            <p className="text-emerald-100 text-lg leading-relaxed">
              {featuredSermon.description}
            </p>
            <div className="pt-2">
               <a href="#video-player" className="inline-block">
                <Button className="bg-white text-emerald-900 hover:bg-emerald-50 h-12 px-8 font-bold text-lg">
                  <PlayCircle className="mr-2 h-5 w-5" /> Watch Now
                </Button>
               </a>
            </div>
          </div>

          {/* Video Player */}
          <div id="video-player" className="rounded-xl overflow-hidden shadow-2xl border-4 border-emerald-700 bg-black aspect-video">
            <iframe 
              width="100%" 
              height="100%" 
              src={featuredSermon.videoUrl} 
              title="Sermon Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>

        </div>
      </section>

      {/* --- SEARCH & ARCHIVE --- */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
        
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <h2 className="text-3xl font-bold text-gray-900">Recent Messages</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search by title or speaker..." 
              className="pl-10 border-gray-300 focus:border-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Sermon Grid */}
        {filteredSermons.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-8">
            {filteredSermons.map((sermon) => (
              <div key={sermon.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col">
                {/* Thumbnail */}
                <div className="relative h-48 bg-gray-200">
                  <img src={sermon.thumbnail} alt={sermon.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition" />
                  <PlayCircle className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 h-12 w-12 drop-shadow-lg" />
                </div>
                
                {/* Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="text-xs font-bold text-emerald-600 mb-2 uppercase tracking-wider">
                    {sermon.series}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                    {sermon.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">
                    {sermon.description}
                  </p>
                  
                  <div className="border-t pt-4 flex justify-between items-center text-xs text-gray-400">
                    <span>{sermon.speaker}</span>
                    <span>{sermon.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl">No sermons found matching "{searchTerm}"</p>
            <Button 
              variant="link" 
              onClick={() => setSearchTerm("")}
              className="text-emerald-600"
            >
              Clear Search
            </Button>
          </div>
        )}

      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-emerald-950 text-emerald-400/60 py-8 text-center text-sm">
        &copy; 2025 Iglesia ng Dios na Buhay kay Cristo Jesus
      </footer>

    </div>
  );
}