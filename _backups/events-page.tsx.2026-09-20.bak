import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react"; // Icons

export default function EventsPage() {
  
  // This is your Event Data. 
  // You can easily edit this list to change your church events.
  const events = [
    {
      id: 1,
      month: "DEC",
      day: "14",
      title: "Sunday Worship",
      time: "9:00 AM",
      location: "Medina, Magallanes, Cavite, Philippines",
      description: "Why the members of I.D.B.C.J. are entirely referred to as the chosen or elect"
    },
    {
      id: 2,
      month: "DEC",
      day: "21",
      title: "Sunday Worship",
      time: "9:00 AM",
      location: "Medina, Magallanes, Cavite",
      description: "The condition of the world (or worldly people) without Passover yet, and the person who has Passover, according to the Bible."
    },
    {
      id: 3,
      month: "DEC",
      day: "28",
      title: "Sunday Worship",
      time: "9:00 AM",
      location: "Medina, Magallanes, Cavite, Philippines",
      description: "The significant difference between the soul and the spirit according to biblical teachings."
    },
    {
      id: 4,
      month: "JAN",
      day: "01",
      title: "New Year 2026",
      time: "09:00 AM",
      location: "Sta. Teresita Sto. Tomas, Batangas, Philippines",
      description: "Thanks Giving Day!"
    }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      
      {/* --- HEADER --- */}
      <section className="bg-white py-12 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6">
           {/* Back Button */}
           <div className="mb-6">
            <Link href="/">
                <Button variant="ghost" className="text-gray-500 hover:text-gray-900 pl-0">
                ← Back to Home
                </Button>
            </Link>
           </div>
           
           <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Upcoming Events</h1>
           <p className="text-gray-600 text-lg">Mark your calendars and join us in fellowship.</p>
        </div>
      </section>

      {/* --- EVENTS LIST --- */}
      <section className="max-w-4xl mx-auto py-12 px-6 w-full">
        <div className="flex flex-col gap-6">
          
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow">
              
              {/* THE DATE BOX (Calendar Look) */}
              <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg w-full sm:w-24 h-24 border border-emerald-100">
                <span className="text-sm font-bold tracking-widest uppercase">{event.month}</span>
                <span className="text-4xl font-extrabold">{event.day}</span>
              </div>

              {/* EVENT DETAILS */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h3>
                
                <div className="flex flex-wrap gap-4 text-gray-500 text-sm mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {event.time}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed">
                  {event.description}
                </p>
              </div>

            </div>
          ))}

        </div>
        
        {/* Empty State / Call to Action */}
        <div className="mt-12 text-center bg-white p-8 rounded-xl border border-dashed border-gray-300">
            <h3 className="text-lg font-semibold text-gray-900">Don't see what you're looking for?</h3>
            <p className="text-gray-500 mb-4">Contact our office to ask about specific schedules.</p>
            <Link href="/contact">
                <Button variant="outline">Contact Us</Button>
            </Link>
        </div>

      </section>
    </div>
  );
}