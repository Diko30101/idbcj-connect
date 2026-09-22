import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePastoralAccess, fmtDate } from "@/lib/portal";
import { updateCourse, toggleCourse, deleteCourse, createLesson } from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requirePastoralAccess();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("id, title, position")
    .eq("course_id", id)
    .order("position", { ascending: true });
  const lessons = (lessonsData ?? []) as { id: string; title: string; position: number }[];

  return (
    <>
      <PageHeader
        title={course.title}
        subtitle={`Huling na-update: ${fmtDate(course.updated_at)}`}
        action={
          <Link href="/portal/courses" className={btnGhostCls}>
            ← Bible Study
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Panel title="I-edit ang course">
            <form action={updateCourse} className="grid gap-4">
              <input type="hidden" name="id" value={course.id} />
              <Field label="Pamagat">
                <input name="title" defaultValue={course.title} required className={inputCls} />
              </Field>
              <Field label="Paglalarawan (opsyonal)">
                <textarea name="description" defaultValue={course.description ?? ""} rows={3} className={inputCls} />
              </Field>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>

          <Panel title="Mga Aralin">
            {lessons.length === 0 ? (
              <Empty>Wala pang aralin sa course na ito.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lessons.map((l) => (
                  <li key={l.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/portal/courses/${course.id}/lessons/${l.id}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <form action={createLesson} className="mt-4 grid gap-3 border-t border-gray-100 pt-4">
              <input type="hidden" name="course_id" value={course.id} />
              <Field label="Pamagat ng aralin">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Posisyon" hint="Mas mababang numero, mas nauuna sa listahan">
                <input type="number" name="position" defaultValue={lessons.length} className={inputCls} />
              </Field>
              <button className={btnCls}>Magdagdag ng aralin</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Katayuan">
            <p className="mb-3 text-sm text-gray-600">
              {course.published ? "Handa na ang course na ito." : "Ginagawa pa — hindi pa handa."}
            </p>
            <form action={toggleCourse}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="publish" value={course.published ? "false" : "true"} />
              <button className={btnGhostCls}>{course.published ? "Gawing draft" : "I-publish"}</button>
            </form>
          </Panel>

          <Panel title="Burahin">
            <form action={deleteCourse}>
              <input type="hidden" name="id" value={course.id} />
              <button className={btnDangerCls}>Burahin ang course</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
