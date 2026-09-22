import Link from "next/link";
import { requireRoles, fmtDate, nextSundayPH, KIND_LABEL } from "@/lib/portal";
import { createService } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const [summary, care] = await Promise.all([
    supabase.rpc("attendance_summary", { limit_n: 20 }),
    supabase.rpc("member_attendance_summary", { n_services: 8 }),
  ]);
  const services = (summary.data ?? []) as any[];
  const people = (care.data ?? []) as any[];
  const total = people[0]?.total_services ?? 0;
  const needsCare = total > 0 ? people.filter((p) => Number(p.present_count) === 0) : [];

  return (
    <>
      <PageHeader title="Attendance" subtitle="Itala ang dumalo sa bawat serbisyo." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Mga naka-tala na serbisyo">
            {services.length === 0 ? (
              <Empty>Wala pang serbisyong naka-tala. Gumawa ng una sa kanan.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {services.map((s) => (
                  <li key={s.service_id}>
                    <Link
                      href={`/portal/attendance/${s.service_id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-emerald-50/40"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{fmtDate(s.service_date)}</div>
                        <div className="text-xs text-gray-500">
                          {KIND_LABEL[s.kind] ?? s.kind}
                          {s.title ? ` · ${s.title}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-emerald-800">{s.present_count} dumalo</div>
                        <div className="text-xs text-gray-400">+ {s.visitors_count} bisita</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Pangangalaga (huling ${total || 0} Linggo)`}>
            {total === 0 ? (
              <Empty>Lalabas dito ang ulat kapag may naka-tala nang Sunday Worship.</Empty>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  Mga aktibong member na hindi dumalo sa alinman sa huling {total} na Linggo:{" "}
                  <strong>{needsCare.length}</strong>. Magandang dalawin o kumustahin sila.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="py-2 pr-3">Pangalan</th>
                        <th className="py-2 pr-3">Dumalo</th>
                        <th className="py-2 pr-3">Huling dumalo</th>
                        <th className="py-2">Telepono</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {people.slice(0, 15).map((p) => (
                        <tr key={p.profile_id}>
                          <td className="py-2 pr-3">
                            <Link href={`/portal/members/${p.profile_id}`} className="font-medium text-emerald-800 hover:underline">
                              {p.full_name || "(walang pangalan)"}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">{p.present_count} / {p.total_services}</td>
                          <td className="py-2 pr-3">{fmtDate(p.last_present)}</td>
                          <td className="py-2">{p.phone_number || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-400">Nakalista ang may pinakakaunting attendance muna.</p>
              </>
            )}
          </Panel>
        </div>

        <Panel title="Gumawa ng bagong serbisyo">
          <form action={createService} className="grid gap-4">
            <Field label="Petsa (oras sa Pilipinas)">
              <input type="date" name="service_date" defaultValue={nextSundayPH()} required className={inputCls} />
            </Field>
            <Field label="Uri">
              <select name="kind" className={inputCls} defaultValue="sunday">
                <option value="sunday">Sunday Worship</option>
                <option value="new_year_thanksgiving">New Year Thanksgiving</option>
                <option value="yearly_thanksgiving">Yearly Thanksgiving</option>
                <option value="extra_thanksgiving">Extra Thanksgiving</option>
                <option value="monthly_ministerial_class">Monthly Ministerial Class</option>
                <option value="other">Others</option>
              </select>
            </Field>
            <Field label="Pamagat (opsyonal)">
              <input name="title" className={inputCls} />
            </Field>
            <button className={btnCls}>Gumawa at magtala</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
