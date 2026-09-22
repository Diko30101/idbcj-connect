import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePastoralAccess } from "@/lib/portal";
import { updateLesson, deleteLesson } from "../../../../actions";
import { formatQuizText, type QuizQuestion } from "@/lib/courses";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id, lessonId } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requirePastoralAccess();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", id)
    .maybeSingle();
  if (!lesson) notFound();

  const quizText = formatQuizText((lesson.quiz ?? []) as QuizQuestion[]);

  return (
    <>
      <PageHeader
        title={lesson.title}
        action={
          <Link href={`/portal/courses/${id}`} className={btnGhostCls}>
            ← Course
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="I-edit ang aralin">
            <form action={updateLesson} className="grid gap-4">
              <input type="hidden" name="id" value={lesson.id} />
              <input type="hidden" name="course_id" value={id} />
              <Field label="Pamagat">
                <input name="title" defaultValue={lesson.title} required className={inputCls} />
              </Field>
              <Field label="Posisyon">
                <input type="number" name="position" defaultValue={lesson.position} className={inputCls} />
              </Field>
              <Field label="Laman ng Aralin">
                <textarea name="content" defaultValue={lesson.content ?? ""} rows={10} className={inputCls} />
              </Field>
              <Field
                label="Quiz (opsyonal)"
                hint='Tanong sa unang linya, "* " para sa tamang sagot, "- " para sa mali. Blangkong linya bago ang susunod na tanong.'
              >
                <textarea name="quiz" defaultValue={quizText} rows={8} className={inputCls} />
              </Field>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Burahin">
            <form action={deleteLesson}>
              <input type="hidden" name="id" value={lesson.id} />
              <input type="hidden" name="course_id" value={id} />
              <button className={btnDangerCls}>Burahin ang aralin</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
