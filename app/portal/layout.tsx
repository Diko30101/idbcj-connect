import Link from "next/link";
import Image from "next/image";
import { getPortalContext, isStaff } from "@/lib/portal";
import { PortalNav, type NavItem } from "@/components/portal/portal-nav";

export const metadata = { title: "IDBCJ Connect", robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getPortalContext();

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
    { href: "/portal/announcements", label: "Announcements" },
    { href: "/portal/ministries", label: "Ministries" },
    { href: "/portal/prayer", label: "Prayer" },
    { href: "/portal/profile", label: "My Profile" },
  ];
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/attendance", label: "Attendance" });
    items.push({ href: "/portal/members", label: "Members" });
  }
  if (profile.role === "admin") items.push({ href: "/portal/audit", label: "Audit Log" });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-emerald-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/portal" className="flex items-center gap-3 text-lg font-bold text-emerald-900">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-emerald-100 shadow-sm">
              <Image src="/logo.png" alt="IDBCJ Logo" fill sizes="40px" className="object-cover" />
            </span>
            IDBCJ Connect
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-emerald-700">
              ← Website
            </Link>
            <span className="hidden text-sm text-gray-500 sm:inline">{profile.full_name || profile.email}</span>
            {signOut}
          </div>
        </div>
      </header>
      <PortalNav items={items} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
