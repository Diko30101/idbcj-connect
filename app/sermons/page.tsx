"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, Calendar, User } from "lucide-react";

// --- SERMON DATA ---
const sermonsData = [
  {
    id: 1,
    title: "Walking in Faith, Not by Sight",
    speaker: "Elder Bro. Rod S. Villaverde",
    date: "December 9, 2025",
    category: "FAITH SERIES",
    description: "Discover what it means to truly trust God when the path ahead is unclear. We explore 2 Corinthians 5:7 and learn how to navigate life's challenges through spiritual vision.",
    videoId: "oEBwRr2aILc", // Replace with real YouTube ID
  },
  {
    id: 2,
    title: "The Power of Prayer",
    speaker: "Pastor John Doe",
    date: "December 2, 2025",
    category: "PRAYER WORKS",
    description: "Prayer is not just asking for things; it is a conversation with the Creator. Learn how to deepen your prayer life and see real change.",
    videoId: "FwhLi7YOOSs",
  },
  {
    id: 3,
    title: "Living a Life of Gratitude",
    speaker: "Sis. Jane Smith",
    date: "November 25, 2025",
    category: "THANKSGIVING",
    description: "Gratitude changes our attitude. In this message, we look at how being thankful in all circumstances can transform your mental and spiritual health.",
    videoId: "zRlU0GOMMX0",
  },
];

export default function SermonsPage() {
  const [activeSermon, setActiveSermon] = useState(sermonsData[0]);

  // Handle clicking a card at the bottom
  const handleSermonClick = (sermon: typeof sermonsData[0]) => {
    setActiveSermon(sermon);
    scrollToPlayer();
  };

  // Scroll to the video player
  const scrollToPlayer = () => {
    const player = document.getElementById("main-video-player");
    if (player) {
      player.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* --- HERO SECTION --- */}
      <section className="bg-emerald-900 text-white py-12 px-4 md:px-12 transition-colors duration-500">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Side: Text Info */}
          <div className="space-y-6">
            <span className="inline-block px-3 py-1 bg-emerald-800 text-emerald-100 text-xs font-bold tracking-wider rounded-full uppercase">
              {activeSermon.category}
            </span>
            
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              {activeSermon.title}
            </h1>
            
            <div className="flex flex-wrap gap-4 text-emerald-100 text-sm">
              <div className="flex items-center gap-2">
                <User size={16} />
                {activeSermon.speaker}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                {activeSermon.date}
              </div>
            </div>

            <p className="text-lg text-emerald-50 leading-relaxed max-w-xl">
              {activeSermon.description}
            </p>

            {/* Watch Now Button (Scrolls to player) */}
            <Button 
              onClick={scrollToPlayer}
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-8 py-6 text-lg rounded-full"
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Watch Now
            </Button>
          </div>

          {/* Right Side: The Video Player */}
          {/* We added an ID here so the button can find it */}
          <div id="main-video-player" className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-emerald-800/50">
            <iframe 
              width="100%" 
              height="100%" 
              // --- CHANGE IS HERE: Removed "?autoplay=1" ---
              src={`https://www.youtube.com/embed/${activeSermon.videoId}`} 
              title="YouTube video player" 
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>

        </div>
      </section>


      {/* --- RECENT MESSAGES GRID --- */}
      <section className="max-w-7xl mx-auto py-16 px-6">
        <div className="flex justify-between items-end mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Recent Messages</h2>
          
          <div className="hidden md:block">
             <input 
               type="text" 
               placeholder="Search by title or speaker..." 
               className="px-4 py-2 border rounded-lg text-sm w-64"
             />
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          
          {sermonsData.map((sermon) => (
            <div 
              key={sermon.id}
              onClick={() => handleSermonClick(sermon)}
              className={`
                group cursor-pointer bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 
                hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1
                ${activeSermon.id === sermon.id ? 'ring-2 ring-emerald-600' : ''}
              `}
            >
              {/* Thumbnail Area */}
              <div className="relative h-48 bg-gray-200 group-hover:opacity-90 transition-opacity">
                <img 
                  src={`https://img.youtube.com/vi/${sermon.videoId}/hqdefault.jpg`} 
                  alt={sermon.title}
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                    <PlayCircle className="w-8 h-8 text-emerald-700" />
                  </div>
                </div>

                {activeSermon.id === sermon.id && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                    SELECTED
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-5">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  {sermon.category}
                </span>
                <h3 className="font-bold text-gray-900 mt-2 text-lg line-clamp-2 group-hover:text-emerald-700">
                  {sermon.title}
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {sermon.description}
                </p>
              </div>
            </div>
          ))}

        </div>
      </section>

    </div>
  );
}