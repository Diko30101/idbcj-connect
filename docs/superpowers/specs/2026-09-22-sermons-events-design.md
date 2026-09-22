# Design: Database-backed Sermon Library and Events

Date: 2026-09-22
Status: Approved for implementation planning

## 1. Goal

Today two public pages are edited only by changing code and redeploying:

- `app/sermons/page.tsx` + `app/sermons/[slug]/page.tsx` read from a
  hardcoded array in `lib/sermons.ts`.
- `app/events/page.tsx` shows only the recurring Sunday worship in
  Medina (hardcoded, and out of sync with the other two locales already
  shown on the homepage).

Admin and Secretary should be able to add a new sermon or a one-off
special event (revival, anniversary, baptism, etc.) from the portal,
without a developer editing code or redeploying.

## 2. Non-goals

- No file upload UI for sermon PDFs. The PDF still gets placed in
  `public/sermons/pdf/` by a developer; the admin form only records the
  path/filename. (User decision.)
- The recurring weekly worship schedule (3 locales) stays hardcoded in
  `lib/worship.ts`. Only one-off/special events move to the database.
  (User decision.)
- No new roles. Only `admin` and `secretary` (the existing `is_staff()` /
  `requireRoles(["admin","secretary"])` convention) can manage sermons
  and events. (User decision.)
- No change to how members view announcements, ministries, or any other
  existing portal feature.

## 3. Data model

Both new tables follow the same conventions already used in
`supabase/001_portal_schema.sql` and `002_username_category.sql`:
idempotent (`create table if not exists`, `add column if not exists`),
wrapped in a transaction, RLS-first, bilingual comments, and a matching
rollback file.

### 3.1 `sermons`

```sql
create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_tl text,
  speaker text not null,
  sermon_date date not null,
  category text not null default 'General',
  video_id text,
  summary text not null,
  summary_tl text,
  verses jsonb not null default '[]'::jsonb,   -- [{ref, text, translation}]
  questions jsonb not null default '[]'::jsonb, -- [string]
  pdf_path text,                                -- e.g. "/sermons/pdf/my-sermon.pdf"
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sermons drop constraint if exists sermons_slug_format;
alter table public.sermons
  add constraint sermons_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
```

`verses` and `questions` are stored as `jsonb` (matching the existing
`Verse[]`/`string[]` shape in `lib/sermons.ts`) instead of child tables,
since they are always read/written as a whole unit with the sermon and
never queried independently — a join table would add complexity with no
behavioral benefit here.

### 3.2 `events`

```sql
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  event_time text,           -- free-form display text, e.g. "9:00 AM"
  locality text,              -- reuses the existing Locality enum, nullable = "all locales"
  location text,               -- free-text venue detail
  link text,                    -- e.g. livestream or registration URL
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events drop constraint if exists events_locality_check;
alter table public.events
  add constraint events_locality_check
  check (locality is null or locality in ('medina', 'batangas', 'fort_mcmurray', 'other'));
```

`event_time` is stored as free text (not a SQL `time`) to keep the admin
form a single text input and match how the existing static worship
schedule already displays times ("9:00 AM", "9:00 AM and 3:00 PM") —
introducing a real `time` column would force extra formatting logic for
no benefit since these are always single, human-entered events.

### 3.3 RLS

Both tables get the same three-policy shape:

```sql
alter table public.sermons enable row level security;
alter table public.events  enable row level security;

create policy sermons_select_public on public.sermons for select to anon
  using (published = true);
create policy sermons_select_authenticated on public.sermons for select to authenticated
  using (published = true or public.is_staff());
create policy sermons_write on public.sermons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy events_select_public on public.events for select to anon
  using (published = true);
create policy events_select_authenticated on public.events for select to authenticated
  using (published = true or public.is_staff());
create policy events_write on public.events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
```

This is a new pattern for this codebase: every existing table is
`to authenticated` only (see `001_portal_schema.sql` policies), because
the public site currently has zero Supabase reads — the contact form
posts to Web3Forms, not Supabase. Granting `select ... to anon` scoped
to `published = true` is the standard, minimal-privilege Supabase
pattern for public read-only content and keeps enforcement at the
database layer (safe even if application code has a bug), rather than
relying on the service-role client and query filters alone.

### 3.4 Seed data

The migration seeds the 3 sermons currently hardcoded in
`lib/sermons.ts` (`walking-in-faith-not-by-sight`,
`the-power-of-prayer`, `living-a-life-of-gratitude`) with
`published = true`, using `insert ... on conflict (slug) do nothing` so
re-running the migration is safe.

### 3.5 Migration files

- `supabase/003_sermons_events.sql` — the migration above, run manually
  by the Presiding Minister in the Supabase SQL Editor, matching the
  existing workflow documented at the top of `001_portal_schema.sql`.
- `supabase/003_rollback.sql` — drops both tables and their policies,
  matching the `00N_rollback.sql` convention.

This repo has no automated migration runner; nobody in this session has
credentials to run SQL against the live database, so applying this
migration is a manual step the user performs before the code that reads
these tables is deployed (see §6 Rollout).

## 4. Application changes

### 4.1 `lib/sermons.ts`

Replace the hardcoded `sermons` array with Supabase-backed functions
that use the existing server client (`@/lib/supabase/server`), keeping
the same exported shape so `SermonList` and the detail page don't need
to change:

- `export type Sermon` — unchanged shape (camelCase fields), mapped from
  the DB's snake_case columns inside the fetch functions.
- `export async function getPublishedSermons(): Promise<Sermon[]>` —
  `select * from sermons where published = true order by sermon_date desc`.
- `export async function getSermon(slug: string): Promise<Sermon | undefined>` —
  `select * from sermons where published = true and slug = :slug`.
- `formatSermonDate` stays as-is (pure function, no DB access).

### 4.2 `app/sermons/page.tsx` and `app/sermons/[slug]/page.tsx`

- Both become `async` and `await` the new functions above.
- Remove `generateStaticParams` / `export const dynamicParams = false`
  from the detail page — those force full static generation at *build*
  time from whatever `lib/sermons.ts` returns then, which would mean a
  newly published sermon still doesn't appear until the next deploy,
  defeating the purpose of this change.
- Add `export const revalidate = 300` (5 minutes) to both pages instead,
  the same ISR pattern already used on `app/events/page.tsx`
  (`revalidate = 3600`) — new/edited sermons appear within minutes with
  no deploy, while still being cached instead of hitting the DB on every
  request.

### 4.3 New admin page: `app/portal/sermons/page.tsx`

One page, gated by `requireRoles(["admin", "secretary"])`, following the
exact list+form layout already used by `app/portal/announcements/page.tsx`:
left column lists all sermons (published and draft, with a Draft badge
and Publish/Unpublish + Delete buttons), right column has a create
form (title, title_tl, speaker, sermon_date, category, video_id,
summary, summary_tl, verses as repeatable ref/text/translation rows,
questions as one-per-line textarea, pdf_path, published checkbox).
Editing reuses the same form pre-filled, submitting to an update action
(matches how `app/portal/members/[id]/page.tsx` handles edit today).

### 4.4 New admin page: `app/portal/events/page.tsx`

Same shape as 4.3, gated the same way: list of events (draft badge,
publish/unpublish, delete) + create/edit form (title, description,
event_date, event_time, locality select, location, link, published
checkbox).

### 4.5 Server actions (`app/portal/actions.ts`)

New actions, following the existing `createAnnouncement` /
`toggleAnnouncement` / `deleteAnnouncement` pattern exactly (staff-gated
via `requireRoles(["admin","secretary"])`, `revalidatePath`, `back()` for
redirect-with-message):

- `createSermon`, `updateSermon`, `toggleSermon`, `deleteSermon`
- `createEvent`, `updateEvent`, `toggleEvent`, `deleteEvent`

### 4.6 Nav (`app/portal/layout.tsx`)

Add two staff-only nav items (inside the existing
`if (isStaff(profile.role)) { ... }` block, alongside `Attendance` and
`Members`):

```ts
items.push({ href: "/portal/sermons", label: "Sermons" });
items.push({ href: "/portal/events", label: "Events" });
```

### 4.7 `app/events/page.tsx`

- Remove the page's local duplicate `WORSHIP` constant (Medina-only,
  out of sync with the homepage) and import `WORSHIP`, `WORSHIP_BATANGAS`,
  `WORSHIP_ALBERTA` from `@/lib/worship` instead — the same source the
  homepage already uses. Note `lib/worship.ts` only stores human display
  strings ("9:00 AM"), not hour/minute numbers, so the existing
  `nextWorship()` exact-instant computation (which needs numeric
  hour/minute) can't run per-locale as-is. Since all three locales meet
  on Sunday, keep computing the single "next Sunday" date once (the
  existing day-of-week math, dropping the hour/minute-dependent part),
  and render one card per locale showing that shared date next to each
  locale's own display time string(s) and location from `lib/worship.ts`
  — no changes to `lib/worship.ts` needed.
- Add a new "Special Events" section below the worship cards: `await`
  `supabase.from("events").select(...).eq("published", true).gte("event_date", todayPH()).order("event_date")`,
  rendered as cards (title, date, time, locality/location, optional
  link button), with an `Empty`-style message when there are none
  upcoming.
- Keep `export const revalidate = 3600` (already present).

## 5. Testing / verification plan

- `npx tsc --noEmit` — confirm no new type errors (existing 3 unrelated
  errors in `auth-button.tsx` / `lib/supabase/server.ts` are pre-existing
  and out of scope).
- `npm run build` — confirm compilation succeeds (this environment has
  no `.env.local`, so full static export will still fail at the
  Supabase-client-construction step the same way it already does today
  on `/reset-password`; that's a pre-existing environment limitation,
  not a regression).
- Manual verification against the live Supabase project happens after
  the user runs the migration and deploys (see §6) — the user checks:
  - `/portal/sermons` and `/portal/events` as admin: create a draft,
    publish it, edit it, delete it.
  - `/sermons` and `/events` as a signed-out visitor: published items
    appear, drafts don't.
  - Existing 3 sermons still show correctly after migration (seed data
    check).

## 6. Rollout order

1. User reviews and runs `supabase/003_sermons_events.sql` in the
   Supabase SQL Editor (production project).
2. User confirms the 3 seeded sermons and the `sermons`/`events` tables
   look correct in the Supabase Table Editor.
3. Code changes are committed locally (per standing instruction: no
   push without explicit permission).
4. User reviews and approves the push to `main`; push triggers the
   existing Vercel auto-deploy.
5. User spot-checks `/sermons`, `/events`, `/portal/sermons`,
   `/portal/events` on the live site.

If step 1 hasn't happened yet when the code deploys, the public
`/sermons` and `/events` pages would query tables that don't exist yet
and error — so the SQL migration must be applied *before* the code
that depends on it goes live.
