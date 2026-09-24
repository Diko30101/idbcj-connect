import Link from "next/link";
import { getRosterContext } from "@/lib/portal";
import { addMember } from "./actions";
import { Empty, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";
import { RosterRow } from "@/components/portal/roster-row";
import { MEMBER_STATUSES, ROSTER_BASE, type RosterMember } from "@/lib/roster";

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

  const term = q.replace(/[,()%*\\]/g, " ").trim();
  let query = supabase
    .from("members")
    .select("id, local_id, full_name, status, status_reason, confirmed_at, created_at")
    .order("full_name", { ascending: true })
    .limit(1000);
  if (locals.some((l) => l.id === local)) query = query.eq("local_id", local);
  else query = query.in("local_id", locals.map((l) => l.id));
  if ((MEMBER_STATUSES as string[]).includes(status)) query = query.eq("status", status);
  if (pending === "1") query = query.is("confirmed_at", null);
  if (term) query = query.ilike("full_name", `%${term}%`);
  const { data } = await query;
  const members = (data ?? []) as RosterMember[];
  const localName = new Map(locals.map((l) => [l.id, l.name]));

  // Bilang ng naghihintay ng kumpirmasyon (para sa Admin)
  const { count: pendingCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .in("local_id", locals.map((l) => l.id))
    .is("confirmed_at", null);

  const path = (() => {
    const p = new URLSearchParams();
    if (local) p.set("local", local);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (pending) p.set("pending", pending);
    const s = p.toString();
    return s ? `${ROSTER_BASE}?${s}` : ROSTER_BASE;
  })();

  return (
    <>
      <PageHeader
        title="Roster ng mga Kaanib"
        subtitle={isAdmin ? "Lahat ng local · ikaw ang Admin" : `Sakop mo: ${locals.map((l) => l.name).join(", ")}`}
      />
      <Notice ok={ok} error={error} />

      {isAdmin && (pendingCount ?? 0) > 0 && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          May {pendingCount} na kaanib na naghihintay ng iyong kumpirmasyon.{" "}
          <Link href={`${ROSTER_BASE}?pending=1`} className="font-semibold underline">
            Tingnan
          </Link>
        </p>
      )}

      <div className="mt-6">
        <Panel title="Magdagdag ng kaanib">
          <form action={addMember} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] sm:items-end">
            <input type="hidden" name="path" value={ROSTER_BASE} />
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Buong pangalan</span>
              <input name="full_name" required maxLength={200} autoComplete="off" className={inputCls} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Local</span>
              <select name="local_id" required defaultValue={locals.length === 1 ? locals[0].id : ""} className={inputCls}>
                {locals.length > 1 && (
                  <option value="" disabled>
                    Pumili…
                  </option>
                )}
                {locals.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnCls}>
              Idagdag
            </button>
          </form>
          <p className="mt-3 text-xs text-gray-500">
            {isAdmin
              ? "Kumpirmado agad ang idadagdag ng Admin."
              : "Ang idadagdag mo ay Active pero hindi pa kumpirmado; kailangang kumpirmahin ng Admin bago ito makatanggap ng handog."}
          </p>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`Mga Kaanib (${members.length})`}>
          <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Hanapin ang pangalan</span>
              <input name="q" defaultValue={q} autoComplete="off" className={inputCls} />
            </label>
            {locals.length > 1 && (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Local</span>
                <select name="local" defaultValue={local} className={inputCls}>
                  <option value="">Lahat</option>
                  {locals.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select name="status" defaultValue={status} className={inputCls}>
                <option value="">Lahat</option>
                {MEMBER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input type="checkbox" name="pending" value="1" defaultChecked={pending === "1"} />
              Hindi pa kumpirmado
            </label>
            <button type="submit" className={btnGhostCls}>
              I-filter
            </button>
          </form>

          {members.length === 0 ? (
            <Empty>Walang kaanib na tumutugma.</Empty>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((m) => (
                <RosterRow key={m.id} member={m} localName={localName.get(m.local_id) ?? ""} isAdmin={isAdmin} path={path} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
