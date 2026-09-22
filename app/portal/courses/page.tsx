import Link from "next/link";
import { requirePastoralAccess, isStaff } from "@/lib/portal";
import { createCourse } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePastoralAccess();
  const staff = isStaff(profile.role);

  const { data } = await supabase
    .from("courses")
    .select("id, title, description, published")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (data ?? []) as { id: string; title: string; description: string | null; published: boolean }[];

  const listPanel = (
    <Panel>
      {list.length === 0 ? (
        <Empty>Wala pang course.</Empty>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={`/portal/courses/${c.id}`} className="flex items-start justify-between gap-2 hover:underline">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  {c.description && <p className="text-xs text-gray-500 line-clamp-1">{c.description}</p>}
                </div>
                {!c.published && (
                  <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Draft</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader title="Bible Study" subtitle="Pamahalaan ang mga Bible Study course para sa Pastoral Ministry." />
      <Notice ok={ok} error={error} />

      {staff ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{listPanel}</div>

          <Panel title="Magdagdag ng course">
            <form action={createCourse} className="grid gap-4">
              <Field label="Pamagat">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Paglalarawan (opsyonal)">
                <textarea name="description" rows={3} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>Gumawa</button>
            </form>
          </Panel>
        </div>
      ) : (
        listPanel
      )}
    </>
  );
}
