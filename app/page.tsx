import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, MonitorPlay } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { WORSHIP, worshipTimes } from "@/lib/worship";

// Ina-update kada oras para tama ang oras sa Alberta kapag nagpalit ng summer/winter time.
export const revalidate = 3600;

const pill =
  "font-display inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition";

export default function Home() {
  const t = worshipTimes();

  return (
    <div className="flex min-h-screen flex-col bg-white font-serif text-slate-800">
      {/* 1. HERO */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-3xl px-6 py-16 text-center">
          <Image src="/background.jpg" alt="Church Worship" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/70 via-emerald-950/60 to-emerald-950/85" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <span className="font-display inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-emerald-50 backdrop-blur-sm">
              Welcome to IDBCJ.ORG
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white drop-shadow md:text-6xl">
              Walking in Faith,
              <br />
              Living in Truth
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-emerald-50 md:text-xl">
              The pillar and ground of the truth. Join us as we worship the Living God.
            </p>
            <p className="text-sm font-medium tracking-wide text-amber-200">1 Timothy 3:15 (ASV)</p>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link href="/im-new" className={`${pill} bg-amber-400 text-emerald-950 shadow-lg hover:bg-amber-300`}>
                Plan Your Visit
              </Link>
              <Link href="/auth/login" className={`${pill} border border-white/70 text-white hover:bg-white hover:text-emerald-950`}>
                Members Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PLAN YOUR VISIT */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-emerald-700">First time here?</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-emerald-950">You are welcome here</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-900/10 bg-[#F6F4EE] p-7">
              <CalendarDays className="h-7 w-7 text-emerald-700" aria-hidden />
              <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">When we gather</h3>
              <p className="mt-2 text-slate-700">
                Every {WORSHIP.day}, {WORSHIP.displayTime}
                <span className="block text-sm text-slate-500">Philippine time</span>
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Alberta, Canada: {t.alberta}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-[#F6F4EE] p-7">
              <MapPin className="h-7 w-7 text-emerald-700" aria-hidden />
              <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">Where to find us</h3>
              <p className="mt-2 text-slate-700">{WORSHIP.location}</p>
              <Link href="/contact" className="font-display mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
                Ask for directions &rarr;
              </Link>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-[#F6F4EE] p-7">
              <MonitorPlay className="h-7 w-7 text-emerald-700" aria-hidden />
              <h3 className="font-display mt-4 text-lg font-bold text-emerald-950">Can&rsquo;t come in person?</h3>
              <p className="mt-2 text-slate-700">Worship with us online through our live stream.</p>
              <a
                href={WORSHIP.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline"
              >
                Open the live stream &rarr;
              </a>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link href="/im-new" className="font-display text-sm font-semibold text-emerald-800 hover:underline">
              Everything you need for your first visit &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* 3. CONNECT WITH US */}
      <section className="bg-[#F6F4EE] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-emerald-950">Connect With Us</h2>
            <p className="mt-2 text-slate-600">Discover how you can get involved.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                img: "/rod.png",
                alt: "Bible Study",
                title: "Our Sermons",
                text: "Listen to the word of God and grow in your faith journey.",
                href: "/sermons",
                cta: "Watch Now",
                cover: true,
              },
              {
                img: "/logo-seal.png",
                alt: "IDBCJ logo",
                title: "Our Ministries",
                text: "Discover ways to serve and take part in the life of the church.",
                href: "/ministries",
                cta: "See Ministries",
                cover: false,
              },
              {
                img: "/sermon-pic.jpg",
                alt: "Events",
                title: "Upcoming Events",
                text: "Join us for worship, bible studies, and community gatherings.",
                href: "/events",
                cta: "See Calendar",
                cover: true,
              },
            ].map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="group overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-52 w-full">
                  <Image
                    src={c.img}
                    alt={c.alt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className={c.cover ? "object-cover transition duration-500 group-hover:scale-105" : "bg-emerald-50 object-contain p-6"}
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-bold text-emerald-950">{c.title}</h3>
                  <p className="mt-2 text-slate-600">{c.text}</p>
                  <span className="font-display mt-4 inline-block text-sm font-bold text-emerald-700 group-hover:underline">{c.cta} &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. FOUNDATION */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-12 md:flex-row">
          <div className="flex w-full justify-center md:w-1/3">
            <div className="relative h-72 w-56 overflow-hidden rounded-2xl border-4 border-white shadow-2xl md:h-80 md:w-64">
              <Image src="/founder.jpg" alt="Mr. Avelino C. Santiago" fill sizes="256px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 py-2 text-center text-xs text-white backdrop-blur-sm">
                Mr. Avelino C. Santiago
              </div>
            </div>
          </div>
          <div className="w-full space-y-5 text-center md:w-2/3 md:text-left">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-emerald-700">Our story</p>
            <h2 className="font-display text-3xl font-bold text-emerald-950">Our Foundation</h2>
            <div className="mx-auto h-1 w-20 rounded-full bg-amber-400 md:mx-0" />
            <p className="text-lg leading-relaxed text-slate-700">
              The <strong>Iglesia ng Dios na Buhay kay Cristo Jesus (IDBCJ)</strong> was founded in 1954 by{" "}
              <strong>Mr. Avelino C. Santiago</strong> and registered with the SEC in 1958 (<strong>SEC Reg. No. 13708</strong>).
              This website serves our members and affiliated locales.
            </p>
            <Link
              href="/history"
              className="font-display inline-flex rounded-full border border-emerald-800 px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-800 hover:text-white"
            >
              Read Our History
            </Link>
          </div>
        </div>
      </section>

      {/* 5. MEMBER PORTAL */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl bg-emerald-900 px-8 py-12 text-center text-white md:flex-row md:justify-between md:text-left">
          <div className="max-w-xl space-y-2">
            <h2 className="font-display text-2xl font-bold">For our members</h2>
            <p className="text-emerald-100">
              Sign in to IDBCJ Connect for announcements, ministries, prayer requests, and your member profile.
            </p>
          </div>
          <Link href="/auth/login" className={`${pill} shrink-0 bg-amber-400 text-emerald-950 hover:bg-amber-300`}>
            Members Login
          </Link>
        </div>
      </section>

      {/* 6. CONTACT */}
      <section className="border-t border-emerald-900/10 bg-[#F6F4EE] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <h2 className="font-display text-3xl font-bold text-emerald-950">Contact Us</h2>
          <p className="mt-2 text-slate-600">Reach out to our leadership directly.</p>
        </div>
        <ContactForm />
      </section>
    </div>
  );
}
