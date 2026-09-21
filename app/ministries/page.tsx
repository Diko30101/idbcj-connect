import Image from "next/image";

export default function MinistriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">

      {/* --- PAGE HEADER --- */}
      <section className="bg-white py-12 text-center shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <p className="text-xl text-gray-600">
            &ldquo;For the Son of man also came not to be ministered unto, but to minister, and to give
            his life a ransom for many.&rdquo;
            <span className="text-sm text-gray-400 mt-2 block">Mark 10:45 (American Standard Version, 1901)</span>
          </p>
          <p className="text-lg text-gray-500 italic">
            &ldquo;Sapagka&apos;t ang Anak ng tao rin naman ay hindi naparito upang paglingkuran, kundi upang
            maglingkod, at ibigay ang kaniyang buhay na pangtubos sa marami.&rdquo;
            <span className="text-sm not-italic text-gray-400 mt-2 block">Marcos 10:45 (Ang Biblia)</span>
          </p>
        </div>
      </section>

      {/* --- LEADERSHIP / PASTOR BIO --- */}
      <section className="max-w-5xl mx-auto py-16 px-6">
        <div className="flex flex-col md:flex-row gap-10 items-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          {/* Photo Placeholder */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
            {/* You can replace '/pastor.jpg' with a real image in your public folder later */}
    <Image 
            src="/rod.png" 
            alt="Elder Bro. Rodelio Villaverde, Presiding Minister" 
            fill 
            className="object-cover"
          />
          </div>

          {/* Bio Text */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold text-gray-900">Elder Bro. Rodelio Villaverde</h3>
            <p className="text-blue-600 font-medium">Presiding Minister</p>
            <p className="text-gray-600 text-sm mt-1 mb-4">Fort McMurray, Alberta, Canada</p>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Isang Munting Mensahe sa mga Kapatiran</h4>
            <div className="space-y-3 leading-relaxed text-gray-600">
              <p>
                Mga minamahal na kapatiran, sa tulong at awa ng Panginoong Diyos, patuloy nating
                pinagsisikapang gawing mas maayos at mas malinaw ang ating paglilingkod at
                pangangasiwa, para higit itong makatulong sa inyo.
              </p>
              <p>
                Gumagamit na rin tayo ng makabagong teknolohiya sa pakikipag-usap, pagtatala, at
                pagpaplano ng mga gawain sa Iglesia. Kasangkapan lang ito, at hindi nito napapalitan
                ang ating pananampalataya, pananalangin, at pagsunod sa mga aral ng Panginoon.
                Gagamitin natin ito nang maingat at sa tamang layunin.
              </p>
              <p>
                Ang mga kaayusang ito sa pamamahala ay para makapaglingkod tayo nang mas mabuti sa
                Panginoong Diyos at sa mga kapatiran, mapagaan ang ilang gawain, at mapanatili ang
                pagkakaisa at maayos na koordinasyon.
              </p>
              <p>
                Ang tiwala natin ay nasa Panginoong Diyos at hindi sa teknolohiya. Anuman ang gawin
                natin, hilingin nawa natin lagi ang Kaniyang patnubay, karunungan, at pagpapala.
              </p>
              <p>Sama-sama nating ipagpatuloy ang tapat at maayos na paglilingkod sa Kaniya at sa isa&apos;t isa.</p>
            </div>

            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-900">
                Read in English
              </summary>
              <div className="mt-3 space-y-3 text-sm italic leading-relaxed text-gray-500">
                <p>
                  Beloved brethren, by the help and mercy of the Lord God, we keep working to make our
                  service and administration clearer and better organized, so that it helps you more.
                </p>
                <p>
                  We now also use modern technology to communicate, keep records, and plan the work of
                  the Church. It is only a tool. It does not replace our faith, our prayer, or our
                  obedience to the teachings of the Lord, and we will use it carefully and for the
                  right purpose.
                </p>
                <p>
                  These arrangements in management are meant to help us serve the Lord God and the
                  brethren better, to lighten some of the work, and to keep us united and well
                  coordinated.
                </p>
                <p>
                  Our trust is in the Lord God and not in technology. Whatever we do, may we always ask
                  for His guidance, wisdom, and blessing.
                </p>
                <p>Together, let us continue our faithful and orderly service to Him and to one another.</p>
              </div>
            </details>
          </div>
        </div>

        {/* --- OTHER MINISTERS --- */}
        <div className="grid gap-6 md:grid-cols-2 mt-8">

          {/* Bro. Abondio Mangubat */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mangubat.jpg"
                alt="Bro. Abondio Mangubat, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Abondio Mangubat</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Magallanes, Cavite, Philippines</p>
            </div>
          </div>

          {/* Bro. Felicisimo Mangubat */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mangubat-felicisimo.jpg"
                alt="Bro. Felicisimo Mangubat, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Felicisimo Mangubat</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Sto. Tomas, Batangas, Philippines</p>
            </div>
          </div>

          {/* Bro. Jimmy Villaverde */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/villaverde-jimmy.jpg"
                alt="Bro. Jimmy Villaverde, Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Jimmy Villaverde</h3>
              <p className="text-blue-600 text-sm font-medium">Minister</p>
              <p className="text-gray-600 text-sm mt-1">Lipa City, Batangas, Philippines</p>
            </div>
          </div>

          {/* Bro. Ariel Mencias */}
          <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 shadow-md">
              <Image
                src="/mencias-ariel.jpg"
                alt="Bro. Ariel Mencias, Student Minister"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bro. Ariel Mencias</h3>
              <p className="text-blue-600 text-sm font-medium">Student Minister</p>
              <p className="text-gray-600 text-sm mt-1">Lipa City, Batangas, Philippines</p>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}