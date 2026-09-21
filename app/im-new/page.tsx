import Link from "next/link";
import Image from "next/image";
import { CalendarDays, ChevronDown, MapPin, MonitorPlay } from "lucide-react";
import { WORSHIP, worshipTimes } from "@/lib/worship";

export const metadata = {
  title: "I’m New | IDBCJ",
  description: "Plan your visit to IDBCJ: worship schedule, location, and how to join us online.",
};

// Ina-update kada oras para tama ang oras sa Alberta kapag nagpalit ng summer/winter time.
export const revalidate = 3600;

const pill =
  "font-display inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition";

export default function ImNewPage() {
  const t = worshipTimes();

  const faqs = [
    {
      q: "When is the worship service?",
      a: `Every ${WORSHIP.day} at ${WORSHIP.displayTime} Philippine time. For those in Alberta, Canada, that is ${t.alberta}.`,
    },
    {
      q: "Where is the church?",
      a: `${WORSHIP.location}. If you need directions, send us a message and we will be glad to help.`,
    },
    {
      q: "Can I watch the service online?",
      a: "Yes. Open our live stream link during worship time and you can worship with us from anywhere.",
    },
    {
      q: "How do I ask a question before I visit?",
      a: "Use the Contact Us form. Anyone can send a message; you do not need an account.",
    },
    {
      q: "What is the Members button for?",
      a: "It opens IDBCJ Connect, the portal for our members. Visitors do not need to sign in to visit the church or watch the live stream.",
    },
  ];

  return (
    <div className="bg-white font-serif text-slate-800">
      {/* HERO */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-3xl px-6 py-14 text-center">
          <Image src="/background.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/75 via-emerald-950/65 to-emerald-950/85" />
          <div className="relative z-10 max-w-2xl space-y-5">
            <span className="font-display inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-emerald-50 backdrop-blur-sm">
              First time here
            </span>
            <h1 className="font-display text-4xl font-bold text-white md:text-6xl">I&rsquo;m New</h1>
            <p className="text-lg text-emerald-50 md:text-xl">
              Plan your visit and find out how to worship with us, in person or online.
            </p>
          </div>
        </div>
      </section>

      {/* WELCOME */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <h2 className="font-display text-3xl font-bold text-emerald-950">You are welcome here</h2>
          <div className="mx-auto h-1 w-20 rounded-full bg-amber-400" />
          <p className="text-lg leading-relaxed text-slate-700">
            Whether this is your first time to visit or your first time to watch online, we are glad you are here. Below is
            what you need to know to join us.
          </p>
          <p className="text-base italic leading-relaxed text-slate-500">
            Kung ito ang unang pagkakataon mong dumalo o manood, malugod ka naming tinatanggap.
          </p>
        </div>
      </section>

      {/* WHEN / WHERE / ONLINE */}
      <section className="bg-[#F6F4EE] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-7 shadow-sm">
            <CalendarDays className="h-7 w-7 text-emerald-700" aria-hidden />
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">When we gather</h3>
            <p className="mt-3 text-slate-700">
              <span className="font-display font-semibold">
                {WORSHIP.day}, {WORSHIP.displayTime}
              </span>
              <span className="block text-sm text-slate-500">Philippine time</span>
            </p>
            <p className="mt-3 border-t border-emerald-900/10 pt-3 text-sm text-slate-600">
              Alberta, Canada: <span className="font-semibold">{t.alberta}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-7 shadow-sm">
            <MapPin className="h-7 w-7 text-emerald-700" aria-hidden />
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">Where to find us</h3>
            <p className="mt-3 text-slate-700">{WORSHIP.location}</p>
            <Link href="/contact" className="font-display mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
              Ask for directions &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-7 shadow-sm">
            <MonitorPlay className="h-7 w-7 text-emerald-700" aria-hidden />
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">Can&rsquo;t make it in person?</h3>
            <p className="mt-3 text-slate-700">Join our live stream during worship time.</p>
            <a
              href={WORSHIP.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pill} mt-4 bg-amber-400 text-emerald-950 hover:bg-amber-300`}
            >
              Join Live Stream
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="font-display text-3xl font-bold text-emerald-950">Common questions</h2>
            <p className="mt-2 text-slate-600">Short answers to what visitors ask first.</p>
          </div>
          <div className="divide-y divide-emerald-900/10 overflow-hidden rounded-2xl border border-emerald-900/10">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-white open:bg-[#F6F4EE]">
                <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-base font-semibold text-emerald-950 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-emerald-700 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-6 pb-5 leading-relaxed text-slate-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONNECT */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl bg-emerald-900 px-8 py-12 text-center text-white md:flex-row md:justify-between md:text-left">
          <div className="max-w-xl space-y-2">
            <h2 className="font-display text-2xl font-bold">Have a question?</h2>
            <p className="text-emerald-100">Send us a message and we will read it.</p>
          </div>
          <Link href="/contact" className={`${pill} shrink-0 bg-amber-400 text-emerald-950 hover:bg-amber-300`}>
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
