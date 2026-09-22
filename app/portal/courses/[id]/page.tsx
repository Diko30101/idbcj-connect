import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePastoralAccess, isStaff, fmtDate } from "@/lib/portal";
import { updateCourse, toggleCourse, deleteCourse, createLesson } from "../../actions";
import type { QuizQuestion } from "@/lib/courses";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

type LessonRow = { id: string; title: string; position: number; quiz: QuizQuestion[] };
type CompletionRow = { lesson_id: string; passed: boolean; correct_count: number; total_count: number };

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePastoralAccess();
  const staff = isStaff(profile.role);

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("id, title, position, quiz")
    .eq("course_id", id)
    .order("position", { ascending: true });
  const lessons = (lessonsData ?? []) as LessonRow[];

  const { data: completionsData } = await supabase
    .from("lesson_completions")
    .select("lesson_id, passed, correct_count, total_count")
    .eq("profile_id", profile.id);
  const completionByLesson = new Map(
    ((completionsData ?? []) as CompletionRow[]).map((c) => [c.lesson_id, c]),
  );

  const lessonsPanel = (
    <Panel title="Mga Aralin">
      {lessons.length === 0 ? (
        <Empty>Wala pang aralin sa course na ito.</Empty>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lessons.map((l) => {
            const completion = completionByLesson.get(l.id);
            const quiz = (l.quiz ?? []) as QuizQuestion[];
            return (
              <li key={l.id} className="flex items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/portal/courses/${course.id}/lessons/${l.id}`}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {l.title}
                </Link>
                {completion ? (
                  completion.passed ? (
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">Pasado</span>
                  ) : (
                    <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                      Kailangan Ulitin
                    </span>
                  )
                ) : quiz.length > 0 ? (
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Hindi pa kinuha</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {staff && (
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
      )}
    </Panel>
  );

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
      {!staff && course.description && <p className="mb-6 text-sm text-gray-600">{course.description}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={staff ? "lg:col-span-2 space-y-6" : "lg:col-span-3"}>
          {staff && (
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
          )}
          {lessonsPanel}
        </div>

        {staff && (
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
        )}
      </div>
    </>
  );
}
