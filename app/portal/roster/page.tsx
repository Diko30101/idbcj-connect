import Link from "next/link";
import { getRosterContext, todayPH, fmtDate } from "@/lib/portal";
import { Empty, Notice } from "@/components/portal/ui";
import { inputCls, btnGhostCls } from "@/components/portal/form-bits";
import { MEMBER_STATUSES, ROSTER_BASE, type RosterMember } from "@/lib/roster";
import { RosterTableRow, RosterMemberCard } from "@/components/portal/roster-member";
import { RosterHeaderActions } from "@/components/portal/roster-header-actions";

// Roster ng mga kaanib (public.members) — hindi ito ang listahan ng mga account sa portal (/portal/members).
// Admin: lahat ng local. Administrative Ministry / Local Admin Ministry: sariling local. Walang halaga ng handog dito.
export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string; status?: string; q?: string; pending?: string; ok?: string; error?: string }>;
}) {
  const { local = "", status = "", q = "", pending = "", ok, error } = await searchParams;
  const ctx = await getRosterContext();
  const { supabase, locals, isAdmin } = ctx;
  const localIds = locals.map((l) => l.id);

  const term = q.replace(/[,()%*\\]/g, " ").trim();
  let query = supabase
    .from("members")
    .select("id, local_id, full_name, status, status_reason, confirmed_at, created_at")
    .order("full_name", { ascending: true })
    .limit(1000);
  if (locals.some((l) => l.id === local)) query = query.eq("local_id", local);
  else query = query.in("local_id", localIds);
  if ((MEMBER_STATUSES as string[]).includes(status)) query = query.eq("status", status);
  if (pending === "1") query = query.is("confirmed_at", null);
  if (term) query = query.ilike("full_name", `%${term}%`);

  const monthStart = todayPH().slice(0, 7) + "-01";
  const [membersRes, totalRes, activeRes, newRes, pendingRes, latestRes] = await Promise.all([
    query,
    supabase.from("members").select("id", { count: "exact", head: true }).in("local_id", localIds),
    supabase.from("members").select("id", { count: "exact", head: true }).in("local_id", localIds).eq("status", "Active"),
    supabase.from("members").select("id", { count: "exact", head: true }).in("local_id", localIds).gte("created_at", monthStart),
    supabase.from("members").select("id", { count: "exact", head: true }).in("local_id", localIds).is("confirmed_at", null),
    supabase.from("members").select("created_at").in("local_id", localIds).order("created_at", { ascending: false }).limit(1),
  ]);

  const members = (membersRes.data ?? []) as RosterMember[];
  const total = totalRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const newCount = newRes.count ?? 0;
  const pendingCount = pendingRes.count ?? 0;
  const latestCreated = (latestRes.data ?? [])[0]?.created_at as string | undefined;
  const localName = new Map(locals.map((l) => [l.id, l.name]));

  const path = (() => {
    const p = new URLSearchParams();
    if (local) p.set("local", local);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (pending) p.set("pending", pending);
    const s = p.toString();
    return s ? `${ROSTER_BASE}?${s}` : ROSTER_BASE;
  })();
  const exportHref = `${ROSTER_BASE}/export${path === ROSTER_BASE ? "" : "?" + path.split("?")[1]}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Local Ministry</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Mga Miyembro</h1>
          <p className="mt-1 text-sm text-gray-500">Membership Record at impormasyon ng kapatiran</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {isAdmin ? "Lahat ng local · ikaw ang Admin" : `Sakop mo: ${locals.map((l) => l.name).join(", ")}`}
          </p>
        </div>
        <RosterHeaderActions locals={locals} isAdmin={isAdmin} exportHref={exportHref} />
      </div>

      <Notice ok={ok} error={error} />

      {isAdmin && (pendingCount ?? 0) > 0 && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          May {pendingCount} na kaanib na naghihintay ng iyong kumpirmasyon.{" "}
          <Link href={`${ROSTER_BASE}?pending=1`} className="font-semibold underline">
            Tingnan
          </Link>
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="mt-1 text-sm text-gray-500">Kabuuang miyembro</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="mt-1 text-sm text-gray-500">
            Aktibo <span className="font-semibold text-emerald-600">{activePct}%</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{locals.length}</p>
          <p className="mt-1 text-sm text-gray-500">Mga locale</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{newCount}</p>
          <p className="mt-1 text-sm text-gray-500">Bagong miyembro ngayong buwan</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <h2 className="font-semibold text-gray-800">Listahan ng miyembro</h2>
          <span className="text-xs text-gray-400">
            {latestCreated ? `Huling idinagdag: ${fmtDate(latestCreated)}` : `${members.length} na tala`}
          </span>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-5 py-4">
          <label className="relative min-w-52 flex-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              autoComplete="off"
              placeholder="Maghanap ng pangalan…"
              aria-label="Maghanap ng miyembro"
              className={`${inputCls} pl-9`}
            />
          </label>
          {locals.length > 1 && (
            <select name="local" defaultValue={local} aria-label="I-filter ayon sa locale" className={`${inputCls} w-auto`}>
              <option value="">Lahat ng locale</option>
              {locals.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <select name="status" defaultValue={status} aria-label="I-filter ayon sa katayuan" className={`${inputCls} w-auto`}>
            <option value="">Lahat ng katayuan</option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="pending"
              value="1"
              defaultChecked={pending === "1"}
              className="h-4 w-4 rounded border-gray-300"
            />
            Hindi pa kumpirmado
          </label>
          <button type="submit" className={btnGhostCls}>
            I-filter
          </button>
        </form>

        {members.length === 0 ? (
          <div className="p-10 text-center">
            <Empty>Walang kaanib na tumutugma. Subukan ang ibang pangalan o filter.</Empty>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3 font-semibold">Pangalan</th>
                    <th className="px-5 py-3 font-semibold">Locale</th>
                    <th className="px-5 py-3 font-semibold">Katayuan</th>
                    <th className="px-5 py-3 text-right font-semibold">Mga Aksyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m, i) => (
                    <RosterTableRow
                      key={m.id}
                      member={m}
                      localName={localName.get(m.local_id) ?? ""}
                      isAdmin={isAdmin}
                      path={path}
                      index={i}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-gray-100 md:hidden">
              {members.map((m, i) => (
                <RosterMemberCard
                  key={m.id}
                  member={m}
                  localName={localName.get(m.local_id) ?? ""}
                  isAdmin={isAdmin}
                  path={path}
                  index={i}
                />
              ))}
            </div>
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
              {members.length} na kaanib{local || status || q || pending ? " (may filter)" : ""}.
            </p>
          </>
        )}
      </section>
    </>
  );
}
