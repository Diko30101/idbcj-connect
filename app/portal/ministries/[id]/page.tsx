import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalAccess, isStaff, fmtDate, todayPH, isProtectedMinistryName } from "@/lib/portal";
import { isTulongFinancePortalUser } from "@/app/tulong-financial/finance-check";
import { MSG_PROTECTED_MEMBERS } from "@/lib/ministry-ops";
import {
  addMemberToMinistry,
  createSchedule,
  deleteSchedule,
  removeFromMinistry,
  setMinistryLeader,
} from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";
import { MinistryControls } from "@/components/portal/ministry-controls";

export default async function MinistryDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const { data: ministry } = await supabase.from("ministries").select("*").eq("id", id).maybeSingle();
  if (!ministry) notFound();
  const protectedMinistry = isProtectedMinistryName(ministry.name);
  // Ang "Tulong Financial Members" ay awtomatikong membership (view) — walang manual na dagdag/bawas.
  const isBorrowerMinistry = !!(ministry as any).is_borrower_ministry;
  const canManageMembers = !isBorrowerMinistry && staff && (profile.role === "admin" || !protectedMinistry);

  // Ang listahan ng mga pinahiram ay para sa Finance Ministry at Admin lang.
  const canSeeBorrowers = isBorrowerMinistry ? await isTulongFinancePortalUser() : false;

  const [mine, roster, sched] = await Promise.all([
    supabase.from("ministry_members").select("is_leader").eq("ministry_id", id).eq("profile_id", profile.id).maybeSingle(),
    supabase.rpc("ministry_roster", { m: id }),
    supabase.from("ministry_schedule").select("id, service_date, title, note, assigned_to").eq("ministry_id", id).gte("service_date", todayPH()).order("service_date").limit(30),
  ]);

  const isMember = !!mine.data;
  const isLeader = !!mine.data?.is_leader;
  const canManageSchedule = staff || isLeader;
  const rosterRows = (roster.data ?? []) as { profile_id: string; full_name: string | null; phone_number: string | null; status: string; is_leader: boolean }[];
  const nameOf = new Map(rosterRows.map((r) => [r.profile_id, r.full_name || "(walang pangalan)"]));

  let borrowerRows: { member_id: string; full_name: string | null; local_name: string | null; username: string | null; has_loan: boolean; has_login: boolean }[] = [];
  if (canSeeBorrowers) {
    const { data } = await supabase.from("tulong_financial_ministry_members").select("*").order("full_name");
    borrowerRows = (data ?? []) as typeof borrowerRows;
  }

  let candidates: { id: string; full_name: string | null }[] = [];
  if (canManageMembers) {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name").limit(1000);
    const inRoster = new Set(rosterRows.map((r) => r.profile_id));
    candidates = ((data ?? []) as any[]).filter((p) => !inRoster.has(p.id));
  }

  const back = `/portal/ministries/${id}`;

  return (
    <>
      <PageHeader
        title={ministry.name}
        subtitle={ministry.description ?? ministry.name_tl ?? ""}
        action={
          <Link href="/portal/ministries" className={btnGhostCls}>
            ← Ministries
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      {staff && (
        <div className="mb-6">
          <MinistryControls ministry={ministry} protectedMinistry={protectedMinistry} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Iskedyul ng paglilingkod">
            {((sched.data ?? []) as any[]).length === 0 ? (
              <Empty>Walang nakatakdang iskedyul.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {((sched.data ?? []) as any[]).map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {fmtDate(s.service_date)} · {s.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.assigned_to ? `Nakatalaga: ${nameOf.get(s.assigned_to) ?? "miyembro"}` : ""}
                        {s.note ? ` ${s.note}` : ""}
                      </div>
                    </div>
                    {canManageSchedule && (
                      <form action={deleteSchedule}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="ministry_id" value={id} />
                        <button className={btnDangerCls}>Burahin</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {canManageSchedule && (
            <Panel title="Magdagdag ng iskedyul">
              <form action={createSchedule} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="ministry_id" value={id} />
                <Field label="Petsa">
                  <input type="date" name="service_date" required className={inputCls} />
                </Field>
                <Field label="Paglalarawan">
                  <input name="title" required className={inputCls} placeholder="Ushers, Sunday Worship" />
                </Field>
                <Field label="Nakatalaga (opsyonal)">
                  <select name="assigned_to" className={inputCls} defaultValue="">
                    <option value="">Wala</option>
                    {rosterRows.map((r) => (
                      <option key={r.profile_id} value={r.profile_id}>{r.full_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tala (opsyonal)">
                  <input name="note" className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <button className={btnCls}>Idagdag</button>
                </div>
              </form>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Mga miyembro">
            {isBorrowerMinistry ? (
              !canSeeBorrowers ? (
                <Empty>Ang listahan ng mga miyembro ay para sa Finance Ministry at Admin lang.</Empty>
              ) : borrowerRows.length === 0 ? (
                <Empty>Wala pang kaanib na may hiram o account sa Tulong Financial.</Empty>
              ) : (
                <>
                  <p className="mb-4 text-xs text-gray-500">
                    Awtomatikong kasapi ang bawat kaanib na may hiram o may account. Hindi ito manual
                    na idinaragdag o inaalis.
                  </p>
                  <ul className="space-y-3 text-sm">
                    {borrowerRows.map((r) => (
                      <li key={r.member_id} className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-gray-900">{r.full_name || "(walang pangalan)"}</div>
                          <div className="text-xs text-gray-500">
                            {[r.local_name, r.username ? `@${r.username}` : null].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {r.has_loan && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">May hiram</span>
                          )}
                          {r.has_login && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">May account</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : rosterRows.length === 0 ? (
              <Empty>
                {isMember
                  ? "Miyembro ka ng ministry na ito. Ang leader at ang staff lang ang nakakakita ng listahan."
                  : staff
                    ? "Wala pang miyembro."
                    : "Hindi ka pa miyembro ng ministry na ito."}
              </Empty>
            ) : (
              <ul className="space-y-3 text-sm">
                {rosterRows.map((r) => (
                  <li key={r.profile_id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {r.full_name || "(walang pangalan)"}
                        {r.is_leader && <span className="ml-2 text-xs text-purple-700">Leader</span>}
                      </div>
                      <div className="text-xs text-gray-500">{r.phone_number || "-"}</div>
                    </div>
                    {canManageMembers && (
                      <div className="flex shrink-0 gap-1">
                        <form action={setMinistryLeader}>
                          <input type="hidden" name="profile_id" value={r.profile_id} />
                          <input type="hidden" name="ministry_id" value={id} />
                          <input type="hidden" name="make_leader" value={r.is_leader ? "false" : "true"} />
                          <input type="hidden" name="return_to" value={back} />
                          <button className={btnGhostCls}>{r.is_leader ? "Alisin leader" : "Gawing leader"}</button>
                        </form>
                        <form action={removeFromMinistry}>
                          <input type="hidden" name="profile_id" value={r.profile_id} />
                          <input type="hidden" name="ministry_id" value={id} />
                          <input type="hidden" name="return_to" value={back} />
                          <button className={btnDangerCls}>Alisin</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isBorrowerMinistry && staff && !canManageMembers && <p className="mt-4 text-xs text-gray-500">{MSG_PROTECTED_MEMBERS}</p>}
            {!isBorrowerMinistry && canManageMembers && candidates.length > 0 && (
              <form action={addMemberToMinistry} className="mt-4 flex gap-2">
                <input type="hidden" name="ministry_id" value={id} />
                <input type="hidden" name="return_to" value={back} />
                <select name="profile_id" className={inputCls} defaultValue="">
                  <option value="" disabled>Magdagdag ng miyembro…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name || c.id}</option>
                  ))}
                </select>
                <button className={btnCls}>Idagdag</button>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
