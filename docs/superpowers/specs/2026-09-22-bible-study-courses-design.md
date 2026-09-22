# Design: Bible Study Courses (Pastoral Ministry)

Date: 2026-09-22
Status: Approved for implementation planning

## 1. Goal

Give the Pastoral Ministry a place inside the portal to author and share
structured Bible study material: a `courses` → `lessons` hierarchy, each
lesson with reading content and an optional self-check multiple-choice
quiz. Admin/Secretary and Pastoral Ministry members can create, edit,
and delete courses and lessons. No other portal role can see this
section.

## 2. Non-goals

- No per-member progress tracking (completed lessons, quiz scores). If
  needed later, that's a separate feature with its own table
  (`lesson_progress` or similar) — adding it now would be speculative.
  (User decision.)
- No distinction between "viewer" and "editor" within the section: every
  Admin/Secretary or Pastoral Ministry member who can see a course can
  also edit or delete it, matching how the user described the access
  rule. There is no per-course ownership/lock.
- No separate "polished student reading view" apart from the admin-style
  edit page — mirrors the existing sermons/events admin pattern, where
  the one page both displays and edits, since the whole audience for
  this section already has edit rights.
- No quiz grading UI, correctness persistence, or attempts history —
  quizzes are self-check only (a member can reveal which choice was
  marked correct while reading).

## 3. Data model

Follows the same conventions as `supabase/003_sermons_events.sql`:
idempotent (`create table if not exists`), wrapped in a transaction,
RLS-first, a matching rollback file.

### 3.1 `courses`

```sql
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2 `lessons`

```sql
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text not null default '',
  quiz jsonb not null default '[]'::jsonb,  -- [{question, choices: [{text, correct}]}]
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`quiz` is stored as `jsonb` rather than `quiz_questions`/`quiz_choices`
child tables, for the same reason `sermons.verses`/`sermons.questions`
are `jsonb`: the whole quiz is always read and written as one unit with
its lesson (one form, one save), never queried or joined independently,
and there is no progress/grading table that would need a foreign key
into individual questions. Two extra tables and two extra sets of RLS
policies would add real complexity for no behavioral benefit today. If
per-question analytics are ever needed, that's the point to normalize —
not before.

Shape of one `quiz` element:

```json
{ "question": "Sino ang sumulat ng Ebanghelyo ni Juan?", "choices": [{"text": "Apostol Juan", "correct": true}, {"text": "Pedro", "correct": false}] }
```

### 3.3 New SQL helper: `in_named_ministry`

`public.in_ministry(m uuid)` (existing, in `001_portal_schema.sql`)
checks membership by ministry *id*, which the Finance section couldn't
use because "Finance Ministry" isn't a fixed, migration-seeded id in
this codebase's history — it's looked up by name at the application
layer instead (`lib/portal.ts`, `requireFinanceSectionAccess`). Bible
Study Courses needs the same name-based check, but at the RLS layer
this time (unlike Finance's tables, which have no RLS policies in this
repo's migration history — see note in §3.5). Rather than duplicate the
Finance app-layer pattern with no DB-level enforcement, this feature
adds a small reusable helper:

```sql
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
```

### 3.4 RLS

```sql
alter table public.courses enable row level security;
alter table public.lessons enable row level security;

create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy lessons_all on public.lessons for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
```

Unlike sermons/events, there's no `anon`/public-read policy — this
section has exactly one audience (Admin/Secretary + Pastoral Ministry),
so the "all" policy covers both read and write for that audience, and
everyone else gets nothing.

### 3.5 Seed data

Idempotent seed for the ministry itself, since it's unknown whether it
already exists (user decision: handle it in the migration either way):

```sql
insert into public.ministries (name)
values ('Pastoral Ministry')
on conflict (name) do nothing;
```

Note: `financial_records`/`expense_records` (used by the existing
Finance section) have no corresponding migration file in this repo and
apparently no RLS policies either — access there is enforced only at
the application layer (`requireFinanceSectionAccess`). This spec does
not change that; it only means Bible Study Courses' DB-level RLS is
*more* defensive than Finance's, not that Finance is being retrofitted
here.

### 3.6 Migration files

- `supabase/004_bible_study_courses.sql` — the migration above, run
  manually by the Presiding Minister in the Supabase SQL Editor.
- `supabase/004_rollback.sql` — drops both tables, the `in_named_ministry`
  function, and their policies. Does **not** delete the seeded "Pastoral
  Ministry" ministry row or its memberships, since that row may already
  be in active use for reasons unrelated to this feature by the time
  someone rolls back.

## 4. Application changes

### 4.1 `lib/portal.ts`

```ts
export const PASTORAL_MINISTRY_NAME = "Pastoral Ministry";

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

Mirrors `requireFinanceSectionAccess` exactly, but gates on `isStaff`
(Admin/Secretary) rather than `isFinance`, per the user's stated access
rule (Treasurer alone should not get Bible Study access).

### 4.2 Quiz mini-syntax parser (new, in `lib/finance.ts`-style pure-function file — `lib/courses.ts`)

A single textarea holds the whole quiz for a lesson, in a line-based
format matching the spirit of the existing `parseVerses`/`parseQuestions`
helpers in `app/portal/actions.ts`:

```
Sino ang sumulat ng Ebanghelyo ni Juan?
* Apostol Juan
- Pedro
- Pablo

Ilang taon ang ministri ni Jesus sa lupa?
* 3 taon
- 1 taon
```

Rules: blank line separates questions; `* ` prefix = correct choice,
`- ` prefix = incorrect choice; a question needs at least one choice
marked correct to be kept (silently dropped otherwise — same
"best-effort, no hard validation" tolerance sermons' free-text fields
already have). Two pure functions:

- `parseQuizText(text: string): QuizQuestion[]` — used by the server
  actions when saving.
- `formatQuizText(quiz: QuizQuestion[]): string` — used to pre-fill the
  edit textarea (`defaultValue`), same round-trip pattern as
  `sermon.questions.join("\n")` in `app/portal/sermons/[id]/page.tsx`.

### 4.3 New pages

- **`app/portal/courses/page.tsx`** — gated by `requirePastoralAccess()`.
  Left column: list of all courses (Draft badge when `published=false`,
  matching `app/portal/sermons/page.tsx`'s badge). Right column: "Magdagdag
  ng course" form (title, description, published checkbox).
- **`app/portal/courses/[id]/page.tsx`** — edit course fields (title,
  description, published toggle, delete-course button, same
  panel-per-action layout as `app/portal/sermons/[id]/page.tsx`), plus a
  list of the course's lessons (title, ordered by `position`) each
  linking to its own page, plus a "Magdagdag ng aralin" create-lesson
  form (title, position).
- **`app/portal/courses/[id]/lessons/[lessonId]/page.tsx`** — edit one
  lesson: title, position, content (textarea), quiz (textarea using the
  mini-syntax above, pre-filled via `formatQuizText`), delete-lesson
  button.

### 4.4 Server actions (`app/portal/actions.ts`)

New actions, following the existing `createSermon`/`updateSermon`/
`deleteSermon` shape (gated via `requirePastoralAccess()` instead of
`requireRoles`, `revalidatePath`, `back()`/`redirect()`):

- `createCourse`, `updateCourse`, `toggleCourse`, `deleteCourse`
- `createLesson`, `updateLesson` (calls `parseQuizText` on the quiz
  textarea before saving), `deleteLesson`

### 4.5 Nav (`app/portal/layout.tsx`)

Extends the existing ministry-membership query block (already fetched
once for the Finance/Local Finance checks) rather than adding a second
query:

```ts
const isPastoralMinistryMember = ((myMinistries ?? []) as any[]).some(
  (m) => m.ministries?.name === PASTORAL_MINISTRY_NAME,
);
if (isStaff(profile.role) || isPastoralMinistryMember) {
  items.push({ href: "/portal/courses", label: "Bible Study" });
}
```

The block's `needsMinistryCheck` condition changes from `!isFinance(profile.role)`
to `!(isFinance(profile.role) && isStaff(profile.role))`, since Treasurer
(`isFinance` but not `isStaff`) still needs the ministry-membership query
to determine Bible Study nav visibility, even though Treasurer already
has Finance access by role alone.

## 5. Testing / verification plan

- `npx tsc --noEmit` — confirm no new type errors beyond the 3
  pre-existing, unrelated ones (`auth-button.tsx` / `lib/supabase/server.ts`).
- `npm run build` — confirm compilation succeeds.
- Manual verification after the user runs the migration (see §6):
  - As Admin: create a course, add a lesson with a quiz, publish/unpublish,
    edit, delete a lesson, delete a course.
  - As a Pastoral Ministry member (non-staff role): confirm the "Bible
    Study" nav item appears and the same CRUD actions work.
  - As a member with no Pastoral Ministry membership and a non-staff
    role: confirm the nav item is absent and `/portal/courses` redirects
    to `/portal` with the "Wala kang access" error.
  - Quiz textarea round-trip: enter quiz text, save, reopen the edit
    page, confirm the textarea shows the same text back.

## 6. Rollout order

1. User reviews and runs `supabase/004_bible_study_courses.sql` in the
   Supabase SQL Editor (production project).
2. User confirms the `courses`/`lessons` tables and the seeded "Pastoral
   Ministry" ministry row look correct in the Supabase Table Editor, and
   assigns at least one member to that ministry for testing.
3. Code changes are committed to `feature/bible-study-courses` (no push
   without explicit permission, per standing instruction).
4. User reviews and approves the push/merge to `main`; push triggers the
   existing Vercel auto-deploy.
5. User spot-checks `/portal/courses` on the live site per §5.

If step 1 hasn't happened yet when the code deploys, `/portal/courses`
would query tables that don't exist yet and error — the SQL migration
must be applied *before* this code goes live.
