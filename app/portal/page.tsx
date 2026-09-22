import Link from "next/link";
import { requirePortalAccess, isStaff, isFinanceMember, fmtDate, todayPH, KIND_LABEL } from "@/lib/portal";
import { yearToDateLabel } from "@/lib/finance";
import { Empty, Notice, Panel, PageHeader, RoleBadge, StatusBadge } from "@/components/portal/ui";
import { FinanceSummaryPie } from "@/components/portal/finance-summary-pie";

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);
  const today = todayPH();

  const [ann, mine, sched, att, counts, birthdays] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, ministry_id, publish_at, ministries(name)")
      .eq("published", true)
      .lte("publish_at", new Date().toISOString())
      .order("publish_at", { ascending: false })
      .limit(5),
    supabase
      .from("ministry_members")
      .select("is_leader, ministries(id, name)")
      .eq("profile_id", profile.id),
    supabase
      .from("ministry_schedule")
      .select("id, service_date, title, ministries(name)")
      .gte("service_date", today)
      .order("service_date")
      .limit(5),
    supabase
      .from("attendance")
      .select("present, services(service_date, kind)")
      .eq("profile_id", profile.id),
    staff
      ? supabase.from("profiles").select("status")
      : Promise.resolve({ data: null as { status: string }[] | null }),
    supabase
      .from("profiles")
      .select("id, full_name, birthday")
      .not("birthday", "is", null)
      .neq("status", "inactive"),
  ]);

  const myAtt = ((att.data ?? []) as any[])
    .filter((a) => a.services)
    .sort((a, b) => b.services.service_date.localeCompare(a.services.service_date))
    .slice(0, 8);
  const presentCount = myAtt.filter((a) => a.present).length;

  const stat = (s: string) => (counts.data ?? []).filter((p) => p.status === s).length;

  const myMinistryNames = ((mine.data ?? []) as any[]).map((m) => m.ministries?.name).filter(Boolean);
  const financeAccess = isFinanceMember(profile.role, myMinistryNames);
  const financeYear = today.slice(0, 4);
  let financeIncome = 0;
  let financeExpense = 0;
  if (financeAccess) {
    const [incomeRes, expenseRes] = await Promise.all([
      supabase
        .from("financial_records")
        .select("amount")
        .gte("record_month", `${financeYear}-01-01`)
        .lt("record_month", `${Number(financeYear) + 1}-01-01`),
      supabase
        .from("expense_records")
        .select("amount")
        .gte("expense_month", `${financeYear}-01-01`)
        .lt("expense_month", `${Number(financeYear) + 1}-01-01`),
    ]);
    financeIncome = ((incomeRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount), 0);
    financeExpense = ((expenseRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount), 0);
  }
  const financePeriodLabel = yearToDateLabel(financeYear, Number(today.slice(5, 7)));

  const todayMonth = today.slice(5, 7);
  const todayDay = today.slice(8, 10);
  const monthName = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const birthdaysThisMonth = ((birthdays.data ?? []) as any[])
    .filter((p) => p.birthday && p.birthday.slice(5, 7) === todayMonth)
    .sort((a, b) => a.birthday.slice(8, 10).localeCompare(b.birthday.slice(8, 10)));

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name || "Member"}`}
        subtitle="Maligayang pagdating sa IDBCJ Connect."
        action={
          <div className="flex gap-2">
            <RoleBadge role={profile.role} />
            <StatusBadge status={profile.status} />
          </div>
        }
      />
      <Notice ok={ok} error={error} />

      {staff && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            ["Active", stat("active")],
            ["Visitors", stat("visitor")],
            ["Inactive", stat("inactive")],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-emerald-800">{n}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Announcements / Mga Anunsyo" className="lg:col-span-2">
          {(ann.data ?? []).length === 0 ? (
            <Empty>Wala pang anunsyo.</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(ann.data as any[]).map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    <span className="shrink-0 text-xs text-gray-400">{fmtDate(a.publish_at)}</span>
                  </div>
                  {a.ministries?.name && (
                    <span className="text-xs font-medium text-purple-700">{a.ministries.name}</span>
                  )}
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-600 line-clamp-4">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-right">
            <Link href="/portal/announcements" className="text-sm font-semibold text-emerald-700 hover:underline">
              Lahat ng anunsyo →
            </Link>
          </div>
        </Panel>

        <div className="space-y-6">
          {financeAccess && (
            <Panel title="Financial Report — Buod" subtitle={financePeriodLabel}>
              <FinanceSummaryPie year={financeYear} income={financeIncome} expense={financeExpense} />
            </Panel>
          )}

          <Panel title={`🎂 Kaarawan ngayong ${monthName}`}>
            {birthdaysThisMonth.length === 0 ? (
              <Empty>Walang may kaarawan ngayong buwan.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {birthdaysThisMonth.map((p) => {
                  const isToday = p.birthday.slice(8, 10) === todayDay;
                  const day = new Date(p.birthday.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  });
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className={isToday ? "font-semibold text-emerald-800" : "text-gray-700"}>
                        {p.full_name || "Member"}
                      </span>
                      <span className={isToday ? "font-semibold text-emerald-700" : "text-gray-400"}>
                        {isToday ? "Ngayon! 🎉" : day}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Ang aking mga Ministry">
            {(mine.data ?? []).length === 0 ? (
              <Empty>Wala ka pang ministry.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {(mine.data as any[]).map((m) => (
                  <li key={m.ministries?.id} className="flex items-center justify-between">
                    <Link href={`/portal/ministries/${m.ministries?.id}`} className="font-medium text-emerald-800 hover:underline">
                      {m.ministries?.name}
                    </Link>
                    {m.is_leader && <span className="text-xs text-purple-700">Leader</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Susunod na iskedyul ng paglilingkod">
            {(sched.data ?? []).length === 0 ? (
              <Empty>Walang nakatakda.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {(sched.data as any[]).map((s) => (
                  <li key={s.id}>
                    <span className="font-medium text-gray-900">{fmtDate(s.service_date)}</span>
                    <span className="text-gray-600"> · {s.title}</span>
                    <div className="text-xs text-gray-400">{s.ministries?.name}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Ang aking attendance">
            {myAtt.length === 0 ? (
              <Empty>Wala pang naka-tala.</Empty>
            ) : (
              <>
                <p className="mb-2 text-sm text-gray-600">
                  Dumalo ka sa {presentCount} sa huling {myAtt.length} na naka-tala.
                </p>
                <ul className="space-y-1 text-sm">
                  {myAtt.map((a, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-gray-600">
                        {fmtDate(a.services.service_date)} · {KIND_LABEL[a.services.kind] ?? a.services.kind}
                      </span>
                      <span className={a.present ? "font-semibold text-emerald-700" : "text-gray-400"}>
                        {a.present ? "Dumalo" : "Wala"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
