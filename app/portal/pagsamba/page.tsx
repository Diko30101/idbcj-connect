import Link from "next/link";
import { getPagsambaContext, fmtDate, PASTORAL_MINISTRY_NAME } from "@/lib/portal";
import { monthLabel, monthToDate, currentMonthPH } from "@/lib/finance";
import { sundaysOfMonth, PAGSAMBA_BASE, type PagsambaTopic, type PagsambaRecord } from "@/lib/pagsamba";
import { uploadPagsambaTexto, updatePagsambaTopic, createPagsambaTopic, saveSugo, deleteSugoSession } from "./actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";

// Pagsamba (regular na Linggong worship service): Paksa (church-wide, iisa para sa buong Iglesia bawat
// Linggo ng buwan, Admin lang ang nag-e-encode) + Sugo (per local, pinipili ng Leader ng Pastoral Ministry
// o Admin mula sa Pastoral Ministry members ng local na iyon). Ang dumalo/panauhin ay hindi dito ie-encode —
// kukunin lang (read-only) mula sa attendance_records/attendance_guests na naka-encode na ng Local Admin
// Ministry, service_type = "Linggo" lang.
export default async function PagsambaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; buwan?: string; local?: string }>;
}) {
  const { ok, error, buwan: buwanParam, local: localParam } = await searchParams;
  const ctx = await getPagsambaContext();
  const { supabase } = ctx;

  const buwan = /^\d{4}-(0[1-9]|1[0-2])$/.test(buwanParam ?? "") ? buwanParam! : currentMonthPH();
  const periodMonth = monthToDate(buwan);
  const dates = sundaysOfMonth(buwan);

  const selected = ctx.locals.find((l) => l.id === localParam) ?? ctx.locals[0];

  const [{ data: topicRows }, { data: recRows }, { data: attRows }, { data: guestRows }, { data: mmRows }] = await Promise.all([
    supabase.from("pagsamba_topics").select("id, period_month, week_number, paksa, source_docx_path").eq("period_month", periodMonth),
    dates.length > 0
      ? supabase
          .from("pagsamba_records")
          .select("id, local_id, service_date, session_label, sugo_id, notes")
          .eq("local_id", selected.id)
          .in("service_date", dates)
      : Promise.resolve({ data: [] }),
    dates.length > 0
      ? supabase.from("attendance_records").select("service_date, present").eq("local_id", selected.id).eq("service_type", "Linggo").in("service_date", dates)
      : Promise.resolve({ data: [] }),
    dates.length > 0
      ? supabase.from("attendance_guests").select("service_date").eq("local_id", selected.id).eq("service_type", "Linggo").in("service_date", dates)
      : Promise.resolve({ data: [] }),
    supabase.from("ministry_members").select("profile_id, ministries(name), profiles(id, full_name, status)").eq("local_id", selected.id),
  ]);

  const topicByWeek = new Map<number, PagsambaTopic>();
  for (const t of (topicRows ?? []) as PagsambaTopic[]) topicByWeek.set(t.week_number, t);

  // Kadalasan isa lang ang Pagsamba kada araw ("" na session_label), pero may ilang local (hal. Sta
  // Teresita) na may higit sa isa (hal. 9:00 AM at 3:00 PM) na may ibang Sugo bawat isa.
  const sessionsByDate = new Map<string, PagsambaRecord[]>();
  for (const r of (recRows ?? []) as PagsambaRecord[]) {
    const list = sessionsByDate.get(r.service_date) ?? [];
    list.push(r);
    sessionsByDate.set(r.service_date, list);
  }
  for (const list of sessionsByDate.values()) list.sort((a, b) => a.session_label.localeCompare(b.session_label));

  const presentByDate = new Map<string, number>();
  for (const r of (attRows ?? []) as { service_date: string; present: boolean }[]) {
    if (r.present) presentByDate.set(r.service_date, (presentByDate.get(r.service_date) ?? 0) + 1);
  }
  const guestByDate = new Map<string, number>();
  for (const r of (guestRows ?? []) as { service_date: string }[]) {
    guestByDate.set(r.service_date, (guestByDate.get(r.service_date) ?? 0) + 1);
  }

  const sugoChoices = ((mmRows ?? []) as any[])
    .filter((m) => m.ministries?.name === PASTORAL_MINISTRY_NAME && m.profiles && m.profiles.status !== "inactive")
    .map((m) => ({ id: m.profiles.id as string, full_name: (m.profiles.full_name as string) || "(walang pangalan)" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "fil"));
  const sugoNameById = new Map(sugoChoices.map((s) => [s.id, s.full_name]));

  const monthQs = `buwan=${encodeURIComponent(buwan)}`;

  return (
    <>
      <PageHeader title="Pagsamba" subtitle={`Paksa at Sugo kada Linggo · ${monthLabel(buwan)}`} />
      <Notice ok={ok} error={error} />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Buwan">
          <input type="month" name="buwan" defaultValue={buwan} className={inputCls} />
        </Field>
        {selected && <input type="hidden" name="local" value={selected.id} />}
        <button className={btnGhostCls}>Tingnan</button>
      </form>

      {ctx.locals.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {ctx.locals.map((l) => (
            <Link
              key={l.id}
              href={`${PAGSAMBA_BASE}?${monthQs}&local=${l.id}`}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                l.id === selected?.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <Panel title="Paksa ng Buwan (iisa para sa buong Iglesia)">
          {ctx.canWritePaksa && (
            <form
              action={uploadPagsambaTexto}
              encType="multipart/form-data"
              className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-emerald-50/50 p-3"
            >
              <input type="hidden" name="period_month" value={buwan} />
              <input type="hidden" name="buwan" value={buwan} />
              {selected && <input type="hidden" name="local" value={selected.id} />}
              <Field label="I-upload ang Texto ng Buwan (.docx)">
                <input type="file" name="docx" accept=".docx" required className={inputCls} />
              </Field>
              <button className={btnCls}>I-upload at Kunin ang Paksa</button>
              <p className="w-full text-xs text-gray-500">
                Awtomatikong babasahin ang file at mapupunan ang Paksa ng bawat Linggo. Suriin pa rin sa ibaba kung tama, at ayusin kung kailangan.
              </p>
            </form>
          )}
          {dates.length === 0 ? (
            <Empty>Di-wastong buwan.</Empty>
          ) : (
            <ol className="space-y-3">
              {dates.map((date, i) => {
                const week = i + 1;
                const topic = topicByWeek.get(week);
                return (
                  <li key={week} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs font-medium text-gray-400">
                      Linggo {week} · {fmtDate(date)}
                    </p>
                    {ctx.canWritePaksa ? (
                      topic ? (
                        <form action={updatePagsambaTopic} className="mt-1 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={topic.id} />
                          <input type="hidden" name="buwan" value={buwan} />
                          {selected && <input type="hidden" name="local" value={selected.id} />}
                          <input name="paksa" defaultValue={topic.paksa} className={`${inputCls} flex-1`} />
                          <button className={btnGhostCls}>I-save</button>
                        </form>
                      ) : (
                        <form action={createPagsambaTopic} className="mt-1 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="period_month" value={buwan} />
                          <input type="hidden" name="week_number" value={week} />
                          <input type="hidden" name="buwan" value={buwan} />
                          {selected && <input type="hidden" name="local" value={selected.id} />}
                          <input name="paksa" placeholder="Ilagay ang Paksa" className={`${inputCls} flex-1`} />
                          <button className={btnGhostCls}>Idagdag</button>
                        </form>
                      )
                    ) : (
                      <p className="mt-1 text-sm text-gray-700">{topic?.paksa ?? "Wala pang Paksa."}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        {selected && (
          <Panel title={`Sugo at Pagsamba kada Linggo · ${selected.name}`}>
            {dates.length === 0 ? (
              <Empty>Di-wastong buwan.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="py-2 pr-3">Petsa</th>
                      <th className="py-2 pr-3">Session</th>
                      <th className="py-2 pr-3">Sugo</th>
                      <th className="py-2 pr-3">Dumalo</th>
                      <th className="py-2">Panauhin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dates.map((date) => {
                      // Laging may pangunahing/default session ("") kahit wala pang naka-save.
                      const sessions = sessionsByDate.get(date) ?? [{ id: "", local_id: selected.id, service_date: date, session_label: "", sugo_id: null, notes: null } as PagsambaRecord];
                      const present = presentByDate.get(date) ?? 0;
                      const guests = guestByDate.get(date) ?? 0;
                      return sessions.map((rec, i) => (
                        <tr key={`${date}-${rec.session_label}`}>
                          {i === 0 && (
                            <td className="py-2 pr-3 align-top font-medium text-gray-800" rowSpan={sessions.length}>
                              {fmtDate(date)}
                            </td>
                          )}
                          <td className="py-2 pr-3 align-top">
                            {rec.session_label === "" ? (
                              <span className="text-xs text-gray-400">Pangunahin</span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {rec.session_label}
                                {ctx.canWriteSugo && rec.id && (
                                  <form action={deleteSugoSession}>
                                    <input type="hidden" name="id" value={rec.id} />
                                    <input type="hidden" name="buwan" value={buwan} />
                                    <input type="hidden" name="local" value={selected.id} />
                                    <button className="text-xs text-red-500 hover:underline" title="Tanggalin ang session na ito">
                                      ✕
                                    </button>
                                  </form>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 align-top">
                            {ctx.canWriteSugo ? (
                              <form action={saveSugo} className="flex items-center gap-2">
                                <input type="hidden" name="local_id" value={selected.id} />
                                <input type="hidden" name="service_date" value={date} />
                                <input type="hidden" name="session_label" value={rec.session_label} />
                                <input type="hidden" name="buwan" value={buwan} />
                                <input type="hidden" name="local" value={selected.id} />
                                <select name="sugo_id" defaultValue={rec.sugo_id ?? ""} className={inputCls}>
                                  <option value="">— Pumili —</option>
                                  {sugoChoices.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.full_name}
                                    </option>
                                  ))}
                                </select>
                                <button className={btnGhostCls}>I-save</button>
                              </form>
                            ) : (
                              (rec.sugo_id && sugoNameById.get(rec.sugo_id)) || "-"
                            )}
                          </td>
                          {i === 0 && (
                            <>
                              <td className="py-2 pr-3 align-top" rowSpan={sessions.length}>
                                {present}
                              </td>
                              <td className="py-2 align-top" rowSpan={sessions.length}>
                                {guests}
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })}
                    {ctx.canWriteSugo &&
                      dates.map((date) => (
                        <tr key={`${date}-add`} className="bg-gray-50/60">
                          <td className="py-2 pr-3"></td>
                          <td className="py-2 pr-3" colSpan={3}>
                            <form action={saveSugo} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="local_id" value={selected.id} />
                              <input type="hidden" name="service_date" value={date} />
                              <input type="hidden" name="buwan" value={buwan} />
                              <input type="hidden" name="local" value={selected.id} />
                              <input name="session_label" placeholder={`Karagdagang session sa ${fmtDate(date)} (hal. 3:00 PM)`} className={`${inputCls} w-64`} required />
                              <select name="sugo_id" defaultValue="" className={inputCls}>
                                <option value="">— Pumili ng Sugo —</option>
                                {sugoChoices.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name}
                                  </option>
                                ))}
                              </select>
                              <button className={btnGhostCls}>+ Magdagdag ng Session</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-gray-400">
                  Ang Dumalo at Panauhin ay mula sa attendance na naka-encode na ng Local Admin Ministry (regular na Linggo lang, hindi Pasalamat) —
                  kabuuan ng buong araw, hindi hiwalay per session.
                </p>
              </div>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
