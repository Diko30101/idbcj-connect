# Bible Study Courses Access Tightening & Progress Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict Bible Study Courses create/edit/delete to Admin/Secretary only, and let Pastoral Ministry members take each lesson's quiz interactively, with their latest score/pass-status ("Pasado"/"Kailangan Ulitin") remembered and shown in the course's lesson list.

**Architecture:** Split the existing single `for all` RLS policy per table (`courses`, `lessons`) into a broad `_select` policy (unchanged audience) and a narrow `_write` policy (staff only); add a new `lesson_completions` table (one row per member+lesson, own-row RLS) fed by a new `submitQuizAttempt` server action that re-grades from the DB's own `quiz` jsonb (never trusts client-submitted correctness). All 7 existing course/lesson write actions move from `requirePastoralAccess()` to the already-existing `requireRoles(["admin", "secretary"])`. All 3 existing pages branch their rendering on `isStaff(profile.role)` — no new access-check functions anywhere.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Supabase (Postgres + `@supabase/ssr`), Tailwind CSS. No test framework is installed in this repo.

**Spec:** `docs/superpowers/specs/2026-09-22-bible-study-progress-design.md`

## Global Constraints

- No automated test framework exists in this repo. Every task's verification step is `npx tsc --noEmit` (no *new* type errors — this repo has 3 pre-existing, unrelated errors in `components/auth-button.tsx` and `lib/supabase/server.ts`) plus, for page tasks, `npm run build` reaching `✓ Compiled successfully` (a later static-export/prerender failure on an unrelated page is a known pre-existing flaky issue in this repo, confirmed present on `main` before this plan — not a regression to chase unless a page from *this* plan appears in that error).
- Nobody in this session has credentials to run SQL against the live Supabase project. Migration SQL is written and committed, but **applying it is a manual step the user performs in the Supabase SQL Editor**, and it must happen after `004_bible_study_courses.sql` and before this plan's application code is deployed.
- **Reuse only existing access-check functions — never add a new parallel one.** Write actions use the existing `requireRoles(["admin", "secretary"])` (same function `app/portal/sermons/**`/`app/portal/events/**` already use). View access and the new `submitQuizAttempt` action use the existing `requirePastoralAccess()`. Pages branch internally on `isStaff(profile.role)` (also existing, from `lib/portal.ts`).
- RLS policy changes never touch row data — only permissions. Every migration step must stay idempotent (`create table if not exists`, drop-then-recreate policy loops) and transaction-wrapped, matching `supabase/004_bible_study_courses.sql`'s conventions exactly.
- Passing a quiz requires every question answered correctly (100%) — `passed = correct_count === total_count`. Only the latest attempt is kept per member+lesson (upsert on `(profile_id, lesson_id)`), never a history.
- A lesson with an empty `quiz` array has no completion tracking at all: no submit form, no status badge, ever.
- No staff-facing "all members" oversight view — out of scope for this plan.
- No client-side JS quiz component — the quiz is a single plain server-rendered `<form>`, matching every other form in this codebase.
- Portal UI copy is Tagalog-first, matching every existing portal page.
- Never `git push` without the user's explicit go-ahead in that turn. Every task below ends with a **local commit only**.

---

### Task 1: Database migration (RLS split + `lesson_completions` table)

**Files:**
- Create: `supabase/005_bible_study_progress.sql`
- Create: `supabase/005_rollback.sql`

**Interfaces:**
- Consumes: tables `public.courses`, `public.lessons`, `public.profiles` and function `public.is_staff()`, `public.in_named_ministry(text)` — all from `001_portal_schema.sql`/`004_bible_study_courses.sql`.
- Produces: table `public.lesson_completions` (columns: `profile_id, lesson_id, correct_count, total_count, passed, completed_at`, primary key `(profile_id, lesson_id)`) and RLS policies `courses_select`, `courses_write`, `lessons_select`, `lessons_write`, `lesson_completions_own` — consumed by Tasks 2-5 via Supabase queries against these exact names.

- [ ] **Step 1: Write the migration file**

Create `supabase/005_bible_study_progress.sql`:

```sql
-- =====================================================================
-- IDBCJ MEMBER PORTAL - 005: Bible Study Courses access tightening +
-- progress tracking (lesson_completions).
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor, PAGKATAPOS
-- ng 004_bible_study_courses.sql.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 005_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. LESSON_COMPLETIONS: huling score/status bawat member+lesson
--    (isang row lang bawat profile+lesson -- nag-o-overwrite ang retake)
-- ---------------------------------------------------------------------
create table if not exists public.lesson_completions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  correct_count integer not null,
  total_count integer not null,
  passed boolean not null,
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('courses', 'lessons', 'lesson_completions')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.lesson_completions enable row level security;

-- courses/lessons: HIGPITAN ang write access -- Admin/Secretary lang.
-- Ang view access ay pareho pa rin (staff o Pastoral Ministry member).
create policy courses_select on public.courses for select to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
create policy courses_write on public.courses for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy lessons_select on public.lessons for select to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- lesson_completions: bawat user, sariling row lang (view/insert/update)
create policy lesson_completions_own on public.lesson_completions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

commit;
```

- [ ] **Step 2: Write the rollback file**

Create `supabase/005_rollback.sql`:

```sql
-- ROLLBACK ng 005_bible_study_progress.sql
-- Ibinabalik ang courses/lessons sa dating iisang "for all" policy
-- bawat table (courses_all, lessons_all, gaya ng 004), at binubura ang
-- lesson_completions table (kasama ang lahat ng naitalang score).
begin;

drop table if exists public.lesson_completions cascade;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('courses', 'lessons')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy lessons_all on public.lessons for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

commit;
```

- [ ] **Step 3: Self-review the SQL (no live database access in this session)**

Read both files back and confirm:
- Every statement is idempotent: `create table if not exists`, the `do $$ ... drop policy ... end $$` loop before every `create policy`.
- Both files are wrapped in `begin; ... commit;`.
- The rollback recreates `courses_all`/`lessons_all` with the **exact** predicate `004` used, so rolling back `005` alone (without re-running `004`) restores the pre-`005` behavior exactly.
- Column names on `lesson_completions` (`profile_id, lesson_id, correct_count, total_count, passed, completed_at`) exactly match what Tasks 2, 4, and 5 will query — cross-check against this task's "Produces" list before moving on.
- Do **not** attempt to run this against Supabase from this session — no credentials are configured here.

- [ ] **Step 4: Commit**

```bash
git add supabase/005_bible_study_progress.sql supabase/005_rollback.sql
git commit -m "Tighten Bible Study write access to staff, add lesson_completions table (migration, not yet applied)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Server actions — staff-only writes, new `submitQuizAttempt`

**Files:**
- Modify: `app/portal/actions.ts`

**Interfaces:**
- Consumes: `requireRoles` (already imported at the top of the file, `Role` type already imported alongside it), `requirePastoralAccess` (already imported), `str` (already imported); table `public.lesson_completions` from Task 1.
- Produces: `createCourse`, `updateCourse`, `toggleCourse`, `deleteCourse`, `createLesson`, `updateLesson`, `deleteLesson` (unchanged signatures, now staff-gated) and new `export async function submitQuizAttempt(fd: FormData)` — consumed by Task 5's quiz form.

- [ ] **Step 1: Switch the 7 write actions to the staff-only gate**

In `app/portal/actions.ts`, in the "BIBLE STUDY COURSES" section, every one of the 7 functions currently starts with `const { supabase } = await requirePastoralAccess();`. Replace that exact line with `const { supabase } = await requireRoles(["admin", "secretary"]);` in **all 7** of: `createCourse`, `updateCourse`, `toggleCourse`, `deleteCourse`, `createLesson`, `updateLesson`, `deleteLesson`. Nothing else in any of these 7 functions changes — same validation, same Supabase calls, same redirect/error messages.

Also update the section's header comment (currently `// BIBLE STUDY COURSES (Admin/Secretary o Pastoral Ministry) --\n// courses + lessons, parehong view at edit access`) to:

```ts
// ---------------------------------------------------------------
// BIBLE STUDY COURSES -- write (create/edit/delete) ay Admin/Secretary
// lang; view ay Admin/Secretary o Pastoral Ministry member
// ---------------------------------------------------------------
```

- [ ] **Step 2: Add the `QuizQuestion` type import**

Find the existing import line `import { parseQuizText, countQuizBlocks } from "@/lib/courses";` and change it to also bring in the type:

```ts
import { parseQuizText, countQuizBlocks, type QuizQuestion } from "@/lib/courses";
```

- [ ] **Step 3: Append `submitQuizAttempt`**

Add this new function at the end of `app/portal/actions.ts`, after `deleteLesson`:

```ts
export async function submitQuizAttempt(fd: FormData) {
  const { supabase, profile } = await requirePastoralAccess();
  const lessonId = str(fd, "lesson_id");
  const courseId = str(fd, "course_id");
  const path = `/portal/courses/${courseId}/lessons/${lessonId}`;

  const { data: lesson } = await supabase.from("lessons").select("quiz").eq("id", lessonId).maybeSingle();
  if (!lesson) back(path, "error", "Hindi mahanap ang aralin.");

  const quiz = (lesson.quiz ?? []) as QuizQuestion[];
  let correctCount = 0;
  quiz.forEach((q, i) => {
    // Ginagamit ang fd.get (hindi ang str() helper) dahil kailangang
    // makilala ang "walang sagot" (null) mula sa "sagot #0" -- kung
    // gagamitin ang str(), parehong "" ang ibabalik, at ang Number("")
    // ay 0, na maaaring maling mabilang bilang tama kung ang choice #0
    // ay siyang tamang sagot.
    const raw = fd.get(`q${i}`);
    const chosen = raw === null ? -1 : Number(raw);
    if (q.choices[chosen]?.correct) correctCount++;
  });
  const totalCount = quiz.length;
  const passed = correctCount === totalCount;

  const { error } = await supabase.from("lesson_completions").upsert({
    profile_id: profile.id,
    lesson_id: lessonId,
    correct_count: correctCount,
    total_count: totalCount,
    passed,
    completed_at: new Date().toISOString(),
  });
  if (error) back(path, "error", "Hindi na-save ang resulta: " + error.message);

  revalidatePath(path);
  back(
    path,
    "ok",
    passed ? "Pasado ka! Tama ang lahat ng sagot." : `Kailangan ulitin: ${correctCount}/${totalCount} lang ang tama.`,
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors. (Task 5's page doesn't exist yet, so nothing references `submitQuizAttempt` yet — this step only confirms the actions file itself compiles.)

- [ ] **Step 5: Commit**

```bash
git add app/portal/actions.ts
git commit -m "Restrict Bible Study writes to staff, add quiz grading action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Courses list page — hide create form from non-staff

**Files:**
- Modify: `app/portal/courses/page.tsx`

**Interfaces:**
- Consumes: `isStaff` (new import, from `@/lib/portal`, alongside the existing `requirePastoralAccess`); `profile` (now destructured from `requirePastoralAccess()`'s return, previously only `supabase` was destructured).
- Produces: no new exports — this is a leaf page.

- [ ] **Step 1: Replace the page**

Replace all of `app/portal/courses/page.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add app/portal/courses/page.tsx
git commit -m "Hide course create form from non-staff on Bible Study list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Course detail page — hide staff forms, add per-lesson status badges

**Files:**
- Modify: `app/portal/courses/[id]/page.tsx`

**Interfaces:**
- Consumes: `isStaff` (new import, from `@/lib/portal`); `type QuizQuestion` (new import, from `@/lib/courses`); `profile` (already available from `requirePastoralAccess()`, now also used for role check and for filtering the new completions query); table `public.lesson_completions` from Task 1.
- Produces: no new exports — this is a leaf page. Task 5's lesson page links here via "← Course" (unchanged href shape, not affected by this task).

- [ ] **Step 1: Replace the page**

Replace all of `app/portal/courses/[id]/page.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add "app/portal/courses/[id]/page.tsx"
git commit -m "Hide staff-only course forms and add per-lesson status badges

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Lesson detail page — staff edit view vs. member quiz-taking view

**Files:**
- Modify: `app/portal/courses/[id]/lessons/[lessonId]/page.tsx`

**Interfaces:**
- Consumes: `isStaff`, `fmtDate` (new imports, from `@/lib/portal`, alongside existing `requirePastoralAccess`); `submitQuizAttempt` from Task 2 (`../../../../actions`, same relative path already used for `updateLesson`/`deleteLesson`); table `public.lesson_completions` from Task 1.
- Produces: no new exports — this is a leaf page and the last one in this plan.

- [ ] **Step 1: Replace the page**

Replace all of `app/portal/courses/[id]/lessons/[lessonId]/page.tsx` with:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePastoralAccess, isStaff, fmtDate } from "@/lib/portal";
import { updateLesson, deleteLesson, submitQuizAttempt } from "../../../../actions";
import { formatQuizText, type QuizQuestion } from "@/lib/courses";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

type CompletionRow = { passed: boolean; correct_count: number; total_count: number; completed_at: string };

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
            <p className="whitespace-pre-line text-sm text-gray-700">{lesson.content}</p>
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully` (confirm no page from this plan appears in the later, known-flaky prerender error).

- [ ] **Step 3: Commit**

```bash
git add "app/portal/courses/[id]/lessons/[lessonId]/page.tsx"
git commit -m "Add member quiz-taking view for Bible Study lessons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Rollout order (after all tasks are committed)

1. User confirms `supabase/004_bible_study_courses.sql` has already been applied to the live Supabase project (required before `005` can run — `005` assumes `courses`/`lessons` already exist).
2. User reviews and runs `supabase/005_bible_study_progress.sql` in the Supabase SQL Editor.
3. User confirms in the Supabase Table Editor: `courses_select`/`courses_write` and `lessons_select`/`lessons_write` policies exist (replacing `courses_all`/`lessons_all`), and `lesson_completions` exists with RLS enabled.
4. User reviews the branch and approves pushing/merging to `main`; push triggers the existing Vercel auto-deploy.
5. User spot-checks on the live site: as Admin/Secretary, confirm course/lesson CRUD still works exactly as before; as a Pastoral Ministry member with a non-staff role, confirm all create/edit/publish/delete forms are gone, take a quiz, see the graded status appear on the lesson list, retake it with different answers and confirm the row updates in place instead of duplicating; confirm a lesson with an empty quiz shows no badge and no submit form for a non-staff viewer.

If step 1 or 2 hasn't happened yet when this code deploys, the new quiz-taking UI and status badges would query a table (`lesson_completions`) that doesn't exist yet and error — the SQL must be applied *before* this code goes live.
