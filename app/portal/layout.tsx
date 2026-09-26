import { redirect } from "next/navigation";
import { getPortalContext, isStaff, isFinance, LOCAL_FINANCE_MINISTRY_NAME, FINANCE_MINISTRY_NAME, PASTORAL_MINISTRY_NAME, ROSTER_MINISTRY_NAMES, LOCAL_ADMIN_MINISTRY_NAME } from "@/lib/portal";
import { PortalShell } from "@/components/portal/portal-shell";
import type { NavItem } from "@/components/portal/portal-nav";
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

  const items: NavItem[] = [
    { href: "/portal", label: "Home" },
    { href: "/portal/inbox", label: "Inbox" },
    { href: "/portal/announcements", label: "Announcements" },
    { href: "/portal/ministries", label: "Ministries" },
    { href: "/portal/prayer", label: "Prayer" },
    { href: "/portal/profile", label: "My Profile" },
  ];
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/attendance", label: "Attendance" });
    items.push({ href: "/portal/members", label: "Users" });
    items.push({ href: "/portal/sermons", label: "Sermons" });
    items.push({ href: "/portal/events", label: "Events" });
  }
  let showLocalMinistry = profile.role === "admin";
  {
    const needsMinistryCheck = !(isFinance(profile.role) && isStaff(profile.role));
    // Kinukuha palagi (para sa nav ng Roster); ang lohika ng Finance sa ibaba ay hindi nagbabago (myMinistries ay null kung isFinance ang role)
    const { data: allMinistries } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
    const myMinistries = needsMinistryCheck ? allMinistries : null;
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

    // Finance role (Admin/Secretary/Treasurer) at Finance Ministry members ay parehong may
    // buong access sa Finance section (Financial Management, Audit Report, Expenses)
    if (isFinance(profile.role) || isFinanceMinistryMember) {
      items.push({
        href: "/portal/finance",
        label: "Finance",
        children: [
          { href: "/portal/finance", label: "Financial Management" },
          { href: "/portal/finance/report", label: "Audit Report" },
          { href: "/portal/finance/expenses", label: "Expenses" },
        ],
      });
    }
    if (isLocalFinanceMember) items.push({ href: "/portal/finance/local", label: "Finance Report" });

    // Admin/Secretary o Pastoral Ministry members lang ang may access sa Bible Study Courses
    if (isStaff(profile.role) || isPastoralMinistryMember) {
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
      items.push({ href: "/portal/finance/pasalamat", label: "Pasalamat" });
    }
    // Roster ng mga kaanib: Admin, Administrative Ministry o Local Admin Ministry (ang pahina ang nagsasala ng local)
    if (profile.role === "admin" || isRosterMember) items.push({ href: "/portal/roster", label: "Membership Record" });
    if (profile.role === "admin" || isRosterMember)
      items.push({ href: "/portal/attendance-record", label: "Attendance Record" });
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
  ]);
  type SubGroupDef = { label: string; hrefs: string[]; after?: string };
  const GROUP_DEFS: { label: string; hrefs: string[]; subgroups?: SubGroupDef[] }[] = [
    {
      label: "Gawain",
      hrefs: ["/portal/ministries", "/portal/prayer", "/portal/attendance", "/portal/sermons", "/portal/events"],
    },
    {
      label: "Local Ministry",
      hrefs: ["/portal/roster", "/portal/attendance-record", "/portal/finance/resibo", "/portal/finance/resibo/kaanib", "/portal/finance/local", "/portal/audit"],
      subgroups: [
        {
          label: "Finance Record",
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
    // Nested na subgroup (hal. "Finance Record" sa loob ng "Local Ministry"):
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

  // Ang PortalShell (client) ang nagpapasya ng shell base sa pathname:
  // sidebar theme para lang sa /portal, klasikong header + pill nav sa iba.
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
