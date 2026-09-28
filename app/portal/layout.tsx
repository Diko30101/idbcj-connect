import { redirect } from "next/navigation";
import { getPortalContext, isStaff, isFinance, LOCAL_FINANCE_MINISTRY_NAME, FINANCE_MINISTRY_NAME, PASTORAL_MINISTRY_NAME, ROSTER_MINISTRY_NAMES, LOCAL_ADMIN_MINISTRY_NAME } from "@/lib/portal";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import { shownEmail } from "@/lib/username";

export const metadata = { title: "IDBCJ Connect", robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getPortalContext();
  if (profile.must_change_password) redirect("/change-password");

  const signOut = (
    <form action="/auth/sign-out" method="post">
      <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600">
        Sign Out
      </button>
    </form>
  );

  if (profile.status === "inactive") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Inactive ang account na ito</h1>
          <p className="text-sm text-gray-600">
            Makipag-ugnayan sa secretary o sa Presiding Minister kung sa palagay mo ay may pagkakamali.
          </p>
          {signOut}
        </div>
      </div>
    );
  }

  // Bilang ng hindi pa nababasang inbox letters (para sa bell notification badge)
  const { data: unreadRecipients } = await supabase
    .from("letter_recipients")
    .select("letter_id")
    .eq("profile_id", profile.id)
    .is("read_at", null);
  const { data: deletedLetters } = await supabase
    .from("letter_deletions")
    .select("letter_id")
    .eq("profile_id", profile.id);
  const deletedIds = new Set(((deletedLetters ?? []) as any[]).map((d) => d.letter_id));
  const unreadCount = ((unreadRecipients ?? []) as any[]).filter((r) => !deletedIds.has(r.letter_id)).length;

  const items: NavItem[] = [
    { href: "/portal", label: "Home" },
    { href: "/portal/inbox", label: "Inbox", badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/portal/announcements", label: "Announcements" },
    { href: "/portal/prayer", label: "Prayer" },
    { href: "/portal/profile", label: "My Profile" },
  ];
  // Help: gabay sa paggamit, mga patakaran, at FAQ -- nakikita ng LAHAT, walang role/ministry gate.
  // Hindi na ito kasama sa listahan ng sidebar -- inilipat sa itaas (kanang bahagi ng top bar),
  // katabi ng notification bell, tingnan ang PortalShell/SidebarShell sa portal-shell.tsx.
  // Ang "Ministries" na menu ay para LANG sa Admin role at mga kasapi ng
  // Administrative Ministry -- hindi ito makikita ng iba.
  if (profile.role === "admin" || (((await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id)).data ?? []) as any[]).some((m) => m.ministries?.name === "Administrative Ministry")) {
    items.push({ href: "/portal/ministries", label: "Ministries" });
  }
  // Ang "Users" (talaan ng mga account na may login) ay Admin lang -- hindi ito kasama sa
  // pangkalahatang isStaff() (na kasama pa rin ang Secretary/Local Secretary para sa Sermons/Events).
  if (profile.role === "admin") {
    items.push({ href: "/portal/members", label: "Users" });
  }
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/sermons", label: "Sermons" });
    items.push({ href: "/portal/events", label: "Events" });
  }
  let showLocalMinistry = profile.role === "admin";
  {
    // Laging kinukuha ang aktwal na ministry membership -- ginagamit ito ng Roster nav
    // AT ng mga Form Record link sa ibaba (Abuluyan/Ambagan/Tulong sa Aral/Pasalamat).
    // Dati, ni-null out ito kapag "Finance-tier" na ang role (Admin/Secretary/Treasurer/
    // Local Secretary), sa pag-aakalang hindi na kailangan -- pero mali iyon: nakadepende
    // ang mga link na ito sa TUNAY na ministry membership (hal. Local Secretary na kasapi
    // rin ng Local Finance Ministry), hindi lang sa pangkalahatang isFinance()/isStaff() ng
    // role. Libre lang ayusin ito dahil laging kinukuha na rin ang allMinistries.
    const { data: allMinistries } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
    const myMinistries = allMinistries;
    const isRosterMember = ((allMinistries ?? []) as any[]).some((m) => ROSTER_MINISTRY_NAMES.includes(m.ministries?.name));
    // Ang "Local Ministry" na menu ay para lang sa Local Admin Ministry
    // (mga nagtatala at nagpapadala ng local data sa Finance at Administrative Ministry),
    // bukod sa Admin na lahat ay nakikita.
    const isLocalAdminMinistry = ((allMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === LOCAL_ADMIN_MINISTRY_NAME,
    );
    showLocalMinistry = profile.role === "admin" || isLocalAdminMinistry;
    const isLocalFinanceMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === LOCAL_FINANCE_MINISTRY_NAME,
    );
    const isFinanceMinistryMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === FINANCE_MINISTRY_NAME,
    );
    const isPastoralMinistryMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === PASTORAL_MINISTRY_NAME,
    );

    // Finance role (Admin/Secretary/Treasurer/General Treasurer) at Finance Ministry members ay
    // parehong may buong access sa Finance section (Financial Management, Audit Report, Expenses).
    // Tandaan: ang "Tulong Financial" ay Admin, General Treasurer, o Finance Ministry lang -- hindi
    // nakikita ng Local Finance Ministry, at hindi rin ng secretary/treasurer na hindi kasapi
    // ng Finance Ministry. Ang General Treasurer ang tumatanggap/nagpapasa sa Admin ng mga request
    // (hal. Tulong Financial) at nagbibigay/nagtatala ng datos ng Tulong Financial sa humihiling.
    if (isFinance(profile.role) || isFinanceMinistryMember) {
      const financeChildren: NavItem[] = [
        { href: "/portal/finance", label: "Financial Management" },
        { href: "/portal/finance/report", label: "Audit Report" },
        { href: "/portal/finance/expenses", label: "Expenses" },
      ];
      if (profile.role === "admin" || profile.role === "general_treasurer" || isFinanceMinistryMember) {
        financeChildren.push({
          href: "/portal/finance/tulong-financial",
          label: "Tulong Financial",
          children: [
            { href: "/tulong-financial/finance", label: "Create New Account" },
          ],
        });
      }
      items.push({
        href: "/portal/finance",
        label: "Finance",
        children: financeChildren,
      });
    }
    if (isLocalFinanceMember) items.push({ href: "/portal/finance/local", label: "Finance Report" });

    // Aprubadong Tulong Financial member na gumagamit ng portal login:
    // makikita sa kanyang menu ang "Tulong Financial" — sariling record,
    // history ng bawat transaction, at balanse, sa LOOB ng portal.
    // Kahit Finance Ministry member o Admin, kung borrower din siya
    // (kasapi ng Tulong Financial Members), makikita niya ang menu na ito.
    {
      // Ipakita ang "My Tulong Financial" sa LAHAT ng members ng
      // Tulong Financial Members ministry (hindi lang kay Elyzah).
      // Gumagamit ng SECURITY DEFINER function na tumatanggap ng profile_id
      // bilang parameter (hindi umaasa sa auth.uid()).
      let isTulongMember = false;
      try {
        const { data, error } = await (supabase.rpc as any)("is_tulong_financial_member_by_profile", {
          p_profile_id: profile.id,
        });
        if (error) console.error("[MyTulongMenu] RPC error:", error.message);
        isTulongMember = !!data;
      } catch (e) {
        console.error("[MyTulongMenu] RPC exception:", e);
      }
      if (isTulongMember) {
        items.push({ href: "/portal/tulong-financial", label: "My Tulong Financial" });
      }
    }

    // Admin/Secretary o Pastoral Ministry members lang ang may access sa Bible Study Courses.
    // SADYANG hindi kasama ang Local Secretary (kaya hindi isStaff() ang ginagamit).
    if (profile.role === "admin" || profile.role === "secretary" || isPastoralMinistryMember) {
      items.push({ href: "/portal/courses", label: "Bible Study" });
    }
    // Isang link; ang pahina ang nagre-redirect ayon sa role (Local Finance, church-wide Finance, o Admin)
    if (isLocalFinanceMember || isFinanceMinistryMember || profile.role === "admin") {
      items.push({ href: "/portal/finance/abuluyan", label: "Abuluyan" });
      items.push({ href: "/portal/finance/resibo", label: "Buwanang Resibo" });
    }
    /* Resibo ng Kaanib (per-member): Local Finance Ministry lang */ if (isLocalFinanceMember) { items.push({ href: "/portal/finance/resibo/kaanib", label: "Resibo ng Kaanib" }); }    // Ambagan (per-member): Local Finance at church-wide Finance lang; ang pahina ang nagsasala
    if (isLocalFinanceMember || isFinanceMinistryMember) {
      items.push({ href: "/portal/finance/ambagan", label: "Ambagan" });
      items.push({ href: "/portal/finance/tulong", label: "Tulong sa Aral" });
      // Hiwalay na pahina ang bawat uri ng Pasalamat (Monthly -- kasama na ang dating Extra,
      // Taunang, Anniversary) -- submenu sa ilalim ng "Pasalamat" gamit ang parehong recursive na
      // SidebarGroup. Inalis na ang "Extra Pasalamat" na child dahil kaparehong-kapareho na ng
      // sarili nitong link ang parent na "Pasalamat" (parehong /portal/finance/pasalamat) --
      // naa-access pa rin ang pahina lalo pa't naroon din ang PasalamatTabs sa itaas ng bawat
      // pahina ng Pasalamat. "Monthly Pasalamat Report" pa rin ang pamagat sa loob mismo ng form.
      items.push({
        href: "/portal/finance/pasalamat",
        label: "Pasalamat",
        children: [
          { href: "/portal/finance/pasalamat/annual", label: "Taunang Pasalamat" },
          { href: "/portal/finance/pasalamat/anniversary", label: "Anniversary Pasalamat" },
        ],
      });
    }
    // Roster ng mga kaanib: Admin, Administrative Ministry o Local Admin Ministry (ang pahina ang nagsasala ng local)
    if (profile.role === "admin" || isRosterMember) items.push({ href: "/portal/roster", label: "Membership Record" });
    if (profile.role === "admin" || isRosterMember)
      items.push({ href: "/portal/attendance-record", label: "Attendance Record" });
    if (profile.role === "admin" || isRosterMember)
      items.push({ href: "/portal/attendance-report", label: "Attendance Report" });
    // Paksa sa Pagsamba (church-wide) at Schedule ng Sugo (per local): parehong Admin,
    // Administrative/Local Admin Ministry (Roster), o Pastoral Ministry member -- pero hiwalay
    // na pahina ang bawat isa (hiwalay ang saklaw at ang nagpapasya sa bawat isa).
    if (profile.role === "admin" || isRosterMember || isPastoralMinistryMember) {
      items.push({ href: "/portal/pagsamba", label: "Paksa sa Pagsamba" });
      items.push({ href: "/portal/sugo", label: "Schedule ng Sugo" });
    }
  }
  if (profile.role === "admin") items.push({ href: "/portal/audit", label: "Audit Log" });

  // Paggrupohin ang mga hindi gaanong ginagamit na item sa mga dropdown
  // (Gawain, Local Ministry) para hindi humaba nang sobra ang nav bar.
  // Ang bawat item ay dati nang na-filter base sa role (sa itaas), kaya ang
  // pag-grupo lang ang binabago dito -- hindi apektado ang access control.
  const ALWAYS_VISIBLE_HREFS = new Set([
    "/portal",
    "/portal/inbox",
    "/portal/announcements",
    "/portal/members",
    "/portal/courses",
    "/portal/profile",
    "/tulong-financial",
    "/portal/tulong-financial",
  ]);
  type SubGroupDef = { label: string; hrefs: string[]; after?: string };
  const GROUP_DEFS: { label: string; hrefs: string[]; subgroups?: SubGroupDef[] }[] = [
    {
      label: "Gawain",
      hrefs: ["/portal/ministries", "/portal/prayer", "/portal/attendance", "/portal/sermons", "/portal/events"],
    },
    {
      label: "Local Ministry",
      hrefs: ["/portal/roster", "/portal/attendance-record", "/portal/attendance-report", "/portal/pagsamba", "/portal/sugo", "/portal/finance/resibo", "/portal/finance/resibo/kaanib", "/portal/finance/local", "/portal/audit"],
      subgroups: [
        {
          label: "Form Record",
          // Ipasok pagkatapos ng Attendance Record, bago ang Buwanang Resibo.
          after: "/portal/attendance-record",
          hrefs: [
            "/portal/finance/abuluyan", "/portal/finance/ambagan",
            "/portal/finance/tulong",
            "/portal/finance/pasalamat",
          ],
        },
      ],
    },
  ];
  const alwaysVisible = items.filter((i) => ALWAYS_VISIBLE_HREFS.has(i.href));
  const finance = items.find((i) => i.href === "/portal/finance");
  const overflow = items.filter((i) => !ALWAYS_VISIBLE_HREFS.has(i.href) && i.href !== "/portal/finance");

  const navItems: NavItem[] = [...alwaysVisible];
  if (finance) navItems.push(finance);
  const claimedHrefsOf = (def: (typeof GROUP_DEFS)[number]) =>
    new Set([...def.hrefs, ...(def.subgroups ?? []).flatMap((s) => s.hrefs)]);
  for (const def of GROUP_DEFS) {
    const children = def.hrefs.flatMap((h) => overflow.filter((i) => i.href === h));
    // Nested na subgroup (hal. "Form Record" sa loob ng "Local Ministry"):
    // binubuo lang mula sa mga item na mayroon na ang user -- walang binabagong access control.
    const subgroups: { item: NavItem; after?: string }[] = (def.subgroups ?? []).flatMap((sg) => {
      const sgChildren = sg.hrefs.flatMap((h) => overflow.filter((i) => i.href === h));
      if (sgChildren.length === 0) return [];
      return [{ item: { href: sgChildren[0].href, label: sg.label, children: sgChildren }, after: sg.after }];
    });
    const allChildren: NavItem[] = [];
    for (const c of children) {
      allChildren.push(c);
      for (const sg of subgroups) if (sg.after === c.href) allChildren.push(sg.item);
    }
    for (const sg of subgroups) if (!sg.after && !allChildren.includes(sg.item)) allChildren.push(sg.item);
    if (allChildren.length === 0) continue;
    // Ang "Local Ministry" ay para lang sa Admin at Local Admin Ministry.
    // Sa iba (hal. Local Finance o Administrative Ministry lang), direktang
    // links pa rin ang mga pahinang may access sila -- hindi nawawala.
    if (def.label === "Local Ministry" && !showLocalMinistry) {
      const claimedByOthers = new Set(
        GROUP_DEFS.filter((d) => d !== def).flatMap((d) => [...claimedHrefsOf(d)]),
      );
      const pushDirect = (c: NavItem) => {
        if (!claimedByOthers.has(c.href) && !navItems.some((n) => n.href === c.href)) navItems.push(c);
      };
      for (const c of children) pushDirect(c);
      for (const sg of subgroups) for (const c of sg.item.children ?? []) pushDirect(c);
      continue;
    }
    // Kung iisa lang ang laman ng grupo, direktang link na lang -- huwag nang i-dropdown.
    if (allChildren.length === 1 && subgroups.length === 0) navItems.push(allChildren[0]);
    else navItems.push({ href: allChildren[0].href, label: def.label, children: allChildren });
  }

  // Ang PortalShell ay iisang emerald sidebar para sa lahat ng portal pages
  // (testing) -- tinanggal ang klasikong header + pill nav (top menu).
  const displayName = profile.full_name || profile.username || shownEmail(profile.email) || "Kapatid";

  return (
    <PortalShell
      navItems={navItems}
      displayName={displayName}
      role={profile.role}
      status={profile.status}
    >
      {children}
    </PortalShell>
  );
}
