# Bible Study Courses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/Secretary and Pastoral Ministry members author "Bible Study Courses" (courses → lessons, each lesson with reading content and an optional self-check multiple-choice quiz) inside the portal, visible to nobody else.

**Architecture:** Two new Supabase tables (`courses`, `lessons`) with RLS scoped to `is_staff()` or a new `in_named_ministry('Pastoral Ministry')` helper — one audience, full read/write, no public-facing side. A new `requirePastoralAccess()` in `lib/portal.ts` mirrors the existing `requireFinanceSectionAccess()` pattern at the application layer. Quizzes are stored as a single `quiz jsonb` column on `lessons` (matching how `sermons.verses`/`sermons.questions` are already stored), authored through one textarea using a small line-based mini-syntax parsed by new pure functions in `lib/courses.ts`. New CRUD pages under `/portal/courses` follow the existing list-page-plus-`[id]`-detail-page pattern already used by `/portal/sermons`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Supabase (Postgres + `@supabase/ssr`), Tailwind CSS. No test framework is installed in this repo; Node 24's native TypeScript execution (`node file.ts`, no flag needed) is used for one-off manual verification of the new pure parsing functions in Task 3.

**Spec:** `docs/superpowers/specs/2026-09-22-bible-study-courses-design.md`

## Global Constraints

- No automated test framework exists in this repo (no jest/vitest/playwright, no `test` script in `package.json`). Every task's verification step is `npx tsc --noEmit` (no *new* type errors — this repo has 3 pre-existing, unrelated errors in `components/auth-button.tsx` and `lib/supabase/server.ts` that are out of scope) plus, for pages, `npm run build` reaching `✓ Compiled successfully`.
- Nobody in this session has credentials to run SQL against the live Supabase project. The migration SQL is written and committed to the repo, but **actually applying it is a manual step the user performs in the Supabase SQL Editor**, and it must happen before the code that depends on the new tables is deployed.
- Never `git push` without the user's explicit go-ahead in that turn (this repo's earlier standing instruction) — unless the session's own memory/settings already say otherwise for `main` at the time this plan is executed. Every task below ends with a **local commit only**; pushing/merging is a separate, explicit step outside this plan.
- Follow existing file conventions exactly: shared UI atoms from `@/components/portal/ui` (`Panel`, `Field`, `Empty`, `Notice`, `PageHeader`, `btnCls`, `btnGhostCls`, `btnDangerCls`, `inputCls`), shared helpers from `@/lib/portal` (`str`, `strOrNull`, `back`, `fmtDate`, `getSupabase`) and `next/cache`'s `revalidatePath`. Reuse the list-page-with-inline-create-form + `[id]`-detail-page-with-inline-edit-form shape already used by `/portal/sermons` — do not invent a new admin UI pattern or add new client components/state where a plain server-rendered form already does the job.
- Portal UI copy is Tagalog-first, matching every existing portal page.
- Access rule for every read and write in this feature: `isStaff(role)` (Admin/Secretary) **or** membership in the "Pastoral Ministry" ministry — no other role, and no distinction between viewer and editor within that audience. Gate every server action and page with the new `requirePastoralAccess()` (Task 2), never `requireRoles(...)` directly.
- Windows/PowerShell dev environment — use the `Bash`/`PowerShell` tool as already used in this session; commands below are written for either.

---

### Task 1: Database migration (courses + lessons tables, `in_named_ministry` helper, RLS, seed)

**Files:**
- Create: `supabase/004_bible_study_courses.sql`
- Create: `supabase/004_rollback.sql`

**Interfaces:**
- Produces: table `public.courses` (columns: `id, title, description, published, created_by, created_at, updated_at`), table `public.lessons` (columns: `id, course_id, title, content, quiz jsonb, position, created_at, updated_at`), and SQL function `public.in_named_ministry(ministry_name text) returns boolean` — all consumed by every later task via Supabase queries/RLS against these exact names.

- [ ] **Step 1: Write the migration file**

Create `supabase/004_bible_study_courses.sql`:

```sql
-- =====================================================================
-- IDBCJ MEMBER PORTAL - 004: Bible Study Courses (Pastoral Ministry)
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 004_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. COURSES
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. LESSONS
-- ---------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text not null default '',
  quiz jsonb not null default '[]'::jsonb, -- [{question, choices: [{text, correct}]}]
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. HELPER: kasapi ba ng ministry na may partikular na PANGALAN (hindi
--    fixed uuid) ang kasalukuyang naka-login. Kailangan ito dahil ang
--    "Pastoral Ministry" (gaya ng "Finance Ministry") ay hindi
--    fixed-id na seed sa migration history na ito -- iba ito sa
--    existing public.in_ministry(uuid), na umaasa sa alam nang id.
-- ---------------------------------------------------------------------
create or replace function public.in_named_ministry(ministry_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    where mm.profile_id = auth.uid() and m.name = ministry_name
  );
$$;

-- ---------------------------------------------------------------------
-- 4. SEED: "Pastoral Ministry" (kung wala pa)
-- ---------------------------------------------------------------------
insert into public.ministries (name)
values ('Pastoral Ministry')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
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

alter table public.courses enable row level security;
alter table public.lessons enable row level security;

-- Iisang audience lang: Admin/Secretary o kasapi ng Pastoral Ministry,
-- parehong karapatan sa view at edit -- walang ibang makakakita.
create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy lessons_all on public.lessons for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

commit;
```

- [ ] **Step 2: Write the rollback file**

Create `supabase/004_rollback.sql`:

```sql
-- ROLLBACK ng 004_bible_study_courses.sql
-- Binubura nito ang courses at lessons table (kasama ang lahat ng
-- naitalang course/lesson, pati ang kanilang RLS policies) at ang
-- in_named_ministry() helper function.
-- HINDI binubura ang naseed na "Pastoral Ministry" na row sa ministries
-- table -- baka ginagamit na ito ng ibang bagay sa oras ng rollback.
begin;
drop table if exists public.lessons, public.courses cascade;
drop function if exists public.in_named_ministry(text);
commit;
```

- [ ] **Step 3: Self-review the SQL (no live database access in this session)**

Read both files back and confirm:
- Every statement is idempotent (`create table if not exists`, the `do $$ ... drop policy ... end $$` loop before `create policy`, `create or replace function`, `on conflict (name) do nothing` on the seed insert) — matches the pattern in `supabase/003_sermons_events.sql`.
- Both migration and rollback are wrapped in `begin; ... commit;`.
- Column names here (`title, description, published, created_by, created_at, updated_at` on `courses`; `course_id, title, content, quiz, position, created_at, updated_at` on `lessons`) exactly match what Tasks 2-7 will query — cross-check against this task's "Produces" list above before moving on.
- Do **not** attempt to run this against Supabase from this session — no credentials are configured here. This is a manual step for the user (see rollout note at the end of this plan).

- [ ] **Step 4: Commit**

```bash
git add supabase/004_bible_study_courses.sql supabase/004_rollback.sql
git commit -m "Add courses and lessons tables with RLS (migration, not yet applied)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/portal.ts` — Pastoral Ministry access helper

**Files:**
- Modify: `lib/portal.ts`

**Interfaces:**
- Consumes: `requirePortalAccess()`, `isStaff(role)` (both already defined earlier in this same file); table `public.ministry_members` (existing).
- Produces: `export const PASTORAL_MINISTRY_NAME = "Pastoral Ministry"`, `export async function requirePastoralAccess(): Promise<{ supabase, user, profile }>` (same return shape as `requirePortalAccess()`) — consumed by Tasks 4, 5, 6, 7.

- [ ] **Step 1: Add the constant and access function**

In `lib/portal.ts`, find this existing block (the alias line right after `requireFinanceSectionAccess`):

```ts
// Alias para sa dating pangalan (Expenses page lang gumagamit nito dati)
export const requireExpenseAccess = requireFinanceSectionAccess;
```

Add this immediately after it:

```ts

// Ministry na ang mga miyembro ay may access sa Bible Study Courses
// (parehong view at edit -- walang ibang audience)
export const PASTORAL_MINISTRY_NAME = "Pastoral Ministry";

// Buong Bible Study Courses section: Admin/Secretary, o kasapi ng
// "Pastoral Ministry" (parehong rights, kagaya ng Finance Ministry pattern)
export async function requirePastoralAccess() {
  const ctx = await requirePortalAccess();
  const { supabase, profile } = ctx;
  if (isStaff(profile.role)) return ctx;
  const { data } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
  const ministryNames = ((data ?? []) as any[]).map((m) => m.ministries?.name).filter(Boolean);
  if (!ministryNames.includes(PASTORAL_MINISTRY_NAME))
    redirect("/portal?error=" + encodeURIComponent("Wala kang access sa pahinang iyon."));
  return ctx;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors (`components/auth-button.tsx`, `lib/supabase/server.ts`).

- [ ] **Step 3: Commit**

```bash
git add lib/portal.ts
git commit -m "Add requirePastoralAccess for Bible Study Courses

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/courses.ts` — quiz mini-syntax parser

**Files:**
- Create: `lib/courses.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no imports).
- Produces: `export type QuizChoice = { text: string; correct: boolean }`, `export type QuizQuestion = { question: string; choices: QuizChoice[] }`, `export function parseQuizText(text: string): QuizQuestion[]`, `export function formatQuizText(quiz: QuizQuestion[]): string` — `parseQuizText` consumed by Task 4's `updateLesson` action, `formatQuizText` consumed by Task 7's lesson edit page.

- [ ] **Step 1: Write the implementation**

Create `lib/courses.ts`:

```ts
// Ligtas gamitin sa browser at sa server (walang server-only import dito)

export type QuizChoice = { text: string; correct: boolean };
export type QuizQuestion = { question: string; choices: QuizChoice[] };

// Isang textarea lang ang ginagamit para sa buong quiz ng isang aralin.
// Blangkong linya ang naghihiwalay ng bawat tanong. Sa loob ng isang
// tanong, ang unang linya ay ang tanong mismo; ang mga susunod na linya
// na nagsisimula sa "* " ay TAMANG sagot, at "- " ay MALING choice.
// Hal.:
//   Sino ang sumulat ng Ebanghelyo ni Juan?
//   * Apostol Juan
//   - Pedro
//   - Pablo
//
// Isang tanong na walang tamang sagot ay hindi isinasama (best-effort,
// tulad ng tolerant na parsing ng ibang free-text fields sa sermons).
export function parseQuizText(text: string): QuizQuestion[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const quiz: QuizQuestion[] = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const question = lines[0];
    const choices: QuizChoice[] = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith("* ")) choices.push({ text: line.slice(2).trim(), correct: true });
      else if (line.startsWith("- ")) choices.push({ text: line.slice(2).trim(), correct: false });
    }
    const validChoices = choices.filter((c) => c.text);
    if (question && validChoices.some((c) => c.correct)) {
      quiz.push({ question, choices: validChoices });
    }
  }
  return quiz;
}

export function formatQuizText(quiz: QuizQuestion[]): string {
  return quiz
    .map((q) => [q.question, ...q.choices.map((c) => `${c.correct ? "*" : "-"} ${c.text}`)].join("\n"))
    .join("\n\n");
}
```

- [ ] **Step 2: Manually verify the round-trip behavior**

This repo has no test framework, but Node 24 runs `.ts` files with plain type annotations directly, so verify the actual exported functions (not a reimplementation) with a one-off command — no file is created or committed for this step:

Run (from the repo root):

```bash
node -e "import('./lib/courses.ts').then(({ parseQuizText, formatQuizText }) => { \
  const quiz = parseQuizText('Sino ang sumulat ng Ebanghelyo ni Juan?\n* Apostol Juan\n- Pedro\n- Pablo\n\nIlang taon ang ministri ni Jesus?\n* 3 taon\n- 1 taon'); \
  if (quiz.length !== 2) throw new Error('expected 2 questions, got ' + quiz.length); \
  if (quiz[0].choices.length !== 3 || !quiz[0].choices[0].correct) throw new Error('question 1 parsed wrong: ' + JSON.stringify(quiz[0])); \
  if (quiz[1].choices.length !== 2 || !quiz[1].choices[0].correct) throw new Error('question 2 parsed wrong: ' + JSON.stringify(quiz[1])); \
  const roundTrip = parseQuizText(formatQuizText(quiz)); \
  if (JSON.stringify(roundTrip) !== JSON.stringify(quiz)) throw new Error('round-trip mismatch: ' + JSON.stringify(roundTrip)); \
  const dropped = parseQuizText('Tanong na walang tamang sagot?\n- Mali lang\n- Mali rin'); \
  if (dropped.length !== 0) throw new Error('expected question with no correct choice to be dropped, got ' + JSON.stringify(dropped)); \
  console.log('OK'); \
})"
```

Expected: prints `OK`. If it throws, fix `lib/courses.ts` and rerun before moving on.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

- [ ] **Step 4: Commit**

```bash
git add lib/courses.ts
git commit -m "Add quiz mini-syntax parser for Bible Study lesson quizzes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Course + lesson server actions

**Files:**
- Modify: `app/portal/actions.ts`

**Interfaces:**
- Consumes: `str`, `strOrNull`, `back` (already imported at the top of the file); `requirePastoralAccess` from `@/lib/portal` (Task 2, needs to be **added** to the existing `@/lib/portal` import list); `parseQuizText` from `@/lib/courses` (Task 3, needs a **new** import line); `revalidatePath`, `redirect` (already imported). Tables `public.courses`, `public.lessons` from Task 1.
- Produces: `export async function createCourse(fd: FormData)`, `updateCourse(fd: FormData)`, `toggleCourse(fd: FormData)`, `deleteCourse(fd: FormData)`, `createLesson(fd: FormData)`, `updateLesson(fd: FormData)`, `deleteLesson(fd: FormData)` — all consumed by Tasks 5-7's forms.

- [ ] **Step 1: Add the new imports**

At the top of `app/portal/actions.ts`, add `requirePastoralAccess` to the existing `@/lib/portal` import list:

```ts
import {
  back,
  fmtDate,
  getPortalContext,
  isStaff,
  KINDS,
  requireExpenseAccess,
  requireFinanceSectionAccess,
  requireLocalFinanceAccess,
  requirePastoralAccess,
  requirePortalAccess,
  requireRoles,
  str,
  strOrNull,
  type Role,
} from "@/lib/portal";
```

Then add a new import line right after the existing `@/lib/finance` import:

```ts
import { FINANCE_CATEGORIES, monthToDate } from "@/lib/finance";
import { parseQuizText } from "@/lib/courses";
```

- [ ] **Step 2: Append the course and lesson actions**

Add this new section at the end of `app/portal/actions.ts` (after the last existing export):

```ts
// ---------------------------------------------------------------
// BIBLE STUDY COURSES (Admin/Secretary o Pastoral Ministry) --
// courses + lessons, parehong view at edit access
// ---------------------------------------------------------------
export async function createCourse(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const title = str(fd, "title");
  if (!title) back("/portal/courses", "error", "Kailangan ng pamagat.");
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description: strOrNull(fd, "description"),
      published: str(fd, "published") === "on",
    })
    .select("id")
    .single();
  if (error) back("/portal/courses", "error", "Hindi nagawa: " + error.message);
  revalidatePath("/portal/courses");
  redirect(`/portal/courses/${data!.id}`);
}

export async function updateCourse(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const id = str(fd, "id");
  const path = `/portal/courses/${id}`;
  const title = str(fd, "title");
  if (!title) back(path, "error", "Kailangan ng pamagat.");
  const { error } = await supabase
    .from("courses")
    .update({
      title,
      description: strOrNull(fd, "description"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/courses", "layout");
  back(path, "ok", "Na-update ang course.");
}

export async function toggleCourse(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const id = str(fd, "id");
  const { error } = await supabase
    .from("courses")
    .update({ published: str(fd, "publish") === "true" })
    .eq("id", id);
  if (error) back(`/portal/courses/${id}`, "error", "Hindi na-update: " + error.message);
  revalidatePath("/portal/courses", "layout");
  back(`/portal/courses/${id}`, "ok", "Na-update ang course.");
}

export async function deleteCourse(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const id = str(fd, "id");
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) back(`/portal/courses/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/courses", "layout");
  redirect("/portal/courses?ok=" + encodeURIComponent("Nabura ang course."));
}

export async function createLesson(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const courseId = str(fd, "course_id");
  const title = str(fd, "title");
  if (!title) back(`/portal/courses/${courseId}`, "error", "Kailangan ng pamagat ng aralin.");
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      title,
      position: Number(str(fd, "position")) || 0,
    })
    .select("id")
    .single();
  if (error) back(`/portal/courses/${courseId}`, "error", "Hindi nagawa: " + error.message);
  revalidatePath(`/portal/courses/${courseId}`);
  redirect(`/portal/courses/${courseId}/lessons/${data!.id}`);
}

export async function updateLesson(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const id = str(fd, "id");
  const courseId = str(fd, "course_id");
  const path = `/portal/courses/${courseId}/lessons/${id}`;
  const title = str(fd, "title");
  if (!title) back(path, "error", "Kailangan ng pamagat.");
  const { error } = await supabase
    .from("lessons")
    .update({
      title,
      position: Number(str(fd, "position")) || 0,
      content: str(fd, "content"),
      quiz: parseQuizText(str(fd, "quiz")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath(`/portal/courses/${courseId}`, "layout");
  back(path, "ok", "Na-update ang aralin.");
}

export async function deleteLesson(fd: FormData) {
  const { supabase } = await requirePastoralAccess();
  const id = str(fd, "id");
  const courseId = str(fd, "course_id");
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) back(`/portal/courses/${courseId}/lessons/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath(`/portal/courses/${courseId}`, "layout");
  redirect(`/portal/courses/${courseId}?ok=` + encodeURIComponent("Nabura ang aralin."));
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors (Tasks 5-7's pages don't exist yet, so nothing new references these actions yet — this step just confirms the actions file itself compiles).

- [ ] **Step 4: Commit**

```bash
git add app/portal/actions.ts
git commit -m "Add server actions for managing Bible Study courses and lessons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Courses list + create page

**Files:**
- Create: `app/portal/courses/page.tsx`

**Interfaces:**
- Consumes: `createCourse` from Task 4; `requirePastoralAccess` from `@/lib/portal` (Task 2); `Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls` from `@/components/portal/ui`. Table `public.courses` from Task 1.
- Produces: route `/portal/courses` — consumed by Task 6 (links into it) and Task 8's nav item.

- [ ] **Step 1: Create the page**

Create `app/portal/courses/page.tsx`:

```tsx
import Link from "next/link";
import { requirePastoralAccess } from "@/lib/portal";
import { createCourse } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requirePastoralAccess();

  const { data } = await supabase
    .from("courses")
    .select("id, title, description, published")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (data ?? []) as { id: string; title: string; description: string | null; published: boolean }[];

  return (
    <>
      <PageHeader title="Bible Study" subtitle="Pamahalaan ang mga Bible Study course para sa Pastoral Ministry." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
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
        </div>

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
git commit -m "Add Bible Study courses list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Course detail page (edit course + lessons list + create lesson)

**Files:**
- Create: `app/portal/courses/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateCourse, toggleCourse, deleteCourse, createLesson` from Task 4; `requirePastoralAccess, fmtDate` from `@/lib/portal`; `Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls` from `@/components/portal/ui`. Tables `public.courses`, `public.lessons` from Task 1.
- Produces: route `/portal/courses/[id]` — consumed by Task 7 (links into it from the lesson page's back-link) and by Task 4's `createLesson`/`updateCourse`/`toggleCourse`/`deleteCourse` redirect targets (already wired in Task 4).

- [ ] **Step 1: Create the page**

Create `app/portal/courses/[id]/page.tsx`:

```tsx
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
              {course.published ? "Nakikita na ito ng Pastoral Ministry." : "Draft pa lang."}
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add "app/portal/courses/[id]/page.tsx"
git commit -m "Add Bible Study course detail page (edit course, manage lessons)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Lesson edit page + nav bar wiring

**Files:**
- Create: `app/portal/courses/[id]/lessons/[lessonId]/page.tsx`
- Modify: `app/portal/layout.tsx`

**Interfaces:**
- Consumes: `updateLesson, deleteLesson` from Task 4; `formatQuizText` from Task 3 (`@/lib/courses`); `requirePastoralAccess, PASTORAL_MINISTRY_NAME` from `@/lib/portal` (Task 2); `Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls` from `@/components/portal/ui`. Tables `public.courses`, `public.lessons` from Task 1.
- Produces: route `/portal/courses/[id]/lessons/[lessonId]` and a nav item `{ href: "/portal/courses", label: "Bible Study" }` visible to Admin/Secretary or Pastoral Ministry members — nothing later in this plan depends on these.

- [ ] **Step 1: Create the lesson edit page**

Create `app/portal/courses/[id]/lessons/[lessonId]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Wire up the nav bar**

In `app/portal/layout.tsx`, add `PASTORAL_MINISTRY_NAME` to the existing `@/lib/portal` import:

```ts
import { getPortalContext, isStaff, isFinance, LOCAL_FINANCE_MINISTRY_NAME, FINANCE_MINISTRY_NAME, PASTORAL_MINISTRY_NAME } from "@/lib/portal";
```

Then find this block:

```ts
  {
    const needsMinistryCheck = !isFinance(profile.role);
    const { data: myMinistries } = needsMinistryCheck
      ? await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id)
      : { data: null };
    const isLocalFinanceMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === LOCAL_FINANCE_MINISTRY_NAME,
    );
    const isFinanceMinistryMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === FINANCE_MINISTRY_NAME,
    );

    // Finance role (Admin/Secretary/Treasurer) at Finance Ministry members ay parehong may
    // buong access sa Finance section (Financial Management, Audit Report, Expenses)
    if (isFinance(profile.role) || isFinanceMinistryMember) {
      items.push({
        href: "/portal/finance",
        label: "Finance",
        children: [
          { href: "/portal/finance", label: "Financial Management" },
          { href: "/portal/finance/report", label: "Audit Report" },
          { href: "/portal/finance/expenses", label: "Expenses" },
        ],
      });
    }
    if (isLocalFinanceMember) items.push({ href: "/portal/finance/local", label: "Local Finance" });
  }
```

Replace it with (only the `needsMinistryCheck` condition and the added Pastoral check are new):

```ts
  {
    const needsMinistryCheck = !(isFinance(profile.role) && isStaff(profile.role));
    const { data: myMinistries } = needsMinistryCheck
      ? await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id)
      : { data: null };
    const isLocalFinanceMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === LOCAL_FINANCE_MINISTRY_NAME,
    );
    const isFinanceMinistryMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === FINANCE_MINISTRY_NAME,
    );
    const isPastoralMinistryMember = ((myMinistries ?? []) as any[]).some(
      (m) => m.ministries?.name === PASTORAL_MINISTRY_NAME,
    );

    // Finance role (Admin/Secretary/Treasurer) at Finance Ministry members ay parehong may
    // buong access sa Finance section (Financial Management, Audit Report, Expenses)
    if (isFinance(profile.role) || isFinanceMinistryMember) {
      items.push({
        href: "/portal/finance",
        label: "Finance",
        children: [
          { href: "/portal/finance", label: "Financial Management" },
          { href: "/portal/finance/report", label: "Audit Report" },
          { href: "/portal/finance/expenses", label: "Expenses" },
        ],
      });
    }
    if (isLocalFinanceMember) items.push({ href: "/portal/finance/local", label: "Local Finance" });

    // Admin/Secretary o Pastoral Ministry members lang ang may access sa Bible Study Courses
    if (isStaff(profile.role) || isPastoralMinistryMember) {
      items.push({ href: "/portal/courses", label: "Bible Study" });
    }
  }
```

The `needsMinistryCheck` condition changes from `!isFinance(profile.role)` to
`!(isFinance(profile.role) && isStaff(profile.role))` because Treasurer
(`isFinance` true, `isStaff` false) still needs the ministry-membership query
to determine Bible Study nav visibility, even though Treasurer already has
Finance access by role alone. Admin/Secretary (both `isFinance` and `isStaff`
true) still skip the query entirely, same as before.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add "app/portal/courses/[id]/lessons/[lessonId]/page.tsx" app/portal/layout.tsx
git commit -m "Add lesson edit page and Bible Study nav item

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Rollout order (after all tasks are committed)

1. User reviews and runs `supabase/004_bible_study_courses.sql` in the Supabase SQL Editor (production project).
2. User confirms the `courses`/`lessons` tables and the seeded "Pastoral Ministry" ministry row look correct in the Supabase Table Editor, and assigns at least one non-staff member to that ministry for testing.
3. User reviews the branch and approves pushing/merging to `main` (per this repo's standing push-permission rule at the time); push triggers the existing Vercel auto-deploy.
4. User spot-checks on the live site: as Admin, create a course, add a lesson with a quiz, publish/unpublish, edit, delete a lesson, delete a course; as a Pastoral Ministry member (non-staff role), confirm the "Bible Study" nav item appears and the same CRUD actions work; as a member with neither `isStaff` role nor Pastoral Ministry membership, confirm the nav item is absent and `/portal/courses` redirects to `/portal` with the "Wala kang access" error.

If step 1 hasn't happened yet when the code deploys, `/portal/courses` would query tables that don't exist yet and error — the SQL migration must be applied *before* this code goes live.
