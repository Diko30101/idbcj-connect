import Link from "next/link";
import { getRosterContext, todayPH, fmtDate } from "@/lib/portal";
import { Empty, Notice, Panel } from "@/components/portal/ui";
import { inputCls, btnGhostCls } from "@/components/portal/form-bits";
import { AttendanceRecordForm, AttendanceCsvButtons } from "@/components/portal/attendance-record-form";
import { AttendanceSubmitForm } from "@/components/portal/attendance-submit-form";
import { SERVICE_TYPES, ATTENDANCE_RECORD_BASE, GATHERING_TYPES, gatheringTypeLabel, isSunday, isSundayOnlyType, isValidDate, listSundays, lastSunday, fmtSundayLabel } from "./constants";

// Attendance Record (Pangasiwaan): itinatala ng local secretary ang
// pagdalo ng bawat local sa bawat pagkakatipon, galing sa ROSTER
// (public.members) -- hindi sa mga login account (profiles).
// Tabs: Magtala (form) | Mga dumalo (bawat pagkakatipon) | Hanapin.

type TabId = "magtala" | "dumalo" | "hanapin";
const TABS: { id: TabId; label: string }[] = [
  { id: "magtala", label: "Magtala" },
  { id: "dumalo", label: "Mga dumalo" },
  { id: "hanapin", label: "Hanapin" },
];

const norm = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

type Gathering = {
  date: string;
  type: string;
  status: "draft" | "submitted";
  memberIds: Set<string>;
  guests: { name: string; kind: string; homeLocalId: string | null; memberId: string | null }[];
};

function tabHref(tab: TabId, params: Record<string, string>) {
  const p = new URLSearchParams({ tab, ...params });
  return `${ATTENDANCE_RECORD_BASE}?${p.toString()}`;
}

function StatusBadge({ status }: { status: "draft" | "submitted" }) {
  return status === "submitted" ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Na-submit</span>
  ) : (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Draft</span>
  );
}

// Talaan ng mga dumalo sa isang pagkakatipon (ginagamit sa Magtala at Mga dumalo)
function TalaanTable({
  gathering,
  memberName,
  localName,
  activeLocalName,
}: {
  gathering: Gathering;
  memberName: Map<string, string | null>;
  localName: Map<string, string>;
  activeLocalName: string;
}) {
  const memberRows = [...gathering.memberIds].map((id) => ({
    name: memberName.get(id) ?? "(walang pangalan)",
    kind: "Kaanib",
    local: activeLocalName,
  }));
  const guestRows = gathering.guests.map((gu) => ({
    name: gu.name,
    kind: gu.kind === "visitor" ? "Bisita" : "Ibang local",
    local: gu.kind === "visitor" ? "—" : (localName.get(gu.homeLocalId ?? "") ?? ""),
  }));
  const rows = [...memberRows, ...guestRows];
  const nKaanib = memberRows.length;
  const nBisita = gathering.guests.filter((gu) => gu.kind === "visitor").length;
  const nIbang = gathering.guests.filter((gu) => gu.kind === "other_local").length;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-3">Pangalan</th>
              <th className="py-2 pr-3">Uri</th>
              <th className="py-2">Local</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 font-medium text-gray-900">{r.name}</td>
                <td
                  className={`py-2 pr-3 ${r.kind === "Bisita" ? "font-semibold text-amber-700" : r.kind === "Ibang local" ? "font-semibold text-blue-700" : "text-gray-600"}`}
                >
                  {r.kind}
                </td>
                <td className="py-2 text-gray-600">{r.local}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Kabuuan: {rows.length} dumalo · {nKaanib} kaanib{nBisita > 0 && ` · ${nBisita} bisita`}
        {nIbang > 0 && ` · ${nIbang} galing ibang local`}
      </p>
    </>
  );
}

export default async function AttendanceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; local?: string; date?: string; type?: string; q?: string; sdate?: string; edit?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, locals, isAdmin } = await getRosterContext();
  const activeLocal = locals.find((l) => l.id === sp.local) ?? locals[0];
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "magtala";

  const [{ data: allLocals }, { data: roster }, { data: records }, { data: guests }] = await Promise.all([
    supabase.from("locals").select("id, name").order("name"),
    supabase
      .from("members")
      .select("id, full_name")
      .eq("local_id", activeLocal.id)
      .eq("status", "Active")
      .order("full_name")
      .limit(2000),
    supabase
      .from("attendance_records")
      .select("member_id, service_date, service_type, status")
      .eq("local_id", activeLocal.id)
      .order("service_date", { ascending: false })
      .limit(5000),
    supabase
      .from("attendance_guests")
      .select("name, kind, home_local_id, member_id, service_date, service_type, status")
      .eq("local_id", activeLocal.id)
      .order("service_date", { ascending: false })
      .limit(5000),
  ]);

  const memberName = new Map(((roster ?? []) as any[]).map((m) => [String(m.id), m.full_name as string | null]));
  const localName = new Map(((allLocals ?? []) as any[]).map((l) => [String(l.id), l.name as string]));

  const gatherings = new Map<string, Gathering>();
  const markStatus = (g: Gathering, s: unknown) => {
    if (s === "submitted") g.status = "submitted";
  };
  for (const r of ((records ?? []) as any[])) {
    const key = `${r.service_date}|${r.service_type}`;
    let g = gatherings.get(key);
    if (!g) {
      g = { date: r.service_date, type: r.service_type, status: "draft", memberIds: new Set(), guests: [] };
      gatherings.set(key, g);
    }
    markStatus(g, r.status);
    g.memberIds.add(String(r.member_id));
  }
  for (const gu of ((guests ?? []) as any[])) {
    const key = `${gu.service_date}|${gu.service_type}`;
    let g = gatherings.get(key);
    if (!g) {
      g = { date: gu.service_date, type: gu.service_type, status: "draft", memberIds: new Set(), guests: [] };
      gatherings.set(key, g);
    }
    markStatus(g, gu.status);
    g.guests.push({ name: gu.name, kind: gu.kind, homeLocalId: gu.home_local_id ? String(gu.home_local_id) : null, memberId: gu.member_id ? String(gu.member_id) : null });
  }
  const gatheringList = [...gatherings.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // --- Magtala: napiling petsa/uri + umiiral na tala ---
  // Ang "Linggo" ay Linggo lang sa kalendaryo (kasama ang mga dating Linggo);
  // ang mga Pasalamat (Anniversary, New Year, atbp.) ay pwedeng kahit anong
  // araw sa kalendaryo -- gaya ng sa Pasalamatan.
  const selType = (SERVICE_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as string) : "Linggo";
  const selTypeLabel = gatheringTypeLabel(selType);
  const sundayOnly = isSundayOnlyType(selType);
  const sundayOpts = listSundays(todayPH(), 12, 4);
  const defaultDate = sundayOnly ? lastSunday(todayPH()) : todayPH();
  const selDate = (() => {
    const d = sp.date;
    if (d && isValidDate(d) && (!sundayOnly || isSunday(d))) return d;
    return defaultDate;
  })();
  const dateOpts = sundayOpts.some((s) => s.value === selDate)
    ? sundayOpts
    : [...sundayOpts, { value: selDate, label: fmtSundayLabel(selDate) }].sort((a, b) =>
        a.value < b.value ? -1 : 1,
      );
  const editMode = sp.edit === "1";
  const existing = gatherings.get(`${selDate}|${selType}`);
  const presentIds = existing ? [...existing.memberIds] : [];
  const visitorsDefault = existing ? existing.guests.filter((g) => g.kind === "visitor").map((g) => g.name) : [];
  const otherLocalsDefault = existing
    ? existing.guests
        .filter((g) => g.kind === "other_local")
        .map((g) => ({ name: g.name, memberId: g.memberId ?? "", homeLocalId: g.homeLocalId ?? "", homeLocalName: localName.get(g.homeLocalId ?? "") ?? "" }))
    : [];

  // --- Hanapin ---
  const q = (sp.q ?? "").trim();
  const qWords = norm(q).split(/\s+/).filter(Boolean);
  const sdate = sp.sdate ?? "all";
  const searchDates = sdate === "all" ? gatheringList : gatheringList.filter((g) => g.date === sdate);
  const matchedMembers = qWords.length
    ? ((roster ?? []) as any[]).filter((m) => qWords.every((w) => norm(m.full_name).includes(w)))
    : [];
  const matchedGuests = qWords.length
    ? [...gatherings.values()].flatMap((g) =>
        g.guests
          .filter((gu) => qWords.every((w) => norm(gu.name).includes(w)))
          .map((gu) => ({ ...gu, date: g.date, type: g.type })),
      )
    : [];

  const baseParams = { local: activeLocal.id };

  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pangasiwaan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Attendance Record</h1>
        <p className="mt-1 text-sm text-gray-500">Talaan ng pagdalo sa bawat pagkakatipon · {activeLocal.name}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {isAdmin ? "Lahat ng local · ikaw ang Admin" : `Sakop mo: ${locals.map((l) => l.name).join(", ")}`}
        </p>
      </div>

      <Notice ok={sp.ok} error={sp.error} />

      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id, baseParams)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "magtala" && (
        <>
          <Panel title="Piliin ang pagkakatipon" className="mb-5">
            <form method="get" action={ATTENDANCE_RECORD_BASE} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="magtala" />
              {locals.length > 1 && (
                <label className="text-sm font-medium text-gray-700">
                  Local
                  <select name="local" defaultValue={activeLocal.id} className={`${inputCls} mt-1 w-auto`}>
                    {locals.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-gray-700">
                Uri ng pagkakatipon
                <select name="type" defaultValue={selType} className={`${inputCls} mt-1`}>
                  {GATHERING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {sundayOnly ? (
                <label className="text-sm font-medium text-gray-700">
                  Petsa (Linggo)
                  <select name="date" defaultValue={selDate} required className={`${inputCls} mt-1`}>
                    {dateOpts.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="text-sm font-medium text-gray-700">
                  Petsa
                  <input type="date" name="date" defaultValue={selDate} required className={`${inputCls} mt-1`} />
                </label>
              )}
              <button type="submit" className={btnGhostCls}>
                Buksan
              </button>
            </form>
          </Panel>

          {existing && existing.status === "submitted" && (
            <Panel
              title={`Talaan ng mga dumalo — ${fmtDate(selDate)} · ${selTypeLabel}`}
              subtitle="Na-submit na sa Finance Ministry; hindi na pwedeng baguhin."
            >
              <div className="mb-3">
                <StatusBadge status="submitted" />
              </div>
              <TalaanTable
                gathering={existing}
                memberName={memberName}
                localName={localName}
                activeLocalName={activeLocal.name}
              />
            </Panel>
          )}

          {existing && existing.status === "draft" && !editMode && (
            <Panel
              title={`Talaan ng mga dumalo — ${fmtDate(selDate)} · ${selTypeLabel}`}
              subtitle="Suriin ang talaan bago i-submit sa Finance Ministry."
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status="draft" />
                <span className="text-xs text-gray-500">Maaari pang i-edit bago i-submit.</span>
              </div>
              <TalaanTable
                gathering={existing}
                memberName={memberName}
                localName={localName}
                activeLocalName={activeLocal.name}
              />
              <div className="mt-4">
                <AttendanceCsvButtons localId={activeLocal.id} serviceDate={selDate} serviceType={selType} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <Link
                  href={tabHref("magtala", { ...baseParams, date: selDate, type: selType, edit: "1" })}
                  className={btnGhostCls}
                >
                  I-edit ang tala
                </Link>
                <AttendanceSubmitForm
                  localId={activeLocal.id}
                  serviceDate={selDate}
                  serviceType={selType}
                  count={existing.memberIds.size + existing.guests.length}
                />
              </div>
            </Panel>
          )}

          {(!existing || (existing.status === "draft" && editMode)) && (
            <Panel
              title={`Magtala ng pagdalo — ${fmtDate(selDate)} · ${selTypeLabel}`}
              subtitle={
                existing
                  ? "Draft pa lang ito; ang pag-save ay papalitan ang kasalukuyang tala."
                  : "Wala pang naka-tala sa pagtitipong ito. Mase-save ito bilang draft."
              }
            >
              {existing && (
                <div className="mb-4">
                  <Link href={tabHref("magtala", { ...baseParams, date: selDate, type: selType })} className={btnGhostCls}>
                    ← Bumalik sa talaan
                  </Link>
                </div>
              )}
              <AttendanceRecordForm
                localId={activeLocal.id}
                localName={activeLocal.name}
                serviceDate={selDate}
                serviceType={selType}
                members={((roster ?? []) as any[]).map((m) => ({ id: String(m.id), full_name: m.full_name }))}
                presentIds={presentIds}
                visitorsDefault={visitorsDefault}
                otherLocalsDefault={otherLocalsDefault}
                allLocals={((allLocals ?? []) as any[]).map((l) => ({ id: String(l.id), name: l.name }))}
              />
            </Panel>
          )}
        </>
      )}

      {tab === "dumalo" && (
        <Panel title="Mga pagkakatipon" subtitle="Pindutin ang isang petsa para makita ang listahan ng mga dumalo.">
          {gatheringList.length === 0 ? (
            <Empty>Wala pang naka-talang pagdalo para sa local na ito.</Empty>
          ) : (
            <div className="space-y-2">
              {gatheringList.map((g) => {
                return (
                  <details key={`${g.date}|${g.type}`} className="rounded-lg border border-gray-200">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-emerald-50/40">
                      <span className="text-sm">
                        <strong className="font-semibold text-gray-900">{fmtDate(g.date)}</strong>
                        <span className="text-gray-500"> · {gatheringTypeLabel(g.type)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={g.status} />
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {g.memberIds.size + g.guests.length} dumalo
                        </span>
                      </span>
                    </summary>
                    <div className="border-t border-gray-100 px-4 py-3">
                      <TalaanTable
                        gathering={g}
                        memberName={memberName}
                        localName={localName}
                        activeLocalName={activeLocal.name}
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === "hanapin" && (
        <>
          <Panel title="Hanapin kung dumalo ang kaanib" className="mb-5">
            <form method="get" action={ATTENDANCE_RECORD_BASE} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="hanapin" />
              <input type="hidden" name="local" value={activeLocal.id} />
              <label className="text-sm font-medium text-gray-700">
                Petsa
                <select name="sdate" defaultValue={sdate} className={`${inputCls} mt-1 w-auto`}>
                  <option value="all">Lahat ng petsa</option>
                  {gatheringList.map((g) => (
                    <option key={`${g.date}|${g.type}`} value={g.date}>
                      {fmtDate(g.date)} · {gatheringTypeLabel(g.type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-52 flex-1 text-sm font-medium text-gray-700">
                Pangalan ng kaanib
                <input name="q" defaultValue={q} placeholder="I-type ang pangalan…" autoComplete="off" className={`${inputCls} mt-1`} />
              </label>
              <button type="submit" className={btnGhostCls}>
                I-search
              </button>
            </form>
          </Panel>

          {qWords.length > 0 && (
            <Panel title={`Resulta para sa "${q}"`}>
              {matchedMembers.length === 0 && matchedGuests.length === 0 ? (
                <Empty>Walang kaanib o bisitang tumutugma sa hinahanap.</Empty>
              ) : (
                <div className="space-y-4">
                  {matchedMembers.map((m) => (
                    <div key={m.id} className="rounded-lg border border-gray-200 p-4">
                      <p className="font-semibold text-gray-900">{m.full_name}</p>
                      <p className="text-xs text-gray-400">Kaanib · {activeLocal.name}</p>
                      <div className="mt-2 space-y-1">
                        {searchDates.length === 0 && <p className="text-sm text-gray-500">Walang naka-talang pagkakatipon.</p>}
                        {searchDates.map((g) => {
                          const present = g.memberIds.has(String(m.id));
                          return (
                            <div key={`${g.date}|${g.type}`} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-600">
                                {fmtDate(g.date)} · {gatheringTypeLabel(g.type)}
                              </span>
                              <strong className={present ? "text-emerald-700" : "text-red-600"}>
                                {present ? "✓ Dumalo" : "✕ Hindi dumalo"}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {matchedGuests.map((gu, i) => (
                    <div key={`g-${i}`} className="rounded-lg border border-gray-200 p-4">
                      <p className="font-semibold text-gray-900">{gu.name}</p>
                      <p className="text-xs text-gray-400">
                        {gu.kind === "visitor" ? "Bisita" : `Galing ibang local (${localName.get(gu.homeLocalId ?? "") ?? ""}) · beripikado sa roster`}
                      </p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-600">
                            {fmtDate(gu.date)} · {gatheringTypeLabel(gu.type)}
                          </span>
                          <strong className="text-emerald-700">✓ Dumalo</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
