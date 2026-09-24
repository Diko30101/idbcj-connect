import { redirect } from "next/navigation";
import { getPortalContext, isStaff, isFinance, LOCAL_FINANCE_MINISTRY_NAME, FINANCE_MINISTRY_NAME, PASTORAL_MINISTRY_NAME, ROSTER_MINISTRY_NAMES } from "@/lib/portal";
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
    items.push({ href: "/portal/members", label: "Members" });
    items.push({ href: "/portal/sermons", label: "Sermons" });
    items.push({ href: "/portal/events", label: "Events" });
  }
  {
    const needsMinistryCheck = !(isFinance(profile.role) && isStaff(profile.role));
    // Kinukuha palagi (para sa nav ng Roster); ang lohika ng Finance sa ibaba ay hindi nagbabago (myMinistries ay null kung isFinance ang role)
    const { data: allMinistries } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
    const myMinistries = needsMinistryCheck ? allMinistries : null;
    const isRosterMember = ((allMinistries ?? []) as any[]).some((m) => ROSTER_MINISTRY_NAMES.includes(m.ministries?.name));
    const isPastoralMember = ((allMinistries ?? []) as any[]).some((m) => m.ministries?.name === "Pastoral Ministry");
    const inFinanceMinistry = ((allMinistries ?? []) as any[]).some((m) => m.ministries?.name === FINANCE_MINISTRY_NAME);
    // Church-wide Finance: sinusuri lang kung kasapi ng Finance Ministry (para hindi dagdag na tawag sa lahat)
    const { data: isChurchWide } = inFinanceMinistry ? await supabase.rpc("is_church_wide_finance") : { data: false };
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
    if (isLocalFinanceMember) items.push({ href: "/portal/finance/local", label: "Local Finance" });

    // Admin/Secretary o Pastoral Ministry members lang ang may access sa Bible Study Courses
    if (isStaff(profile.role) || isPastoralMinistryMember) {
      items.push({ href: "/portal/courses", label: "Bible Study" });
    }
    // Isang link; ang pahina ang nagre-redirect ayon sa role (Local Finance, church-wide Finance, o Admin)
    if (isLocalFinanceMember || isFinanceMinistryMember || profile.role === "admin") {
      items.push({ href: "/portal/finance/abuluyan", label: "Abuluyan" });
      items.push({ href: "/portal/finance/resibo", label: "Buwanang Resibo" });
    }
    // Ambagan (per-member): Local Finance at church-wide Finance lang; ang pahina ang nagsasala
    if (isLocalFinanceMember || isFinanceMinistryMember) {
      items.push({ href: "/portal/finance/ambagan", label: "Ambagan" });
      items.push({ href: "/portal/finance/tulong", label: "Tulong sa Klase" });
      items.push({ href: "/portal/finance/pasalamat", label: "Pasalamat" });
    }
    // Roster ng mga kaanib: Admin, Administrative Ministry o Local Admin Ministry (ang pahina ang nagsasala ng local)
    if (profile.role === "admin" || isRosterMember) items.push({ href: "/portal/roster", label: "Membership Record" });
    // Pahintulot sa Inactive na kaanib: lider ng Pastoral Ministry na Admin (bumibigay), at church-wide Finance (nagbabasa)
    if ((profile.role === "admin" && isPastoralMember) || isChurchWide === true) items.push({ href: "/portal/giving-permissions", label: "Pahintulot" });
    // Audit ng pananalapi: church-wide Finance lang
    if (isChurchWide === true) items.push({ href: "/portal/finance/audit", label: "Audit ng Pananalapi" });
  }
  if (profile.role === "admin") items.push({ href: "/portal/audit", label: "Audit Log" });

  // Paggrupohin ang mga hindi gaanong ginagamit na item sa mga dropdown
  // (Gawain, Mga Kaloob, Pangasiwaan) para hindi humaba nang sobra ang nav bar.
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
  const GROUP_DEFS: { label: string; hrefs: string[] }[] = [
    {
      label: "Gawain",
      hrefs: ["/portal/ministries", "/portal/prayer", "/portal/attendance", "/portal/sermons", "/portal/events"],
    },
    {
      label: "Mga Kaloob",
      hrefs: [
        "/portal/finance/ambagan",
        "/portal/finance/tulong",
        "/portal/finance/pasalamat",
        "/portal/giving-permissions",
      ],
    },
    {
      label: "Pangasiwaan",
      hrefs: ["/portal/roster", "/portal/finance/abuluyan", "/portal/finance/resibo", "/portal/finance/local", "/portal/finance/audit", "/portal/audit"],
    },
  ];
  const alwaysVisible = items.filter((i) => ALWAYS_VISIBLE_HREFS.has(i.href));
  const finance = items.find((i) => i.href === "/portal/finance");
  const overflow = items.filter((i) => !ALWAYS_VISIBLE_HREFS.has(i.href) && i.href !== "/portal/finance");

  const navItems: NavItem[] = [...alwaysVisible];
  if (finance) navItems.push(finance);
  for (const def of GROUP_DEFS) {
    const children = def.hrefs.flatMap((h) => overflow.filter((i) => i.href === h));
    if (children.length === 0) continue;
    // Kung iisa lang ang laman ng grupo, direktang link na lang -- huwag nang i-dropdown.
    if (children.length === 1) navItems.push(children[0]);
    else navItems.push({ href: children[0].href, label: def.label, children });
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
