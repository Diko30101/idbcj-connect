import Link from "next/link";
import { requireRoles, fmtDate, type Profile } from "@/lib/portal";
import { Empty, Notice, PageHeader, Panel, RoleBadge, StatusBadge, btnGhostCls, btnCls, inputCls } from "@/components/portal/ui";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; role?: string; ok?: string; error?: string }>;
}) {
  const { q = "", status = "", role = "", ok, error } = await searchParams;
  const { supabase, profile } = await requireRoles(["admin", "secretary"]);

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone_number, city, role, status, member_since")
    .order("full_name", { ascending: true })
    .limit(500);

  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone_number.ilike.%${term}%`);
  if (["visitor", "active", "inactive"].includes(status)) query = query.eq("status", status);
  if (["admin", "secretary", "leader", "member"].includes(role)) query = query.eq("role", role);

  const { data } = await query;
  const rows = (data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "phone_number" | "city" | "role" | "status" | "member_since">[];

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Talaan ng mga kapatiran. Ikaw lang at ang secretary ang nakakakita nito."
        action={
          profile.role === "admin" ? (
            <a href="/portal/members/export" className={btnGhostCls}>
              Export CSV
            </a>
          ) : undefined
        }
      />
      <Notice ok={ok} error={error} />

      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" method="get">
        <input name="q" defaultValue={q} placeholder="Hanapin: pangalan, email, telepono" className={inputCls} />
        <select name="status" defaultValue={status} className={inputCls}>
          <option value="">Lahat ng status</option>
          <option value="active">Active</option>
          <option value="visitor">Visitor</option>
          <option value="inactive">Inactive</option>
        </select>
        <select name="role" defaultValue={role} className={inputCls}>
          <option value="">Lahat ng role</option>
          <option value="admin">Admin</option>
          <option value="secretary">Secretary</option>
          <option value="leader">Leader</option>
          <option value="member">Member</option>
        </select>
        <button className={btnCls}>Hanapin</button>
      </form>

      <Panel>
        {rows.length === 0 ? (
          <Empty>Walang nahanap.</Empty>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-500">{rows.length} na resulta</p>
            <ul className="divide-y divide-gray-100">
              {rows.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/portal/members/${m.id}`}
                    className="flex flex-col gap-2 py-3 hover:bg-emerald-50/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{m.full_name || "(walang pangalan)"}</div>
                      <div className="text-xs text-gray-500">
                        {[m.email, m.phone_number, m.city].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Since {fmtDate(m.member_since)}</span>
                      <RoleBadge role={m.role} />
                      <StatusBadge status={m.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <p className="mt-4 text-xs text-gray-500">
        Para magdagdag ng bagong member: gumawa ng account sa Supabase (Authentication, Users, Add user).
        Awtomatikong lalabas siya rito bilang Active member.
      </p>
    </>
  );
}
