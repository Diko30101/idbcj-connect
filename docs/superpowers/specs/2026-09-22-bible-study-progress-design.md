# Design: Bible Study Courses — Access Tightening & Progress Tracking

Date: 2026-09-22
Status: Approved for implementation planning

## 1. Goal

Change the Bible Study Courses feature (shipped in the prior
`2026-09-22-bible-study-courses-design.md` spec) in two ways:

1. **Tighten write access.** Only Admin/Secretary (`is_staff()`) may
   create, edit, or delete courses and lessons — Pastoral Ministry
   members lose the edit rights they previously had equally with staff.
2. **Add per-member progress tracking**, explicitly reversing that
   spec's non-goal #1. A Pastoral Ministry member now takes each
   lesson's quiz interactively; the app grades it (100% correct
   required to pass) and remembers their latest score/status
   ("Pasado" / "Kailangan Ulitin"), shown next to each lesson in the
   course's lesson list.

## 2. Non-goals

- No staff-facing roster/oversight view of all members' scores. Each
  member sees only their own status. (User decision — can be added
  later as its own feature if needed.)
- No attempt history. `lesson_completions` keeps exactly one row per
  member+lesson; retaking a quiz overwrites the previous attempt.
  (User decision, matches "ipakita ang **huling** score.")
- No partial-credit passing threshold. Passing requires every question
  answered correctly (100%), not a percentage cutoff. (User decision.)
- No client-side interactive quiz component with per-question instant
  feedback. The quiz is a single plain HTML form, graded in one shot on
  submit — matching this codebase's established "no new client state,
  server-rendered form" convention (see `app/portal/sermons/[id]/page.tsx`,
  every course/lesson admin page so far).
- Lessons with an empty quiz (`quiz = []`, reading-only material) are
  not completable/gradeable under this design — there is nothing to
  submit, so no completion row is ever created for them, and the
  lesson list shows no status badge for such a lesson.

## 3. Access control changes

**Ground rule (per explicit instruction): reuse existing access-check
functions; do not add a new parallel one.** Both functions needed here
already exist and are already used elsewhere in this codebase:

- `requireRoles(["admin", "secretary"])` (`lib/portal.ts`) — already the
  exact gate `app/portal/sermons/**` and `app/portal/events/**` use for
  staff-only actions.
- `requirePastoralAccess()` (`lib/portal.ts`) — already the view gate
  for this feature (`is_staff()` OR "Pastoral Ministry" membership),
  unchanged from the prior spec.

### 3.1 Application layer

| Action / page | Old gate | New gate |
|---|---|---|
| `createCourse`, `updateCourse`, `toggleCourse`, `deleteCourse`, `createLesson`, `updateLesson`, `deleteLesson` (`app/portal/actions.ts`) | `requirePastoralAccess()` | `requireRoles(["admin", "secretary"])` |
| New `submitQuizAttempt` (`app/portal/actions.ts`) | — (new) | `requirePastoralAccess()` |
| `/portal/courses`, `/portal/courses/[id]`, `/portal/courses/[id]/lessons/[lessonId]` (page-level gate) | `requirePastoralAccess()` | unchanged (`requirePastoralAccess()`) — see §5 for what's conditionally *rendered* within each page |

The page-level gate stays the broad one because Pastoral Ministry
members still need to *view* courses/lessons and take quizzes; only the
*write* actions move to the staff-only gate.

### 3.2 Database layer (RLS)

**No existing course or lesson row is at risk.** RLS policies only
control who is *allowed* to perform which operation — they never read,
modify, or delete row contents themselves. Splitting a policy in two
cannot lose or corrupt data that's already there.

Today (migration `004`), one `for all` policy per table grants
`is_staff()` OR Pastoral-Ministry-membership equal rights to every
operation:

```sql
create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
```

Migration `005` drops `courses_all`/`lessons_all` and replaces each
with two policies:

```sql
create policy courses_select on public.courses for select to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy courses_write on public.courses for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
```

(identical shape for `lessons`). Postgres combines multiple permissive
policies for the same command with OR. For `SELECT`, both
`courses_select` and `courses_write` apply, so the effective condition
is unchanged: `is_staff() OR in_named_ministry(...)`. For
`INSERT`/`UPDATE`/`DELETE`, only `courses_write` applies — `for select`
policies never govern other commands — so those operations narrow to
`is_staff()` alone. This is the standard, minimal-diff way to tighten
write access while leaving read access exactly as broad as before.

### 3.3 New table: `lesson_completions`

```sql
create table if not exists public.lesson_completions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  correct_count integer not null,
  total_count integer not null,
  passed boolean not null,
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);
```

One row per member+lesson (composite primary key) — a retake overwrites
the existing row via `upsert`, matching "keep only the latest attempt."

RLS: every authenticated user may `select`/`insert`/`update` only their
own row:

```sql
create policy lesson_completions_own on public.lesson_completions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
```

No staff-oversight policy is added (per §2 non-goals — nothing needs it
yet, and adding an unused policy would be speculative).

## 4. Scoring: `submitQuizAttempt`

New server action in `app/portal/actions.ts`, gated by
`requirePastoralAccess()`:

1. Re-fetch the lesson's `quiz` column fresh from the database — never
   trust a client-submitted correctness claim.
2. For each question at index `i` in the fetched `quiz` array, read the
   submitted choice via `str(fd, `q${i}`)` (the chosen choice's index,
   as a string; empty/missing means "no answer," always counted wrong).
3. `total_count` = number of questions in the fetched quiz.
   `correct_count` = number of questions where the submitted choice
   index points at a choice with `correct: true`.
4. `passed = correct_count === total_count` (100% required, per §2).
5. `upsert` into `lesson_completions` on conflict `(profile_id,
   lesson_id)` do update, setting `correct_count`, `total_count`,
   `passed`, `completed_at = now()`.
6. Redirect back to the lesson page with an "ok" message showing the
   result inline (the lesson page itself also displays the stored
   status at the top, so the message is a confirmation, not the only
   place the score appears).

If the lesson's quiz is empty (`total_count === 0`), the quiz-taking UI
never renders a submit button in the first place (§5), so this action
is never invoked for such a lesson.

## 5. Page-by-page UI changes

### 5.1 `/portal/courses/page.tsx` (list)

The "Magdagdag ng course" create form is now wrapped in `isStaff(profile.role)` —
non-staff Pastoral Ministry members see only the list, no create form.
(`profile` is already returned by `requirePastoralAccess()`'s context.)

### 5.2 `/portal/courses/[id]/page.tsx` (course detail)

- "I-edit ang course" form, "Katayuan" (publish toggle) panel, and
  "Burahin" (delete) panel: wrapped in `isStaff(profile.role)` — hidden
  from non-staff. Non-staff see the course title/description as
  plain, read-only text instead of an edit form.
- "Magdagdag ng aralin" (create-lesson) form: staff-only, same wrapping.
- Lessons list: unchanged visibility (everyone with page access sees
  it), but each lesson row now also shows the *viewer's own* status,
  fetched from `lesson_completions` filtered to `profile_id = auth.uid()`
  (a second query alongside the existing lessons query, joined in
  memory by `lesson_id`) plus whether the lesson's `quiz` is empty
  (already selected as part of the existing lessons query — no extra
  column fetch needed). Three states, so a not-yet-attempted quiz
  lesson is visibly distinct from a lesson with nothing to take:
  - **Has a completion row:** "Pasado" (green) or "Kailangan Ulitin"
    (amber).
  - **No completion row, but `quiz` is non-empty:** "Hindi pa kinuha"
    (gray, neutral — there's a quiz waiting).
  - **`quiz` is empty:** no badge at all — nothing to take.

### 5.3 `/portal/courses/[id]/lessons/[lessonId]/page.tsx` (lesson detail)

Branches on `isStaff(profile.role)`:

- **Staff:** exactly today's page, unchanged — edit form (title,
  position, content, quiz textarea) + delete panel.
- **Non-staff (Pastoral Ministry member):** new read-only view —
  lesson title and content displayed as plain text (no edit form), then:
  - If the lesson has a prior `lesson_completions` row for this member,
    a status panel at the top showing "Pasado" or "Kailangan Ulitin"
    plus the score (`correct_count`/`total_count`) and `completed_at`.
  - If `lesson.quiz` is non-empty: a plain HTML form rendering each
    question with radio-button choices (`name="q${i}"`, `value` = choice
    index), submitting to `submitQuizAttempt` (hidden fields `lesson_id`,
    `course_id`). Retaking simply resubmits this same form.
  - If `lesson.quiz` is empty: no quiz section, no submit button, no
    status panel (per §2 non-goals) — just the reading content.

## 6. Migration files

- `supabase/005_bible_study_progress.sql` — the policy split (§3.2) and
  the new `lesson_completions` table + RLS (§3.3), idempotent
  (`create table if not exists`, drop-then-recreate policies) and
  transaction-wrapped, matching `004`'s conventions exactly. This
  migration assumes `004` has already been applied (the `courses`/
  `lessons` tables and their current policies must exist) — the file's
  header comment states this dependency explicitly.
- `supabase/005_rollback.sql` — drops `lesson_completions`, and
  restores the original `courses_all`/`lessons_all` single-policy shape
  (re-running the exact policy-creation statements from `004`'s RLS
  section) so a rollback fully undoes `005` without needing to also
  re-run `004`.

## 7. Testing / verification plan

No test framework exists in this repo (established constraint). Verify:

- `npx tsc --noEmit` — no new errors beyond the 3 pre-existing,
  unrelated ones.
- `npm run build` — reaches `✓ Compiled successfully`.
- Manual checklist after the user applies `005` (see §8):
  - As Admin: confirm course/lesson CRUD still works exactly as before
    (create, edit, publish toggle, delete) — nothing regresses for staff.
  - As a Pastoral Ministry member with a non-staff role: confirm the
    create/edit/publish/delete forms are gone from all 3 pages; confirm
    a course with lessons is still fully readable; take a quiz, get
    graded, see the status appear on the course's lesson list; retake
    the same quiz with different (correct) answers and confirm the
    status updates in place rather than creating a second row.
  - As the same non-staff Pastoral Ministry member, attempt to submit
    the (now-removed) edit form directly via a raw request if easy to
    simulate, or at minimum confirm via the Supabase Table Editor that
    RLS actually rejects a manual `update`/`insert`/`delete` against
    `courses`/`lessons` from a non-staff, ministry-member session —
    this is the real security boundary, not just the hidden UI.
  - Confirm a lesson with an empty quiz shows no status badge and no
    submit button for a non-staff viewer.

## 8. Rollout order

1. User reviews and runs `supabase/005_bible_study_progress.sql` in the
   Supabase SQL Editor — **after** confirming `004` has already been
   applied (it must have been, per the prior spec's rollout, before the
   Bible Study Courses code could have gone live at all).
2. User confirms in the Supabase Table Editor: `courses_select`/
   `courses_write` and `lessons_select`/`lessons_write` policies exist
   (replacing `courses_all`/`lessons_all`), and the new
   `lesson_completions` table exists with RLS enabled.
3. Code changes committed to a feature branch (no push without
   explicit permission, per this repo's standing instruction).
4. User reviews and approves the push/merge to `main`; push triggers
   the existing Vercel auto-deploy.
5. User spot-checks per the §7 manual checklist on the live site,
   using both an Admin/Secretary account and a non-staff Pastoral
   Ministry member account.

If step 1 hasn't happened yet when the code deploys, the new
quiz-taking UI and status badges would query a table
(`lesson_completions`) that doesn't exist yet and error — the SQL
migration must be applied *before* this code goes live, same rule as
every prior migration in this project.
