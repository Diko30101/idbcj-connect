import Link from "next/link";
import { requireRoles, fmtDate, LOCALITIES, LOCALITY_LABEL } from "@/lib/portal";
import { createEvent } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, locality, published")
    .order("event_date", { ascending: false })
    .limit(200);
  const list = (data ?? []) as {
    id: string;
    title: string;
    event_date: string;
    event_time: string | null;
    locality: keyof typeof LOCALITY_LABEL | null;
    published: boolean;
  }[];

  return (
    <>
      <PageHeader title="Events" subtitle="Pamahalaan ang mga special event na makikita sa publikong /events." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel>
            {list.length === 0 ? (
              <Empty>Wala pang naka-tala na special event.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((e) => (
                  <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/portal/events/${e.id}`} className="flex items-start justify-between gap-2 hover:underline">
                      <div>
                        <h3 className="font-semibold text-gray-900">{e.title}</h3>
                        <p className="text-xs text-gray-500">
                          {fmtDate(e.event_date)}
                          {e.event_time ? `, ${e.event_time}` : ""}
                          {e.locality ? ` · ${LOCALITY_LABEL[e.locality]}` : ""}
                        </p>
                      </div>
                      {!e.published && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Draft</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Magdagdag ng special event">
          <form action={createEvent} className="grid gap-4">
            <Field label="Pamagat">
              <input name="title" required className={inputCls} placeholder="Yearly Thanksgiving" />
            </Field>
            <Field label="Paglalarawan (opsyonal)">
              <textarea name="description" rows={3} className={inputCls} />
            </Field>
            <Field label="Petsa">
              <input type="date" name="event_date" required className={inputCls} />
            </Field>
            <Field label="Oras (opsyonal)" hint='Hal. "9:00 AM"'>
              <input name="event_time" className={inputCls} />
            </Field>
            <Field label="Lokal (opsyonal)">
              <select name="locality" className={inputCls} defaultValue="">
                <option value="">Lahat ng lokal</option>
                {LOCALITIES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALITY_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lugar (opsyonal)">
              <input name="location" className={inputCls} />
            </Field>
            <Field label="Link (opsyonal)" hint="Livestream o registration URL">
              <input name="link" type="url" className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="published" className="h-4 w-4 accent-emerald-700" />
              I-publish agad
            </label>
            <button className={btnCls}>Gumawa</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
