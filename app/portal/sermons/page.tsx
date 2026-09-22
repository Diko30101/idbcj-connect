import Link from "next/link";
import { requireRoles, fmtDate } from "@/lib/portal";
import { createSermon } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function SermonsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data } = await supabase
    .from("sermons")
    .select("id, title, speaker, sermon_date, published")
    .order("sermon_date", { ascending: false })
    .limit(200);
  const list = (data ?? []) as { id: string; title: string; speaker: string; sermon_date: string; published: boolean }[];

  return (
    <>
      <PageHeader title="Sermons" subtitle="Pamahalaan ang Sermon Library na makikita sa publikong website." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel>
            {list.length === 0 ? (
              <Empty>Wala pang sermon.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((s) => (
                  <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/portal/sermons/${s.id}`} className="flex items-start justify-between gap-2 hover:underline">
                      <div>
                        <h3 className="font-semibold text-gray-900">{s.title}</h3>
                        <p className="text-xs text-gray-500">
                          {s.speaker} · {fmtDate(s.sermon_date)}
                        </p>
                      </div>
                      {!s.published && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Draft</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Magdagdag ng sermon">
          <form action={createSermon} className="grid gap-4">
            <Field label="Slug" hint="Maliliit na letra at gitling lang, hal. walking-in-faith">
              <input name="slug" required pattern="^[a-z0-9]+(-[a-z0-9]+)*$" className={inputCls} />
            </Field>
            <Field label="Pamagat (English)">
              <input name="title" required className={inputCls} />
            </Field>
            <Field label="Pamagat (Tagalog, opsyonal)">
              <input name="title_tl" className={inputCls} />
            </Field>
            <Field label="Speaker">
              <input name="speaker" required className={inputCls} />
            </Field>
            <Field label="Petsa">
              <input type="date" name="sermon_date" required className={inputCls} />
            </Field>
            <Field label="Kategorya">
              <input name="category" defaultValue="General" className={inputCls} />
            </Field>
            <Field label="YouTube Video ID (opsyonal)" hint="Ang bahagi pagkatapos ng v= sa YouTube URL">
              <input name="video_id" className={inputCls} />
            </Field>
            <Field label="Buod (English)">
              <textarea name="summary" required rows={3} className={inputCls} />
            </Field>
            <Field label="Buod (Tagalog, opsyonal)">
              <textarea name="summary_tl" rows={3} className={inputCls} />
            </Field>
            <Field label="Mga Talata sa Biblia (opsyonal, hanggang 3)">
              <div className="grid gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input name="verse_ref" placeholder="Ref (hal. John 3:16)" className={inputCls} />
                    <input name="verse_text" placeholder="Teksto (opsyonal)" className={inputCls} />
                    <input name="verse_translation" placeholder="Bersyon (hal. KJV)" className={inputCls} />
                  </div>
                ))}
              </div>
            </Field>
            <Field label="Mga tanong pang-review (opsyonal)" hint="Isang tanong bawat linya">
              <textarea name="questions" rows={3} className={inputCls} />
            </Field>
            <Field label="PDF path (opsyonal)" hint='Ilagay muna ang file sa public/sermons/pdf/, hal. "/sermons/pdf/walking-in-faith.pdf"'>
              <input name="pdf_path" className={inputCls} />
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
