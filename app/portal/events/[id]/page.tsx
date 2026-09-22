import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate, LOCALITIES, LOCALITY_LABEL } from "@/lib/portal";
import { updateEvent, toggleEvent, deleteEvent } from "../../actions";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={event.title}
        subtitle={`Huling na-update: ${fmtDate(event.updated_at)}`}
        action={
          <Link href="/portal/events" className={btnGhostCls}>
            ← Events
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="I-edit ang event">
            <form action={updateEvent} className="grid gap-4">
              <input type="hidden" name="id" value={event.id} />
              <Field label="Pamagat">
                <input name="title" defaultValue={event.title} required className={inputCls} />
              </Field>
              <Field label="Paglalarawan (opsyonal)">
                <textarea name="description" defaultValue={event.description ?? ""} rows={3} className={inputCls} />
              </Field>
              <Field label="Petsa">
                <input type="date" name="event_date" defaultValue={event.event_date} required className={inputCls} />
              </Field>
              <Field label="Oras (opsyonal)">
                <input name="event_time" defaultValue={event.event_time ?? ""} className={inputCls} />
              </Field>
              <Field label="Lokal (opsyonal)">
                <select name="locality" defaultValue={event.locality ?? ""} className={inputCls}>
                  <option value="">Lahat ng lokal</option>
                  {LOCALITIES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALITY_LABEL[l]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lugar (opsyonal)">
                <input name="location" defaultValue={event.location ?? ""} className={inputCls} />
              </Field>
              <Field label="Link (opsyonal)">
                <input name="link" type="url" defaultValue={event.link ?? ""} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" defaultChecked={event.published} className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Katayuan">
            <p className="mb-3 text-sm text-gray-600">
              {event.published ? "Nakikita na ito ng publiko sa /events." : "Draft pa lang — hindi ito makikita sa /events."}
            </p>
            <form action={toggleEvent}>
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="publish" value={event.published ? "false" : "true"} />
              <button className={btnGhostCls}>{event.published ? "Gawing draft" : "I-publish"}</button>
            </form>
          </Panel>

          <Panel title="Burahin">
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button className={btnDangerCls}>Burahin ang event</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
