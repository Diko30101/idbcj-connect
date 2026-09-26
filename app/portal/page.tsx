import Link from "next/link";import { requirePortalAccess, isStaff, isFinanceMember, fmtDate, todayPH, KIND_LABEL, FINANCE_MINISTRY_NAME } from "@/lib/portal";
import { yearToDateLabel, fmtPeso, monthLabel, FINANCE_CATEGORIES, FINANCE_CATEGORY_LABEL, type FinanceCategory } from "@/lib/finance";
import { getYearlyCollections, summarizeCollections, type CollectionRow } from "@/lib/finance-collections";
import { Empty, Notice, Panel, RoleBadge, StatusBadge } from "@/components/portal/ui";
import { FinanceSummaryPie } from "@/components/portal/finance-summary-pie";
import { FinanceCategoryPie, buildCategorySlices } from "@/components/portal/finance-category-pie";
import { auditTableLabel } from "@/lib/audit";

// YYYY-MM-DD + n araw -> YYYY-MM-DD (UTC math, sapat para sa date-only).
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type ActionItem = { icon: string; text: string; href: string; linkText: string };

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);
  const isAdmin = profile.role === "admin";
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
    supabase.rpc("member_birthdays"),
  ]);

  const myAtt = ((att.data ?? []) as any[])
    .filter((a) => a.services)
    .sort((a, b) => b.services.service_date.localeCompare(a.services.service_date))
    .slice(0, 8);
  const presentCount = myAtt.filter((a) => a.present).length;

  const stat = (s: string) => (counts.data ?? []).filter((p) => p.status === s).length;

  const myMinistryNames = ((mine.data ?? []) as any[]).map((m) => m.ministries?.name).filter(Boolean);
  const financeAccess = isFinanceMember(profile.role, myMinistryNames);
  // Tulong Financial buod: Admin o kasapi ng Finance Ministry (buong iglesia).
  const tulongAccess = isAdmin || myMinistryNames.includes(FINANCE_MINISTRY_NAME);
  const financeYear = today.slice(0, 4);
  let financeIncome = 0;
  let financeExpense = 0;
  let collections: CollectionRow[] = [];
  const localNames = new Map<string, string>();
  if (financeAccess) {
        // Ang "pumasok" ay galing LAMANG sa Abuluyan, Ambagan, Tulong sa Aral at
        // Pasalamat na na-encode ng Local Finance Ministry (mga naipadala na).
    const [colls, expenseRes, localsRes] = await Promise.all([
            getYearlyCollections(supabase, financeYear),
      supabase
        .from("expense_records")
        .select("amount")
        .gte("expense_month", `${financeYear}-01-01`)
        .lt("expense_month", `${Number(financeYear) + 1}-01-01`),
      isAdmin
        ? supabase.from("locals").select("id, key, name")
        : Promise.resolve({ data: null as { id: string; key: string; name: string }[] | null }),
    ]);
    collections = colls;
    financeIncome = collections.reduce((s, r) => s + r.amount, 0);
    financeExpense = ((expenseRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.amount), 0);
    for (const l of ((localsRes.data ?? []) as { id: string; key: string; name: string }[])) {
      localNames.set(l.key, l.name);
    }
  }

  // ---- Tulong Financial buod (Admin + Finance Ministry) ----
  let tulongTotalLent = 0;
  let tulongTotalPaid = 0;
  let tulongActiveBorrowers = 0;
  let tulongRecent: { date: string; name: string; kind: "hiram" | "bayad"; amount: number }[] = [];
  if (tulongAccess) {
    const [tLoansRes, tPaymentsRes] = await Promise.all([
      supabase.from("tulong_financial_loans").select("id, member_id, amount, date_borrowed"),
      supabase.from("tulong_financial_payments").select("id, amount, date_paid, loan_id"),
    ]);
    const tLoans = (tLoansRes.data ?? []) as any[];
    const tPayments = (tPaymentsRes.data ?? []) as any[];
    // Kunin ang mga pangalan ng kaanib nang hiwalay (maaaring ma-block ng RLS para sa hindi admin;
    // sa ganitong kaso ay "—" ang ipapakita pero tuloy pa rin ang mga total).
    const memberIds = [...new Set(tLoans.map((l) => String(l.member_id ?? "")).filter(Boolean))];
    let memberNameById = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: memRows } = await supabase.from("members").select("id, full_name").in("id", memberIds);
      memberNameById = new Map(((memRows ?? []) as any[]).map((m) => [String(m.id), m.full_name ?? "—"]));
    }
    const loanMember = new Map<string, { memberId: string; name: string }>();
    const tBalances = new Map<string, { name: string; bal: number }>();
    const txs: { date: string; name: string; kind: "hiram" | "bayad"; amount: number }[] = [];
    for (const l of tLoans) {
      const amt = Number(l.amount) || 0;
      tulongTotalLent += amt;
      const mid = String(l.member_id ?? "");
      const name = memberNameById.get(mid) ?? "—";
      if (mid) {
        loanMember.set(String(l.id), { memberId: mid, name });
        const e = tBalances.get(mid) ?? { name, bal: 0 };
        e.bal += amt;
        tBalances.set(mid, e);
      }
      txs.push({ date: String(l.date_borrowed ?? ""), name, kind: "hiram", amount: amt });
    }
    for (const p of tPayments) {
      const amt = Number(p.amount) || 0;
      tulongTotalPaid += amt;
      const lm = loanMember.get(String(p.loan_id));
      if (lm) {
        const e = tBalances.get(lm.memberId);
        if (e) e.bal -= amt;
      }
      txs.push({ date: String(p.date_paid ?? ""), name: lm?.name ?? "—", kind: "bayad", amount: amt });
    }
    tulongActiveBorrowers = [...tBalances.values()].filter((e) => e.bal > 0.005).length;
    tulongRecent = txs.filter((t) => t.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }

  // Buong Sistema dashboard (Admin lang): koleksyon ayon sa kategorya at local.
  const catTotals = new Map<FinanceCategory, number>();
  const localTotals = new Map<string, { name: string; cats: Map<FinanceCategory, number>; total: number }>();
  for (const r of collections) {
    catTotals.set(r.category, (catTotals.get(r.category) ?? 0) + r.amount);
    const key = r.localKey ?? "";
    let lt = localTotals.get(key);
    if (!lt) {
      lt = { name: key ? (localNames.get(key) ?? key) : "Hindi natukoy na local", cats: new Map(), total: 0 };
      localTotals.set(key, lt);
    }
    lt.cats.set(r.category, (lt.cats.get(r.category) ?? 0) + r.amount);
    lt.total += r.amount;
  }
  const localRows = [...localTotals.values()].sort((a, b) => b.total - a.total);
  const pieSlices = buildCategorySlices(catTotals);
  const financePeriodLabel = yearToDateLabel(financeYear, Number(today.slice(5, 7)));

  // ---- Bagong admin dashboard data ----
  const curMM = today.slice(5, 7);
  const curMonthLabel = monthLabel(`${financeYear}-${curMM}`);
  const prevDay = addDays(`${financeYear}-${curMM}-01`, -1);
  const prevMM = prevDay.slice(5, 7);
  const prevYear = prevDay.slice(0, 4);
  const prevMonthLabel = monthLabel(`${prevYear}-${prevMM}`);
  const catMonth = summarizeCollections(collections);

  let actionItems: ActionItem[] = [];
  let weekCols: number[] = [];
  let trackerRows: { name: string; weeks: boolean[]; total: number }[] = [];
  let attMaxDate: string | null = null;
  let attPresent = 0;
  let attLocalsRecorded = 0;
  let attTrend: { label: string; count: number }[] = [];
  let auditItems: { at: string; actor: string; text: string }[] = [];
  let resiboSent = 0;
  let resiboTotal = 0;

  if (isAdmin) {
    const dow = new Date(today + "T00:00:00Z").getUTCDay();
    const weekStart = addDays(today, -((dow + 6) % 7));
    const weekEnd = addDays(weekStart, 6);
    const trendStart = addDays(today, -55);

    const [dAbuluyan, dAmbagan, dTulong, dPasalamat, weekAbuluyan, resiboLetters, attLatest, attTrendRows, auditRows, tulongUserReq, tulongLoanReq] =
      await Promise.all([
        supabase.from("abuluyan_totals").select("id").eq("status", "draft").limit(500),
        supabase.from("ambagan_records").select("id").eq("status", "draft").limit(500),
        supabase.from("tulong_klase_records").select("id").eq("status", "draft").limit(500),
        supabase.from("pasalamat_records").select("id").eq("status", "draft").limit(500),
        supabase
          .from("abuluyan_totals")
          .select("local_id, service_date")
          .eq("status", "submitted")
          .gte("service_date", weekStart)
          .lte("service_date", weekEnd)
          .limit(500),
        supabase.from("letters").select("id, subject").ilike("subject", "Buwanang Resibo%").limit(300),
        supabase
          .from("attendance_records")
          .select("service_date")
          .order("service_date", { ascending: false })
          .limit(1),
        supabase
          .from("attendance_records")
          .select("service_date")
          .eq("present", true)
          .gte("service_date", trendStart)
          .limit(6000),
        supabase
          .from("audit_log")
          .select("id, at, actor, action, table_name")
          .order("at", { ascending: false })
          .limit(8),
        // Tulong Financial: mga naghihintay ng apruba ng admin
        supabase.from("tulong_username_requests").select("id").eq("status", "pending").limit(500),
        supabase.from("tulong_loan_requests").select("id").eq("status", "sent").limit(500),
      ]);

    const localsList = [...localNames.entries()].map(([key, name]) => ({ key, name }));
    // Kailangan din ang id->name para sa mga query na local_id ang gamit.
    const { data: localsWithId } = await supabase.from("locals").select("id, key, name");
    const idToName = new Map(((localsWithId ?? []) as { id: string; key: string; name: string }[]).map((l) => [l.id, l.name]));
    const idToKey = new Map(((localsWithId ?? []) as { id: string; key: string; name: string }[]).map((l) => [l.id, l.key]));

    // 1) Drafts
    const draftCounts: [string, number][] = [
      ["Abuluyan", (dAbuluyan.data ?? []).length],
      ["Ambagan", (dAmbagan.data ?? []).length],
      ["Tulong sa Aral", (dTulong.data ?? []).length],
      ["Pasalamat", (dPasalamat.data ?? []).length],
    ];
    const draftTotal = draftCounts.reduce((s, [, n]) => s + n, 0);
    if (draftTotal > 0) {
      actionItems.push({
        icon: "📝",
        text: `${draftTotal} draft na naghihintay ng pagsusumite (${draftCounts.filter(([, n]) => n > 0).map(([l, n]) => `${n} ${l}`).join(" · ")})`,
        href: "/portal/finance",
        linkText: "Tingnan ang mga draft",
      });
    }

    // 2) Tulong Financial: mga naghihintay ng apruba ng admin
    const tulongUserCount = (tulongUserReq.data ?? []).length;
    const tulongLoanCount = (tulongLoanReq.data ?? []).length;
    if (tulongUserCount + tulongLoanCount > 0) {
      const parts: string[] = [];
      if (tulongUserCount > 0) parts.push(`${tulongUserCount} account approval`);
      if (tulongLoanCount > 0) parts.push(`${tulongLoanCount} hiram`);
      actionItems.push({
        icon: "💰",
        text: `Tulong Financial: ${parts.join(" at ")} na naghihintay ng iyong apruba`,
        href: "/portal/inbox",
        linkText: "Tingnan sa Inbox",
      });
    }

    // 3) Mga local na walang Abuluyan ngayong linggo
    const weekLocalIds = new Set(((weekAbuluyan.data ?? []) as any[]).map((r) => String(r.local_id)).filter((v) => v && v !== "null"));
    const missingAbuluyan = ((localsWithId ?? []) as { id: string; name: string }[]).filter((l) => !weekLocalIds.has(String(l.id)));
    if (missingAbuluyan.length > 0) {
      const names = missingAbuluyan.slice(0, 3).map((l) => l.name).join(", ") + (missingAbuluyan.length > 3 ? ` at ${missingAbuluyan.length - 3} pa` : "");
      actionItems.push({
        icon: "⚠️",
        text: `${missingAbuluyan.length} local na walang Abuluyan ngayong linggo: ${names}`,
        href: "/portal/finance/abuluyan",
        linkText: "Tingnan ang Abuluyan",
      });
    }

    // 4) Buwanang Resibo ngayong buwan
    const resiboThisMonth = ((resiboLetters.data ?? []) as any[]).filter((l) => String(l.subject ?? "").includes(curMonthLabel));
    const resiboLocals = new Set(resiboThisMonth.map((l) => String(l.subject ?? "").split("—")[1]?.trim()).filter(Boolean));
    resiboSent = resiboLocals.size;
    resiboTotal = localsList.length;
    if (resiboSent < resiboTotal) {
      actionItems.push({
        icon: "📨",
        text: `Buwanang Resibo (${curMonthLabel}): ${resiboSent} sa ${resiboTotal} local pa lang ang naipadala`,
        href: "/portal/finance/resibo",
        linkText: "Magpadala ng resibo",
      });
    }

    // 5) Attendance ng huling pagtitipon
    attMaxDate = ((attLatest.data ?? []) as any[])[0]?.service_date ?? null;
    if (attMaxDate) {
      const { data: attRows } = await supabase
        .from("attendance_records")
        .select("local_id")
        .eq("service_date", attMaxDate)
        .limit(3000);
      const rows = (attRows ?? []) as any[];
      attPresent = rows.length;
      const recordedIds = new Set(rows.map((r) => String(r.local_id)));
      attLocalsRecorded = recordedIds.size;
      const missingAtt = ((localsWithId ?? []) as { id: string; name: string }[]).filter((l) => !recordedIds.has(String(l.id)));
      if (missingAtt.length > 0) {
        const names = missingAtt.slice(0, 3).map((l) => l.name).join(", ") + (missingAtt.length > 3 ? ` at ${missingAtt.length - 3} pa` : "");
        actionItems.push({
          icon: "👥",
          text: `${missingAtt.length} local na walang attendance record noong ${fmtDate(attMaxDate)}: ${names}`,
          href: "/portal/attendance-record",
          linkText: "Tingnan ang attendance",
        });
      }
    }

    // Lingguhang tracker: Abuluyan ngayong buwan, bawat local x bawat linggo (L1 = araw 1–7, ...)
    const daysInMonth = new Date(Number(financeYear), Number(curMM), 0).getUTCDate();
    const numWeeks = Math.ceil(daysInMonth / 7);
    weekCols = Array.from({ length: numWeeks }, (_, i) => i + 1);
    const abuluyanWeeks = new Map<string, Set<number>>();
    const abuluyanMonthTotal = new Map<string, number>();
    for (const r of collections) {
      if (r.category !== "abuluyan" || r.month !== curMM || !r.localKey) continue;
      const w = Math.ceil(Number(r.date.slice(8, 10)) / 7);
      if (!abuluyanWeeks.has(r.localKey)) abuluyanWeeks.set(r.localKey, new Set());
      abuluyanWeeks.get(r.localKey)!.add(w);
      abuluyanMonthTotal.set(r.localKey, (abuluyanMonthTotal.get(r.localKey) ?? 0) + r.amount);
    }
    trackerRows = localsList.map(({ key, name }) => ({
      name,
      weeks: weekCols.map((w) => abuluyanWeeks.get(key)?.has(w) ?? false),
      total: abuluyanMonthTotal.get(key) ?? 0,
    }));

    // Trend: huling 8 linggo, bilang ng dumalo bawat linggo
    const trendCounts = new Array(8).fill(0) as number[];
    for (const r of ((attTrendRows.data ?? []) as any[])) {
      const ds = String(r.service_date ?? "").slice(0, 10);
      if (!ds) continue;
      const diffDays = Math.floor((new Date(today + "T00:00:00Z").getTime() - new Date(ds + "T00:00:00Z").getTime()) / 86400000);
      const wi = Math.min(7, Math.floor(diffDays / 7));
      if (wi >= 0) trendCounts[7 - wi]++;
    }
    attTrend = trendCounts.map((count, i) => ({
      label: addDays(today, -(7 - i) * 7).slice(5).replace("-", "/"),
      count,
    }));

    // Kamakailang aktibidad
    const aRows = (auditRows.data ?? []) as any[];
    const actorIds = Array.from(new Set(aRows.map((r) => r.actor).filter(Boolean)));
    const { data: actorNames } = actorIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as any[] };
    const actorNameOf = new Map(((actorNames ?? []) as any[]).map((n) => [n.id, n.full_name || n.email || "—isang user"]));
    auditItems = aRows.map((r) => ({
      at: r.at,
      actor: actorNameOf.get(r.actor) ?? "—isang user",
      text: `${r.action ?? "binago"} ang ${auditTableLabel(r.table_name ?? "")}`,
    }));
  }

  const todayMonth = today.slice(5, 7);
  const todayDay = today.slice(8, 10);
  const monthName = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const birthdaysThisMonth = ((birthdays.data ?? []) as any[])
    .filter((p) => p.birthday && p.birthday.slice(5, 7) === todayMonth)
    .sort((a, b) => a.birthday.slice(8, 10).localeCompare(b.birthday.slice(8, 10)));

  const quickLinks = [
    ["Abuluyan", "/portal/finance/abuluyan"],
    ["Ambagan", "/portal/finance/ambagan"],
    ["Tulong sa Aral", "/portal/finance/tulong"],
    ["Pasalamat", "/portal/finance/pasalamat"],
    ["Attendance Record", "/portal/attendance-record"],
    ["Buwanang Resibo", "/portal/finance/resibo"],
    ["Membership Record", "/portal/roster"],
    ["Audit Log", "/portal/audit"],
  ] as [string, string][];

  return (
    <>
      {/* Welcome banner — istilo mula sa aprubadong sidebar mockup */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome, {profile.full_name || "Member"}
          </h1>
          <p className="mt-1 text-[15px] text-gray-500">Maligayang pagdating sa IDBCJ Connect.</p>
        </div>
        <div className="flex gap-2">
          <RoleBadge role={profile.role} />
          <StatusBadge status={profile.status} />
        </div>
      </div>
      <Notice ok={ok} error={error} />

      {isAdmin && (
        <section className="mb-6">
          <Panel title="Kailangang Aksyunan" subtitle="Mga agarang gawain na nangangailangan ng iyong atensyon">
            {actionItems.length === 0 ? (
              <Empty>🎉 Wala kang kailangang aksyunan ngayon.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {actionItems.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none">{a.icon}</span>
                      <p className="text-sm text-gray-800">{a.text}</p>
                    </div>
                    <Link href={a.href} className="shrink-0 text-sm font-semibold text-emerald-700 hover:underline">
                      {a.linkText} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      )}

      {isAdmin && (
        <section className="mb-6">
          <Panel title="Buong Sistema — Pangkalahatang Tanaw" subtitle={financePeriodLabel}>
            <div className="mb-5 flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="shrink-0">
                <FinanceCategoryPie year={financeYear} title="Koleksyon ayon sa kategorya" slices={pieSlices} />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-emerald-700">{fmtPeso(financeIncome)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Pumasok</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-red-700">{fmtPeso(financeExpense)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Lumabas</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-700">{fmtPeso(financeIncome - financeExpense)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Balanse</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-emerald-800">{stat("active")}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Active na kaanib</div>
              </div>
            </div>
            </div>

            <h3 className="mb-2 text-sm font-bold text-gray-900">
              Paghahambing sa nakaraang buwan ({prevMonthLabel})
            </h3>
            <div className="mb-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {FINANCE_CATEGORIES.map((c) => {
                const cur = catMonth.get(`${curMM}_${c}`) ?? 0;
                const prev = prevYear === financeYear ? (catMonth.get(`${prevMM}_${c}`) ?? 0) : null;
                const diff = prev === null ? null : cur - prev;
                const pct = prev === null ? null : prev > 0 ? (diff! / prev) * 100 : cur > 0 ? 100 : 0;
                return (
                  <div key={c} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{FINANCE_CATEGORY_LABEL[c]}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{fmtPeso(cur)}</span>
                      {pct === null ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            diff! > 0 ? "bg-emerald-100 text-emerald-800" : diff! < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {diff! > 0 ? "+" : ""}{fmtPeso(diff!)}{" "}({pct! > 0 ? "+" : ""}{pct!.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="mb-2 text-sm font-bold text-gray-900">Abuluyan ngayong buwan — lingguhang tracker</h3>
            <p className="mb-2 text-xs text-gray-500">L1 = araw 1–7, L2 = 8–14, L3 = 15–21, L4 = 22–28, L5 = 29–31</p>
            {trackerRows.length === 0 ? (
              <Empty>Wala pang local na naitala.</Empty>
            ) : (
              <div className="mb-5 overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Local</th>
                      {weekCols.map((w) => (
                        <th key={w} className="px-2 py-2 text-center">L{w}</th>
                      ))}
                      <th className="px-4 py-2 text-right">Kabuuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trackerRows.map((r) => (
                      <tr key={r.name}>
                        <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                        {r.weeks.map((has, i) => (
                          <td key={i} className="px-2 py-2 text-center">
                            {has ? (
                              <span className="font-bold text-emerald-600">✓</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{fmtPeso(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mb-2 text-sm font-bold text-gray-900">Koleksyon ayon sa local</h3>
            {localRows.length === 0 ? (
              <Empty>Wala pang naitatalang koleksyon para sa {financeYear}.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Local</th>
                      {FINANCE_CATEGORIES.map((c) => (
                        <th key={c} className="px-4 py-2 text-right">
                          {FINANCE_CATEGORY_LABEL[c]}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right">Kabuuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {localRows.map((r) => (
                      <tr key={r.name}>
                        <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                        {FINANCE_CATEGORIES.map((c) => (
                          <td key={c} className="px-4 py-2 text-right text-gray-700">
                            {fmtPeso(r.cats.get(c) ?? 0)}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold text-gray-900">{fmtPeso(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-right">
              <Link
                href="/portal/finance/report"
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                Tingnan ang buong ulat →
              </Link>
            </div>
          </Panel>
        </section>
      )}

      {isAdmin && attMaxDate && (
        <section className="mb-6">
          <Panel title="Attendance — Huling Pagtitipon" subtitle={fmtDate(attMaxDate)}>
            <div className="mb-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-2xl font-bold text-emerald-800">{attPresent}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Dumalo</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-2xl font-bold text-emerald-800">{attLocalsRecorded}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Local na naitala</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-2xl font-bold text-emerald-800">{attTrend.length > 0 ? attTrend[attTrend.length - 1].count : 0}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Ngayong linggo</div>
              </div>
            </div>
            <h3 className="mb-2 text-sm font-bold text-gray-900">Trend — huling 8 linggo</h3>
            <div className="flex h-28 items-end gap-2">
              {attTrend.map((t, i) => {
                const max = Math.max(1, ...attTrend.map((x) => x.count));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">{t.count}</span>
                    <div
                      className="w-full rounded-t bg-emerald-500"
                      style={{ height: `${Math.max(4, (t.count / max) * 72)}px` }}
                      title={`${t.label}: ${t.count}`}
                    />
                    <span className="text-[10px] text-gray-400">{t.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-right">
              <Link href="/portal/attendance-record" className="text-sm font-semibold text-emerald-700 hover:underline">
                Buksan ang Attendance Record →
              </Link>
            </div>
          </Panel>
        </section>
      )}

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

      {/* Announcement — full width sa itaas ng main column; walang right sidebar.
          Mga card nasa 2-column grid sa ibaba para hindi mahaba ang scroll. */}
      <Panel title="Announcements / Mga Anunsyo" className="mb-6">
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

      {/* Mga card sa ibaba ng announcement, sa iisang main column — 2 column sa desktop, 1 sa mobile */}
      <div className="grid gap-6 md:grid-cols-2">
        {financeAccess && !isAdmin && (
          <Panel title="Financial Report — Buod" subtitle={financePeriodLabel}>
            <FinanceSummaryPie year={financeYear} income={financeIncome} expense={financeExpense} />
          </Panel>
        )}

        {isAdmin && auditItems.length > 0 && (
          <Panel title="Kamakailang Aktibidad">
            <ul className="space-y-2 text-sm">
              {auditItems.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <span className="text-gray-700">
                    <span className="font-medium text-gray-900">{a.actor}</span> {a.text}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{fmtDate(a.at)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-right">
              <Link href="/portal/audit" className="text-sm font-semibold text-emerald-700 hover:underline">
                Buksan ang Audit Log →
              </Link>
            </div>
          </Panel>
        )}

        {isAdmin && (
          <Panel title="Mabilisang Link">
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-medium text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {label}
                </Link>
              ))}
            </div>
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

        {isAdmin && (
          <Panel title="Paalala sa Seguridad">
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>Huwag ibahagi ang iyong login kahit kanino.</li>
              <li>Ang mga resibo at talaan ng kaloob ay para sa Finance Ministry lamang.</li>
              <li>Iulat agad kung may kahina-hinalang aktibidad sa Audit Log.</li>
            </ul>
          </Panel>
        )}

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

      {tulongAccess && (
        <section className="mb-6">
          <Panel title="💰 Tulong Financial — Buod" subtitle="Pangkalahatang tanaw ng mga hiram at bayad">
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-amber-700">{fmtPeso(tulongTotalLent)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Kabuuang Ipinahiram</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-emerald-700">{fmtPeso(tulongTotalPaid)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Kabuuang Nabayaran</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-red-700">{fmtPeso(tulongTotalLent - tulongTotalPaid)}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Balanseng Natitira</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-700">{tulongActiveBorrowers}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">May Hiram Pa</div>
              </div>
            </div>
            <h3 className="mb-2 text-sm font-bold text-gray-900">Huling mga transaksyon</h3>
            {tulongRecent.length === 0 ? (
              <Empty>Wala pang transaksyon.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Petsa</th>
                      <th className="px-4 py-2">Kaanib</th>
                      <th className="px-4 py-2">Uri</th>
                      <th className="px-4 py-2 text-right">Halaga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tulongRecent.map((t, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-700">{fmtDate(t.date)}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{t.name}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.kind === "hiram" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {t.kind === "hiram" ? "Hiram" : "Bayad"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{fmtPeso(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-right">
              <Link href="/portal/finance/tulong-financial" className="text-sm font-semibold text-emerald-700 hover:underline">
                Buksan ang Tulong Financial →
              </Link>
            </div>
          </Panel>
        </section>
      )}
    </>
  );
}
