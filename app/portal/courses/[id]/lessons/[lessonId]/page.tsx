import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePastoralAccess, isStaff, fmtDate } from "@/lib/portal";
import { updateLesson, deleteLesson, submitQuizAttempt } from "../../../../actions";
import { formatQuizText, type QuizQuestion } from "@/lib/courses";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

type CompletionRow = { passed: boolean; correct_count: number; total_count: number; completed_at: string };

// Ginagawang clickable ang mga URL sa lesson content; parehong teksto, link lang ang nadagdag.
function renderContent(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 underline break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id, lessonId } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePastoralAccess();
  const staff = isStaff(profile.role);

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", id)
    .maybeSingle();
  if (!lesson) notFound();

  const quiz = (lesson.quiz ?? []) as QuizQuestion[];

  let completion: CompletionRow | null = null;
  if (!staff) {
    const { data } = await supabase
      .from("lesson_completions")
      .select("passed, correct_count, total_count, completed_at")
      .eq("lesson_id", lessonId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    completion = data;
  }

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

      {staff ? (
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
                  <textarea name="quiz" defaultValue={formatQuizText(quiz)} rows={8} className={inputCls} />
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
      ) : (
        <div className="space-y-6">
          {completion && (
            <Panel title="Katayuan">
              <p className={`text-sm font-semibold ${completion.passed ? "text-emerald-700" : "text-amber-700"}`}>
                {completion.passed ? "Pasado" : "Kailangan Ulitin"} ({completion.correct_count}/{completion.total_count})
              </p>
              <p className="mt-1 text-xs text-gray-500">Huling sagot: {fmtDate(completion.completed_at)}</p>
            </Panel>
          )}

          <Panel>
            <p className="whitespace-pre-line text-sm text-gray-700">{renderContent(lesson.content ?? "")}</p>
          </Panel>

          {quiz.length > 0 && (
            <Panel title="Quiz">
              <form action={submitQuizAttempt} className="grid gap-5">
                <input type="hidden" name="lesson_id" value={lesson.id} />
                <input type="hidden" name="course_id" value={id} />
                {quiz.map((q, qi) => (
                  <fieldset key={qi} className="grid gap-2">
                    <legend className="text-sm font-medium text-gray-800">
                      {qi + 1}. {q.question}
                    </legend>
                    {q.choices.map((c, ci) => (
                      <label key={ci} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name={`q${qi}`} value={ci} required className="h-4 w-4 accent-emerald-700" />
                        {c.text}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <button className={btnCls}>I-submit</button>
              </form>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
