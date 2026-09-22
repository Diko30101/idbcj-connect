import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate } from "@/lib/portal";
import { updateSermon, toggleSermon, deleteSermon } from "../../actions";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

type Verse = { ref: string; text?: string; translation?: string };

export default async function SermonEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: sermon } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();
  if (!sermon) notFound();

  const verses = ((sermon.verses ?? []) as Verse[]).concat([{ ref: "" }, { ref: "" }, { ref: "" }]).slice(0, 3);
  const questions = ((sermon.questions ?? []) as string[]).join("\n");

  return (
    <>
      <PageHeader
        title={sermon.title}
        subtitle={`Huling na-update: ${fmtDate(sermon.updated_at)}`}
        action={
          <Link href="/portal/sermons" className={btnGhostCls}>
            ← Sermons
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="I-edit ang sermon">
            <form action={updateSermon} className="grid gap-4">
              <input type="hidden" name="id" value={sermon.id} />
              <Field label="Slug" hint="Maliliit na letra at gitling lang, hal. walking-in-faith">
                <input name="slug" defaultValue={sermon.slug} required pattern="^[a-z0-9]+(-[a-z0-9]+)*$" className={inputCls} />
              </Field>
              <Field label="Pamagat (English)">
                <input name="title" defaultValue={sermon.title} required className={inputCls} />
              </Field>
              <Field label="Pamagat (Tagalog, opsyonal)">
                <input name="title_tl" defaultValue={sermon.title_tl ?? ""} className={inputCls} />
              </Field>
              <Field label="Speaker">
                <input name="speaker" defaultValue={sermon.speaker} required className={inputCls} />
              </Field>
              <Field label="Petsa">
                <input type="date" name="sermon_date" defaultValue={sermon.sermon_date} required className={inputCls} />
              </Field>
              <Field label="Kategorya">
                <input name="category" defaultValue={sermon.category} className={inputCls} />
              </Field>
              <Field label="YouTube Video ID (opsyonal)">
                <input name="video_id" defaultValue={sermon.video_id ?? ""} className={inputCls} />
              </Field>
              <Field label="Buod (English)">
                <textarea name="summary" defaultValue={sermon.summary} required rows={3} className={inputCls} />
              </Field>
              <Field label="Buod (Tagalog, opsyonal)">
                <textarea name="summary_tl" defaultValue={sermon.summary_tl ?? ""} rows={3} className={inputCls} />
              </Field>
              <Field label="Mga Talata sa Biblia (opsyonal, hanggang 3)">
                <div className="grid gap-2">
                  {verses.map((v, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <input name="verse_ref" defaultValue={v.ref ?? ""} placeholder="Ref (hal. John 3:16)" className={inputCls} />
                      <input name="verse_text" defaultValue={v.text ?? ""} placeholder="Teksto (opsyonal)" className={inputCls} />
                      <input name="verse_translation" defaultValue={v.translation ?? ""} placeholder="Bersyon (hal. KJV)" className={inputCls} />
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Mga tanong pang-review (opsyonal)" hint="Isang tanong bawat linya">
                <textarea name="questions" defaultValue={questions} rows={3} className={inputCls} />
              </Field>
              <Field label="PDF path (opsyonal)">
                <input name="pdf_path" defaultValue={sermon.pdf_path ?? ""} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" defaultChecked={sermon.published} className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Katayuan">
            <p className="mb-3 text-sm text-gray-600">
              {sermon.published ? "Nakikita na ito ng publiko sa /sermons." : "Draft pa lang — hindi ito makikita sa /sermons."}
            </p>
            <form action={toggleSermon}>
              <input type="hidden" name="id" value={sermon.id} />
              <input type="hidden" name="publish" value={sermon.published ? "false" : "true"} />
              <button className={btnGhostCls}>{sermon.published ? "Gawing draft" : "I-publish"}</button>
            </form>
          </Panel>

          <Panel title="Burahin">
            <form action={deleteSermon}>
              <input type="hidden" name="id" value={sermon.id} />
              <button className={btnDangerCls}>Burahin ang sermon</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
