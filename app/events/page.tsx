import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Repeat, CalendarDays } from "lucide-react";
import { getSupabase, todayPH, fmtDate, LOCALITY_LABEL } from "@/lib/portal";
import { WORSHIP, WORSHIP_BATANGAS, WORSHIP_ALBERTA } from "@/lib/worship";
import type { Locality } from "@/lib/locality";

// Page is rebuilt at most once an hour so the "next Sunday" date stays current.
export const revalidate = 3600;

const PH_OFFSET_HOURS = 8; // Philippines is UTC+8 all year

// All three locales worship on Sunday, so one shared "next Sunday" date
// covers all of them — only the display time differs per locale (see LOCALES
// below), and lib/worship.ts only stores those as human display strings, not
// hour/minute numbers, so we don't compute a precise per-locale instant.
function nextSundayPH(now: Date): Date {
  const ph = new Date(now.getTime() + PH_OFFSET_HOURS * 3600 * 1000);
  const daysToSunday = (7 - ph.getUTCDay()) % 7;
  return new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + daysToSunday));
}

function fmtSundayDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(d);
}

const LOCALES: { title: string; location: string; times: string[]; streamUrl?: string }[] = [
  { title: WORSHIP.title, location: WORSHIP.location, times: [WORSHIP.displayTime], streamUrl: WORSHIP.streamUrl },
  { title: "Sunday Worship", location: WORSHIP_BATANGAS.location, times: WORSHIP_BATANGAS.displayTimes },
  { title: "Sunday Worship", location: WORSHIP_ALBERTA.location, times: [WORSHIP_ALBERTA.displayTime] },
];

type SpecialEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  locality: Locality | null;
  location: string | null;
  link: string | null;
};

export default async function EventsPage() {
  const nextSunday = nextSundayPH(new Date());
  const monthPH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(nextSunday).toUpperCase();
  const dayPH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" }).format(nextSunday);

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("events")
    .select("id, title, description, event_date, event_time, locality, location, link")
    .eq("published", true)
    .gte("event_date", todayPH())
    .order("event_date");
  const specialEvents = (data ?? []) as SpecialEvent[];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* --- HEADER --- */}
      <section className="bg-white py-12 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Upcoming Events</h1>
          <p className="text-gray-600 text-lg">Mark your calendars and join us in fellowship.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-12 px-6 w-full space-y-6">
        {/* --- WEEKLY WORSHIP, ALL 3 LOCALES --- */}
        {LOCALES.map((loc) => (
          <div key={loc.location} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row gap-6">
            <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg w-full sm:w-24 h-24 border border-emerald-100">
              <span className="text-sm font-bold tracking-widest uppercase">{monthPH}</span>
              <span className="text-4xl font-extrabold">{dayPH}</span>
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{loc.title}</h3>
              <p className="flex items-center gap-1 text-emerald-700 text-sm font-medium mb-3">
                <Repeat className="w-4 h-4" />
                Every Sunday
              </p>

              <div className="space-y-2 text-gray-600 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    {fmtSundayDate(nextSunday)}, {loc.times.join(" and ")} (local time)
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{loc.location}</p>
                </div>
              </div>

              {loc.streamUrl && (
                <div className="mt-5">
                  <Link href={loc.streamUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">Join Live Stream</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* --- SPECIAL EVENTS --- */}
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-10 mb-4">
            <CalendarDays className="w-6 h-6 text-emerald-700" />
            Special Events
          </h2>
          {specialEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Walang nakatakdang special event sa ngayon.
            </div>
          ) : (
            <div className="space-y-4">
              {specialEvents.map((e) => (
                <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-xl font-bold text-gray-900">{e.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>
                        {fmtDate(e.event_date)}
                        {e.event_time ? `, ${e.event_time}` : ""}
                      </p>
                    </div>
                    {(e.location || e.locality) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{e.location || (e.locality ? LOCALITY_LABEL[e.locality] : "")}</p>
                      </div>
                    )}
                  </div>
                  {e.description && <p className="mt-3 text-gray-700">{e.description}</p>}
                  {e.link && (
                    <div className="mt-4">
                      <Link href={e.link} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">Learn More</Button>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center bg-white p-8 rounded-xl border border-dashed border-gray-300">
          <h3 className="text-lg font-semibold text-gray-900">Don't see what you're looking for?</h3>
          <p className="text-gray-500 mb-4">Contact us to ask about specific schedules.</p>
          <Link href="/contact">
            <Button variant="outline">Contact Us</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
