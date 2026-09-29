import { requirePortalAccess } from "@/lib/portal";
import { PageHeader, Panel } from "@/components/portal/ui";
import { HelpSearch } from "@/components/portal/help-search";

// Help: gabay sa paggamit ng portal, mga tuntunin/patakaran, at FAQ. Nakikita ito ng LAHAT ng
// may account (walang role/ministry gate) -- katulad ng Home/Inbox/Announcements/Prayer/My Profile.
// Purong static content, walang query sa database.

type AccessRow = { menu: string; access: string };
type Faq = { q: string; a: string };
type GuideSection = { title: string; body: string[] };

const ROLE_ROWS: { role: string; meaning: string }[] = [
  { role: "Admin (Presiding Minister)", meaning: "Buong access sa lahat ng bahagi ng portal, kasama ang Users, Audit Log, at pagpapalit ng role ng iba." },
  { role: "General Secretary", meaning: "Church-wide na sekretarya. May access sa Finance section, Bible Study, Sermons, at Events." },
  { role: "Local Secretary", meaning: "Sekretarya ng sariling lokal. May access sa Sermons at Events, at sa mga ministry kung saan siya aktwal na kasapi (hal. Local Finance Ministry, Local Admin Ministry)." },
  { role: "Treasurer", meaning: "Bahagi ng Finance tier -- kasama sa may buong access sa Finance section (church-wide)." },
  { role: "General Treasurer", meaning: "Namamahala sa buong Finance section at sa mga request ng Tulong Financial (pag-apruba, pagbibigay, at pagtatala ng datos)." },
  { role: "Ministry Leader", meaning: "Namumuno sa isang partikular na ministry (hal. iskedyul ng paglilingkod)." },
  { role: "Member", meaning: "Ordinaryong kaanib. Access sa mga pangunahing menu lang (Home, Inbox, Announcements, Prayer, My Profile, Help), maliban kung kasapi rin siya ng isang ministry na may karagdagang access." },
];

const ACCESS_ROWS: AccessRow[] = [
  { menu: "Home, Inbox, Announcements, Prayer, My Profile, Help", access: "Lahat ng may account." },
  { menu: "Ministries", access: "Admin, o kasapi ng Administrative Ministry." },
  { menu: "Users (talaan ng mga account na may login)", access: "Admin lang." },
  { menu: "Sermons, Events", access: "Admin, General Secretary, o Local Secretary." },
  { menu: "Finance (Financial Management, Audit Report, Expenses)", access: "Admin, General Secretary, Treasurer, General Treasurer, o kasapi ng Finance Ministry (church-wide)." },
  { menu: "Tulong Financial (Create New Account, pag-apruba, pagtatala ng bayad)", access: "Admin, General Treasurer, o kasapi ng Finance Ministry." },
  { menu: "My Tulong Financial", access: "Sinumang aprubadong Tulong Financial member (borrower), kahit ano pa ang role o ministry niya." },
  { menu: "Finance Report (Local)", access: "Kasapi ng Local Finance Ministry (sariling lokal lang, limitadong access -- iba ito sa Finance Ministry na church-wide)." },
  { menu: "Bible Study", access: "Admin, General Secretary, o kasapi ng Pastoral Ministry." },
  { menu: "Abuluyan, Buwanang Resibo", access: "Kasapi ng Local Finance Ministry, Finance Ministry, o Admin." },
  { menu: "Resibo ng Kaanib", access: "Kasapi ng Local Finance Ministry lang." },
  { menu: "Ambagan, Tulong sa Aral, Pasalamat", access: "Kasapi ng Local Finance Ministry o Finance Ministry." },
  { menu: "Membership Record (Roster), Attendance Record, Attendance Report", access: "Admin, o kasapi ng Administrative Ministry/Local Admin Ministry." },
  { menu: "Paksa sa Pagsamba, Schedule ng Sugo", access: "Admin, kasapi ng Administrative Ministry/Local Admin Ministry, o Pastoral Ministry." },
  { menu: "Audit Log", access: "Admin lang." },
];

const GUIDES: GuideSection[] = [
  {
    title: "Users -- pagdaragdag at pamamahala ng account",
    body: [
      "Dito ginagawa ang login account ng bawat kaanib (username at temporary password). Admin lang ang makakakita at makaka-access nito.",
      "Pindutin ang \"+ Add Member\" para gumawa ng bagong account. Ibibigay sa iyo ang username at temporary password na ipapasa mo sa kaanib -- papalitan niya ito sa unang login.",
      "Sa loob ng detalye ng isang account, puwedeng i-edit ang profile, palitan ang role, idagdag/alisin sa ministry, i-reset ang password, o burahin ang account.",
    ],
  },
  {
    title: "Membership Record (Roster) -- iba ito sa Users",
    body: [
      "Ang Roster ay talaan ng LAHAT ng kaanib ng lokal (kasama ang mga walang login account) -- para sa attendance at record-keeping. Iba ito sa Users, na talaan lang ng mga MAY login account.",
      "Ang pagdaragdag ng pangalan sa Roster ay hindi gumagawa ng login account -- kailangan pa rin ng Admin na gumawa niyon sa Users kung kailangan ng account ang taong iyon.",
      "Bagong kaanib na idinagdag ng hindi Admin (hal. Local Admin Ministry) ay \"Hindi pa kumpirmado\" muna -- ang Admin ang magki-kumpirma (\"Kumpirmahin\") bago ito makatanggap ng handog. Ang bilang na \"Aktibo\" sa itaas ng Roster ay kumpirmado na lang ang binibilang -- hindi pa kabilang ang mga naghihintay pa ng kumpirmasyon.",
      "Kung doble o maling naidagdag ang bagong kaanib at ayaw nang kumpirmahin ng Admin, may \"Tanggalin\" na buton (Admin lang, at hindi pa kumpirmadong kaanib lang) sa tabi ng \"Kumpirmahin\" para permanenteng alisin ito sa listahan. Kapag kumpirmado na ang kaanib, hindi na ito matatanggal dito -- gamitin na lang ang Status (Inactive/Tiwalag) kung kailangang tanggalin sa aktibong listahan.",
    ],
  },
  {
    title: "Finance -- pag-eencode at pag-uulat",
    body: [
      "Ang Ambagan, Tulong sa Aral, at Pasalamat ay pinipili muna ang Buwan/Taon bago mag-encode -- grid na katulad ng papel na form, awtomatiko ang Total.",
      "Ang Abuluyan ay lingguhang kabuuan ng lokal (hindi per-member). Kung may naka-schedule nang Sugo sa \"Schedule ng Sugo\" para sa Linggong iyon (sa pangunahing serbisyo), awtomatiko itong lalabas na default sa dropdown ng Sugo -- kung wala namang naka-schedule, manual na pipiliin sa dropdown. Puwede pa ring palitan bago i-save kung mali ang default.",
      "Ang Buwanang Resibo ay pinagsasama sa isang printable na resibo ang Abuluyan, Ambagan, Tulong sa Aral, at Pasalamat ng isang buwan -- may \"I-download PDF\" din.",
      "Ang Local Finance Ministry ay limitado lang sa sariling lokal; ang Finance Ministry (church-wide) at ang General Treasurer ang may access sa lahat ng lokal.",
    ],
  },
  {
    title: "Tulong Financial",
    body: [
      "Ang aprubadong borrower ay makikita ang sariling record niya sa \"My Tulong Financial\" -- history ng transaction at balanse.",
      "Ang Admin, General Treasurer, o kasapi ng Finance Ministry ang gumagawa ng bagong account, nag-aaprubang request, at nagtatala ng binigay na bayad.",
      "Hindi puwedeng humiling ng bagong hiram ang isang kaanib sa sariling portal habang may natitirang (unpaid) balanse pa sa umiiral niyang hiram -- kailangan munang mabayaran ito. Kung talagang kailangan ng bagong hiram habang may balanse pa, ang Finance Ministry (o Admin/General Treasurer) lang ang makakagawa nito para sa kanya.",
    ],
  },
  {
    title: "Bible Study",
    body: [
      "Ang Admin/General Secretary ang gumagawa at nag-e-edit ng course at aralin (kasama ang quiz).",
      "Ang kasapi ng Pastoral Ministry ay makakabasa ng aralin at makakasagot ng quiz, pero hindi makaka-edit.",
    ],
  },
  {
    title: "Paksa sa Pagsamba at Schedule ng Sugo",
    body: [
      "Ang \"Paksa sa Pagsamba\" ay church-wide na listahan ng paksa kada Linggo sa buong buwan.",
      "Ang \"Schedule ng Sugo\" ay per-lokal -- sino ang nakatalagang sugo/tagapagsalita sa bawat Linggo ng lokal na iyon. Hiwalay ang dalawang ito kahit magkaugnay.",
      "Kung may dalawang serbisyo ang isang lokal sa isang Linggo (hal. may hapon), maaaring magkaiba ang naka-schedule na Sugo bawat serbisyo. Ang Sugo ng pangunahing serbisyo (walang session label) ang siyang ginagamit bilang default sa pag-encode ng Abuluyan.",
    ],
  },
];

const FAQ: Faq[] = [
  {
    q: "Bakit hindi ko makita ang isang menu na dati kong nakikita (o nakikita ng kasamahan ko)?",
    a: "Ang access sa maraming bahagi ng portal ay hindi lang nakadepende sa role mo, kundi pati na rin sa ministry na aktwal mong kinabibilangan (hal. Finance Ministry, Pastoral Ministry, Local Admin Ministry). Kaya kahit magkaparehong role ang dalawang tao, maaaring magkaiba ang makikita nilang menu. Kung sa tingin mo ay may pagkakamali, makipag-ugnayan sa Admin.",
  },
  {
    q: "Paano ako makakakuha ng account/login?",
    a: "Ang Admin lang ang gumagawa ng bagong account. Lapitan ang Admin (Presiding Minister) ng iyong lokal para hilingin ito.",
  },
  {
    q: "Nakalimutan ko ang password ko -- ano ang gagawin?",
    a: "Hilingin sa Admin na i-reset ang password mo. Bibigyan ka niya ng bagong temporary password na papalitan mo sa susunod mong pag-login.",
  },
  {
    q: "Paano ako magdaragdag ng bagong kaanib sa listahan?",
    a: "Kung MAY login account ang kaanib, gagawa ang Admin ng account sa Users. Kung WALA (para lang sa talaan/attendance), idadagdag ito sa Membership Record (Roster) ng Local Admin Ministry/Administrative Ministry o Admin -- iba ang dalawang ito.",
  },
  {
    q: "Ano ang pagkakaiba ng Finance Ministry at Local Finance Ministry?",
    a: "Ang Finance Ministry ay church-wide -- makikita ang datos ng LAHAT ng lokal. Ang Local Finance Ministry ay limitado lang sa SARILING lokal. Magkaiba ang saklaw kahit magkatulad ang pangalan.",
  },
  {
    q: "Paano ako makakakuha ng Tulong Financial?",
    a: "Makipag-ugnayan sa General Treasurer o sa kasapi ng Finance Ministry ng iyong lokal para sa proseso ng paghiling.",
  },
  {
    q: "Bakit hindi ko na makita ang \"Humiling ng hiram\" sa My Tulong Financial ko?",
    a: "Kung may natitira ka pang balanseng hindi pa bayad sa umiiral mong hiram, hindi ka muna makakahiling ng bagong hiram sa sarili mong portal hangga't hindi ito nababayaran. Kung talagang kailangan mo ng bagong hiram habang may balanse ka pa, makipag-ugnayan sa Finance Ministry -- sila (o ang Admin/General Treasurer) lang ang makakagawa nito para sa iyo.",
  },
  {
    q: "Bakit \"Local Secretary\" ang role ko pero hindi ko ma-access ang [isang partikular na Finance o Bible Study na pahina]?",
    a: "Ang role na Local Secretary ay may access sa Sermons at Events, pero HINDI awtomatikong nagbibigay ng access sa Finance o Bible Study -- kailangan pang aktwal na kasapi ng kaukulang ministry (hal. Local Finance Ministry, Pastoral Ministry) para dito.",
  },
  {
    q: "Sino ang makakakita ng personal kong impormasyon (contact, birthday, emergency contact)?",
    a: "Ikaw lang at ang Admin/Secretary ang makakakita ng buong detalye ng iyong profile, alinsunod sa itinakdang access ng sistema.",
  },
  {
    q: "May mali akong nakitang datos (hal. mali ang halaga sa isang resibo) -- ano ang gagawin?",
    a: "Ipaalam agad sa taong nag-encode nito o sa Admin para maitama. Naitatala ang lahat ng pagbabago sa Audit Log (Admin lang ang nakakakita nito) kaya matutunton pa rin kung kailan at sino ang nag-edit.",
  },
];

export default async function HelpPage() {
  await requirePortalAccess();

  return (
    <>
      <PageHeader title="Help" subtitle="Gabay sa paggamit ng IDBCJ Connect, mga patakaran, at mga madalas itanong" />

      <div className="space-y-6">
        <Panel title="Tungkol dito">
          <p className="text-sm text-gray-700">
            Narito ang gabay kung paano gamitin ang mga pangunahing bahagi ng portal, kung sino ang may access sa
            bawat menu, ang mga patakaran sa paggamit, at ang mga madalas itanong (FAQ). Kung hindi mo pa rin
            nasagot ang tanong mo pagkatapos basahin ito, tingnan ang &ldquo;Kailangan pa ng tulong?&rdquo; sa
            ibaba.
          </p>
        </Panel>

        <Panel title="Maghanap ng Sagot">
          <HelpSearch guides={GUIDES} faq={FAQ} />
        </Panel>

        <Panel title="Mga Role sa Portal">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2">Ibig sabihin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ROLE_ROWS.map((r) => (
                  <tr key={r.role}>
                    <td className="py-2.5 pr-4 align-top font-semibold text-gray-800 whitespace-nowrap">{r.role}</td>
                    <td className="py-2.5 align-top text-gray-600">{r.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Sino ang May Access sa Bawat Menu">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="py-2 pr-4">Menu</th>
                  <th className="py-2">Sino ang may access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ACCESS_ROWS.map((r) => (
                  <tr key={r.menu}>
                    <td className="py-2.5 pr-4 align-top font-semibold text-gray-800">{r.menu}</td>
                    <td className="py-2.5 align-top text-gray-600">{r.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Tandaan: ang access sa maraming menu ay nakadepende sa role AT sa aktwal na ministry membership -- hindi
            lang sa role. Ang pahina mismo ang huling sumasala ayon sa tamang access.
          </p>
        </Panel>

        <Panel title="Paano Gamitin ang mga Pangunahing Feature">
          <div className="divide-y divide-gray-100">
            {GUIDES.map((g) => (
              <details key={g.title} className="group py-3 first:pt-0 last:pb-0">
                <summary className="cursor-pointer list-none font-semibold text-gray-800 marker:content-none">
                  <span className="mr-2 inline-block text-emerald-600 transition group-open:rotate-90">›</span>
                  {g.title}
                </summary>
                <div className="mt-2 space-y-2 pl-5 text-sm text-gray-600">
                  {g.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Panel>

        <Panel title="Mga Patakaran">
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              Ang personal na impormasyon ng bawat kaanib (contact, birthday, emergency contact, halaga ng
              handog) ay protektado -- ipinapakita lang ito sa taong may itinakdang access, hindi sa lahat.
            </p>
            <p>
              Dapat tumpak at napapanahon ang pag-e-encode ng datos (attendance, handog, roster). Itama agad kung
              may nakitang pagkakamali sa halip na palampasin na lang.
            </p>
            <p>
              Ang temporary password na ibinibigay sa bagong account ay dapat palitan sa unang login.
            </p>
            <p>
              Ang pagpapalit ng role ng isang account, at ang pagdaragdag/pagbura ng account, ay Admin lang ang
              gumagawa.
            </p>
            <p>
              Naitatala ang lahat ng pagbabago sa mahahalagang datos (Finance, atbp.) sa Audit Log -- matutunton
              kung kailan at sino ang nag-edit.
            </p>
            <p>
              Ang kaanib na may natitirang (unpaid) balanse sa umiiral na Tulong Financial na hiram ay hindi
              makakahiling ng bagong hiram sa sariling portal hangga&apos;t hindi ito nababayaran -- maliban na
              lang kung ang Finance Ministry mismo ang gagawa ng bagong hiram para sa kanya.
            </p>
          </div>
        </Panel>

        <Panel title="Mga Madalas Itanong (FAQ)">
          <div className="divide-y divide-gray-100">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-3 first:pt-0 last:pb-0">
                <summary className="cursor-pointer list-none font-semibold text-gray-800 marker:content-none">
                  <span className="mr-2 inline-block text-emerald-600 transition group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-5 text-sm text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </Panel>

        <Panel title="Kailangan pa ng tulong?">
          <p className="text-sm text-gray-700">
            Kung hindi nasagot dito ang tanong mo, o kung sa tingin mo ay may mali sa access mo, gamitin ang{" "}
            <span className="font-semibold">Inbox</span> para magpadala ng liham sa Admin, o direktang lapitan ang
            Admin (Presiding Minister) ng iyong lokal.
          </p>
        </Panel>
      </div>
    </>
  );
}
