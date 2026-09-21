import Link from "next/link";
import Image from "next/image";
import { CalendarDays, ChevronDown, MapPin, MonitorPlay } from "lucide-react";
import { WORSHIP, WORSHIP_ALBERTA, WORSHIP_BATANGAS } from "@/lib/worship";

export const metadata = {
  title: "I’m New | IDBCJ",
  description: "Plan your visit to IDBCJ: worship schedule, location, and how to join us online.",
};

const pill =
  "font-display inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition";

export default function ImNewPage() {
  const faqs = [
    {
      q: "When is the worship service?",
      a: `In Medina, Magallanes, Cavite, we worship every ${WORSHIP.day} at ${WORSHIP.displayTime}. In Sta. Teresita, Sto. Tomas, Batangas, we worship every ${WORSHIP_BATANGAS.day} at ${WORSHIP_BATANGAS.displayTimes.join(" and ")}. In Fort McMurray, Alberta, we worship every ${WORSHIP_ALBERTA.day} at ${WORSHIP_ALBERTA.displayTime}. Times are local to each place.`,
    },
    {
      q: "Where is the church?",
      a: `${WORSHIP.location}; ${WORSHIP_BATANGAS.location}; and ${WORSHIP_ALBERTA.location}. If you need directions, send us a message and we will be glad to help.`,
    },
    {
      q: "Can I watch the service online?",
      a: "Yes. The Sunday worship in Medina is livestreamed at the same time on the IDBCJ YouTube channel and our online church website. It is also shown in our private Facebook group, which is open to group members only.",
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
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-800/55 via-emerald-700/45 to-emerald-800/75" />
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
          <h2 className="font-display text-3xl font-bold text-emerald-800">You are welcome here</h2>
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
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-800">When we gather</h3>
            <p className="mt-3 text-slate-700">
              <span className="font-display font-semibold">Medina, Magallanes, Cavite</span>
              <span className="block">
                Every {WORSHIP.day}, {WORSHIP.displayTime}
              </span>
            </p>
            <p className="mt-3 border-t border-emerald-600/10 pt-3 text-slate-700">
              <span className="font-display font-semibold">Sta. Teresita, Sto. Tomas, Batangas</span>
              <span className="block">
                Every {WORSHIP_BATANGAS.day}, {WORSHIP_BATANGAS.displayTimes.join(" and ")}
              </span>
            </p>
            <p className="mt-3 border-t border-emerald-600/10 pt-3 text-slate-700">
              <span className="font-display font-semibold">Fort McMurray, Alberta</span>
              <span className="block">
                Every {WORSHIP_ALBERTA.day}, {WORSHIP_ALBERTA.displayTime}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-7 shadow-sm">
            <MapPin className="h-7 w-7 text-emerald-700" aria-hidden />
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-800">Where to find us</h3>
            <p className="mt-3 text-slate-700">{WORSHIP.location}</p>
            <p className="mt-1 text-slate-700">{WORSHIP_BATANGAS.location}</p>
            <p className="mt-1 text-slate-700">{WORSHIP_ALBERTA.location}</p>
            <Link href="/contact" className="font-display mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
              Ask for directions &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-7 shadow-sm">
            <MonitorPlay className="h-7 w-7 text-emerald-700" aria-hidden />
            <h3 className="font-display mt-4 text-lg font-bold text-emerald-800">Can&rsquo;t make it in person?</h3>
            <p className="mt-3 text-slate-700">
              Join the Medina worship online. It is livestreamed on the IDBCJ YouTube channel and our online church website. The Facebook group livestream is for group members only.
            </p>
            <a
              href={WORSHIP.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pill} mt-4 bg-amber-400 text-emerald-800 hover:bg-amber-300`}
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
            <h2 className="font-display text-3xl font-bold text-emerald-800">Common questions</h2>
            <p className="mt-2 text-slate-600">Short answers to what visitors ask first.</p>
          </div>
          <div className="divide-y divide-emerald-900/10 overflow-hidden rounded-2xl border border-emerald-900/10">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-white open:bg-[#F6F4EE]">
                <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-base font-semibold text-emerald-800 [&::-webkit-details-marker]:hidden">
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
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl bg-emerald-700 px-8 py-12 text-center text-white md:flex-row md:justify-between md:text-left">
          <div className="max-w-xl space-y-2">
            <h2 className="font-display text-2xl font-bold">Have a question?</h2>
            <p className="text-emerald-100">Send us a message and we will read it.</p>
          </div>
          <Link href="/contact" className={`${pill} shrink-0 bg-amber-400 text-emerald-800 hover:bg-amber-300`}>
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
