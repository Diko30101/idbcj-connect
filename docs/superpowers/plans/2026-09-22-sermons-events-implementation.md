# Database-backed Sermon Library and Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/Secretary add sermons and one-off special events from the portal, with changes appearing on the public site within minutes — no code deploy required.

**Architecture:** Two new Supabase tables (`sermons`, `events`) with RLS scoped to `published = true` for anonymous/public reads and `is_staff()` for writes. `lib/sermons.ts` moves from a hardcoded array to Supabase-backed async functions behind the same `Sermon` type, so the public sermon pages barely change. New staff-only CRUD pages under `/portal/sermons` and `/portal/events` follow the existing list-page-plus-`[id]`-detail-page pattern already used by `/portal/ministries`. The public `/events` page keeps the recurring weekly worship schedule hardcoded (per user decision) but fixes it to show all 3 locales, and adds a new "Special Events" section fed by the `events` table.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Supabase (Postgres + `@supabase/ssr`), Tailwind CSS. No test framework is installed in this repo.

**Spec:** `docs/superpowers/specs/2026-09-22-sermons-events-design.md`

## Global Constraints

- No automated test framework exists in this repo (no jest/vitest/playwright, no `test` script in `package.json`). Every task's verification step is `npx tsc --noEmit` (no *new* type errors — this repo has 3 pre-existing, unrelated errors in `components/auth-button.tsx` and `lib/supabase/server.ts` that are out of scope) plus `npm run build` reaching `✓ Compiled successfully` (the build's later static-export failure on `/reset-password` is a pre-existing environment limitation — no `.env.local` with Supabase credentials in this dev environment — not a regression to chase).
- Nobody in this session has credentials to run SQL against the live Supabase project. The migration SQL is written and committed to the repo, but **actually applying it is a manual step the user performs in the Supabase SQL Editor**, and it must happen before the code that depends on the new tables is deployed.
- Never `git push` without the user's explicit go-ahead in that turn, especially to `main` (auto-deploys to the live site via Vercel). Every task below ends with a **local commit only**.
- Follow existing file conventions exactly: shared UI atoms from `@/components/portal/ui` (`Panel`, `Field`, `Empty`, `Notice`, `PageHeader`, `btnCls`, `btnGhostCls`, `btnDangerCls`, `inputCls`), shared helpers from `@/lib/portal` (`str`, `strOrNull`, `back`, `requireRoles`, `fmtDate`, `LOCALITIES`, `LOCALITY_LABEL`, `getSupabase`, `todayPH`) and `next/cache`'s `revalidatePath`. Reuse the list-page-with-inline-create-form + `[id]`-detail-page-with-inline-edit-form shape already used by `/portal/ministries` and `/portal/announcements` — do not invent a new admin UI pattern or add new client components/state where a plain server-rendered form already does the job (see `app/portal/announcements/page.tsx`, `app/portal/ministries/page.tsx`, `app/portal/ministries/[id]/page.tsx`).
- Portal (admin) UI copy is Tagalog-first, matching every existing portal page. Public pages stay bilingual English/Tagalog matching `/sermons` and `/events` today.
- Only `admin` and `secretary` may write to `sermons` and `events` — gate every write action with `requireRoles(["admin", "secretary"])`, matching the user's explicit decision in the spec.
- Windows/PowerShell dev environment (see repo's `AGENTS`/tool conventions) — use the `Bash`/`PowerShell` tool as already used in this session; commands below are written for either.

---

### Task 1: Database migration (sermons + events tables, RLS, seed data)

**Files:**
- Create: `supabase/003_sermons_events.sql`
- Create: `supabase/003_rollback.sql`

**Interfaces:**
- Produces: table `public.sermons` (columns: `id, slug, title, title_tl, speaker, sermon_date, category, video_id, summary, summary_tl, verses jsonb, questions jsonb, pdf_path, published, created_by, created_at, updated_at`) and table `public.events` (columns: `id, title, description, event_date, event_time, locality, location, link, published, created_by, created_at, updated_at`). Both tables are consumed by every later task in this plan via Supabase queries against these exact column names.

- [ ] **Step 1: Write the migration file**

Create `supabase/003_sermons_events.sql`:

```sql
-- =====================================================================
-- IDBCJ MEMBER PORTAL - 003: Sermon library at Events (DB-driven, para
-- makapag-add ang Admin/Secretary nang walang code deploy)
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 003_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SERMONS
-- ---------------------------------------------------------------------
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
  verses jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  pdf_path text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sermons drop constraint if exists sermons_slug_format;
alter table public.sermons
  add constraint sermons_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Seed: ang 3 sermon na dating nasa lib/sermons.ts (hindi na dapat mawala)
insert into public.sermons (slug, title, speaker, sermon_date, category, video_id, summary, published)
values
  (
    'walking-in-faith-not-by-sight',
    'Walking in Faith, Not by Sight',
    'Elder Bro. Rod S. Villaverde',
    '2025-12-09',
    'Faith Series',
    'oEBwRr2aILc',
    'Discover what it means to truly trust God when the path ahead is unclear. We explore 2 Corinthians 5:7 and learn how to navigate life''s challenges through spiritual vision.',
    true
  ),
  (
    'the-power-of-prayer',
    'The Power of Prayer',
    'Bro. Abon Mangubat',
    '2023-02-12',
    'Prayer Works',
    '0ustuDLHTjI',
    'Prayer is not just asking for things; it is a conversation with the Creator. Learn how to deepen your prayer life and see real change.',
    true
  ),
  (
    'living-a-life-of-gratitude',
    'Living a Life of Gratitude',
    'Bro. Abon Mangubat',
    '2025-12-01',
    'Thanksgiving',
    'c5aaOqqp5tc',
    'Gratitude changes our attitude. In this message, we look at how being thankful in all circumstances can transform your mental and spiritual health.',
    true
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 2. EVENTS (special events lang; ang regular weekly worship schedule
--    ay hardcoded pa rin sa lib/worship.ts)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  event_time text,
  locality text,
  location text,
  link text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events drop constraint if exists events_locality_check;
alter table public.events
  add constraint events_locality_check
  check (locality is null or locality in ('medina', 'batangas', 'fort_mcmurray', 'other'));

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sermons', 'events')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.sermons enable row level security;
alter table public.events  enable row level security;

-- sermons: publiko ay makakabasa lang ng published; admin/secretary lang ang makaka-edit
create policy sermons_select_public on public.sermons for select to anon
  using (published = true);
create policy sermons_select_authenticated on public.sermons for select to authenticated
  using (published = true or public.is_staff());
create policy sermons_write on public.sermons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- events: parehong patakaran
create policy events_select_public on public.events for select to anon
  using (published = true);
create policy events_select_authenticated on public.events for select to authenticated
  using (published = true or public.is_staff());
create policy events_write on public.events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

commit;
```

- [ ] **Step 2: Write the rollback file**

Create `supabase/003_rollback.sql`:

```sql
-- ROLLBACK ng 003_sermons_events.sql
-- Binubura nito ang sermons at events table (kasama ang lahat ng naka-tala
-- na sermon at event, pati ang kanilang RLS policies).
begin;
drop table if exists public.sermons, public.events cascade;
commit;
```

- [ ] **Step 3: Self-review the SQL (no live database access in this session)**

Read both files back and confirm:
- Every statement is idempotent (`create table if not exists`, `drop constraint if exists` before `add constraint`, the `do $$ ... drop policy ... end $$` loop before `create policy`, `on conflict (slug) do nothing` on the seed insert) — matches the pattern in `supabase/001_portal_schema.sql` lines 345-360.
- Both migration and rollback are wrapped in `begin; ... commit;`.
- Column names here (`sermon_date`, `title_tl`, `video_id`, `pdf_path`, `event_date`, `event_time`, `locality`, `location`, `link`) exactly match what Tasks 2-8 will query — cross-check against this task's "Produces" list above before moving on.
- Do **not** attempt to run this against Supabase from this session — no credentials are configured here. This is a manual step for the user (see rollout note at the end of this plan).

- [ ] **Step 4: Commit**

```bash
git add supabase/003_sermons_events.sql supabase/003_rollback.sql
git commit -m "Add sermons and events tables with RLS (migration, not yet applied)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/sermons.ts` — Supabase-backed data access

**Files:**
- Modify: `lib/sermons.ts` (full rewrite)

**Interfaces:**
- Consumes: table `public.sermons` from Task 1 (columns: `slug, title, title_tl, speaker, sermon_date, category, video_id, summary, summary_tl, verses, questions, pdf_path, published`); `getSupabase()` from `@/lib/portal` (returns `Promise<SupabaseClient>`, already used throughout the portal).
- Produces: `export type Verse = { ref: string; text?: string; translation?: string }`, `export type Sermon = { slug, title, titleTl?, speaker, date, category, videoId?, summary, summaryTl?, verses?: Verse[], questions?: string[], pdf?, published }` (unchanged shape from before this task — consumed by `components/sermon-list.tsx`, `components/sermon-player.tsx` usage sites, and Task 3), `export async function getPublishedSermons(): Promise<Sermon[]>`, `export async function getSermon(slug: string): Promise<Sermon | undefined>`, `export function formatSermonDate(iso: string): string` (unchanged, pure).

- [ ] **Step 1: Replace the file contents**

Replace all of `lib/sermons.ts` with:

```ts
import { getSupabase } from "@/lib/portal";

// ============================================================
// SERMON LIBRARY DATA
// Ang mga sermon ay pinamamahalaan sa /portal/sermons (Admin/Secretary
// lang). Dito lang nakatira ang Sermon type at ang mga helper na
// ginagamit ng publikong /sermons pages.
// ============================================================

export type Verse = {
  ref: string; // hal. "2 Corinthians 5:7"
  text?: string; // aktwal na teksto ng verse (optional)
  translation?: string; // hal. "KJV"
};

export type Sermon = {
  slug: string; // para sa link: /sermons/<slug>
  title: string;
  titleTl?: string;
  speaker: string;
  date: string; // YYYY-MM-DD
  category: string;
  videoId?: string; // YouTube video ID
  summary: string;
  summaryTl?: string;
  verses?: Verse[];
  questions?: string[];
  pdf?: string; // hal. "/sermons/pdf/walking-in-faith.pdf"
  published: boolean;
};

type SermonRow = {
  slug: string;
  title: string;
  title_tl: string | null;
  speaker: string;
  sermon_date: string;
  category: string;
  video_id: string | null;
  summary: string;
  summary_tl: string | null;
  verses: Verse[] | null;
  questions: string[] | null;
  pdf_path: string | null;
  published: boolean;
};

const SERMON_COLUMNS =
  "slug, title, title_tl, speaker, sermon_date, category, video_id, summary, summary_tl, verses, questions, pdf_path, published";

function rowToSermon(row: SermonRow): Sermon {
  return {
    slug: row.slug,
    title: row.title,
    titleTl: row.title_tl ?? undefined,
    speaker: row.speaker,
    date: row.sermon_date,
    category: row.category,
    videoId: row.video_id ?? undefined,
    summary: row.summary,
    summaryTl: row.summary_tl ?? undefined,
    verses: row.verses ?? [],
    questions: row.questions ?? [],
    pdf: row.pdf_path ?? undefined,
    published: row.published,
  };
}

export async function getPublishedSermons(): Promise<Sermon[]> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("sermons")
    .select(SERMON_COLUMNS)
    .eq("published", true)
    .order("sermon_date", { ascending: false });
  return ((data ?? []) as SermonRow[]).map(rowToSermon);
}

export async function getSermon(slug: string): Promise<Sermon | undefined> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("sermons")
    .select(SERMON_COLUMNS)
    .eq("published", true)
    .eq("slug", slug)
    .maybeSingle();
  return data ? rowToSermon(data as SermonRow) : undefined;
}

export function formatSermonDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: the only errors are the 3 pre-existing ones in `components/auth-button.tsx` and `lib/supabase/server.ts` (from before this plan started). If `lib/sermons.ts`, `components/sermon-list.tsx`, or `app/sermons/**` appear in the output, stop and fix — Task 3 hasn't run yet, so `app/sermons/page.tsx` and `app/sermons/[slug]/page.tsx` will show errors until Task 3 is done; that's expected at this point and gets resolved there, not here.

- [ ] **Step 3: Commit**

```bash
git add lib/sermons.ts
git commit -m "Move sermon library to Supabase-backed data access

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Public sermon pages read from Supabase

**Files:**
- Modify: `app/sermons/page.tsx`
- Modify: `app/sermons/[slug]/page.tsx`
- Create: `lib/sermon-format.ts` (discovered during this task's build verification — see note below)
- Modify: `lib/sermons.ts` (re-export `formatSermonDate` from the new file instead of defining it locally)
- Modify: `components/sermon-list.tsx` (import `formatSermonDate` from the new file instead of `@/lib/sermons`)

**Interfaces:**
- Consumes: `getPublishedSermons()`, `getSermon(slug)` from Task 2 (both now `Promise`-returning).
- Produces: `formatSermonDate` moves to its own client-safe module — nothing new consumed elsewhere in this plan — this is the last stop for the sermon read path.

**Build-time discovery:** After Task 2 made `lib/sermons.ts` import `getSupabase` (which pulls in `next/headers`), `npm run build` failed at the *compile* step (not just the pre-existing `/reset-password` static-export failure) with "You're importing a component that needs next/headers... not supported in the pages/ directory" — traced to `components/sermon-list.tsx` (a `"use client"` component) doing a *value* import of `formatSermonDate` from `@/lib/sermons`. Even though `formatSermonDate` itself is a pure function, importing any value from a module pulls the whole module — including its now-server-only top-level import — into the client bundle graph. `import type { Sermon } from "@/lib/sermons"` in the same file is fine (type-only imports are erased at compile time and never reach the bundle). Fix: extract the pure `formatSermonDate` into its own zero-dependency file (`lib/sermon-format.ts`), have `lib/sermons.ts` re-export it (`export { formatSermonDate } from "@/lib/sermon-format";`) so server-side consumers like `app/sermons/[slug]/page.tsx` don't need an import path change, and point `components/sermon-list.tsx`'s value import directly at `@/lib/sermon-format` instead.

- [ ] **Step 1: Update `app/sermons/page.tsx`**

Change the default export to `async` and `await` the data call; add ISR revalidation so a newly published sermon appears without a redeploy:

```tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SermonList } from "@/components/sermon-list";
import { getPublishedSermons } from "@/lib/sermons";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sermon Library | IDBCJ",
  description: "Watch and study sermons with summaries, Bible verses, and review questions.",
};

export default async function SermonsPage() {
  const sermons = await getPublishedSermons();

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* --- HERO --- */}
      <section className="relative w-full py-12 px-4 md:px-12">
        <div className="absolute inset-0">
          <Image
            src="/background.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover brightness-25"
            priority
          />
          <div className="absolute inset-0 bg-emerald-900/80 mix-blend-multiply" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-white">
          <h1 className="text-4xl md:text-5xl font-extrabold">Sermon Library</h1>
          <p className="mt-3 text-lg text-emerald-50 max-w-2xl">
            Watch, study, and review. Each message has a summary, Bible verses, and review questions.
          </p>
          <p className="mt-1 text-sm text-emerald-100 italic max-w-2xl">
            Manood, mag-aral, at magbalik-aral. May buod, mga talata, at mga tanong ang bawat mensahe.
          </p>
        </div>
      </section>

      {/* --- LIST --- */}
      <section className="max-w-7xl mx-auto py-12 px-6">
        <SermonList sermons={sermons} />
      </section>
    </div>
  );
}
```

(`Link` stays imported even though unused directly here — check with the next step; if `tsc`/`eslint` flags it as unused, remove it. It was unused in the original file too, so no behavior change either way.)

- [ ] **Step 1b: Create `lib/sermon-format.ts` and repoint the client-side import**

Create `lib/sermon-format.ts`:

```ts
// Client-safe: walang server-only import (kaya puwedeng gamitin ng
// components/sermon-list.tsx, isang client component). Ang lib/sermons.ts
// ay may server-only Supabase access, kaya hiwalay ito dito.
export function formatSermonDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

In `lib/sermons.ts`, remove the local `formatSermonDate` function body and add a re-export right after the `getSupabase` import instead:

```ts
import { getSupabase } from "@/lib/portal";
export { formatSermonDate } from "@/lib/sermon-format";
```

In `components/sermon-list.tsx`, change:

```ts
import type { Sermon } from "@/lib/sermons";
import { formatSermonDate } from "@/lib/sermons";
```

to:

```ts
import type { Sermon } from "@/lib/sermons";
import { formatSermonDate } from "@/lib/sermon-format";
```

- [ ] **Step 2: Update `app/sermons/[slug]/page.tsx`**

Remove the build-time static generation (it would freeze the sermon list at whatever existed at the last deploy, defeating the point of this change) and switch to `await`-ing the async data functions:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, User, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SermonPlayer } from "@/components/sermon-player";
import { getSermon, formatSermonDate } from "@/lib/sermons";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sermon = await getSermon(slug);
  if (!sermon) return {};
  return {
    title: `${sermon.title} | IDBCJ Sermons`,
    description: sermon.summary.slice(0, 160),
  };
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sermon = await getSermon(slug);
  if (!sermon) notFound();

  const verses = sermon.verses ?? [];
  const questions = sermon.questions ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/sermons">
          <Button variant="ghost" className="text-gray-600 hover:text-gray-900 pl-0 hover:bg-transparent">
            ← Sermon Library
          </Button>
        </Link>

        {/* Title */}
        <header className="mt-4 space-y-3">
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wider rounded-full uppercase">
            {sermon.category}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{sermon.title}</h1>
          {sermon.titleTl && <p className="text-lg text-gray-500 italic">{sermon.titleTl}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <User size={16} /> {sermon.speaker}
            </span>
            <span className="flex items-center gap-2">
              <Calendar size={16} /> {formatSermonDate(sermon.date)}
            </span>
          </div>
        </header>

        {/* Video */}
        {sermon.videoId && (
          <div className="mt-6">
            <SermonPlayer videoId={sermon.videoId} title={sermon.title} />
          </div>
        )}

        {/* Summary */}
        <section className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Summary / Buod</h2>
          <p className="text-gray-700 leading-relaxed">{sermon.summary}</p>
          {sermon.summaryTl && (
            <p className="text-gray-600 leading-relaxed italic border-t border-gray-100 pt-3">{sermon.summaryTl}</p>
          )}
        </section>

        {/* Verses */}
        {verses.length > 0 && (
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Bible Verses / Mga Talata</h2>
            <ul className="space-y-4">
              {verses.map((v) => (
                <li key={v.ref} className="border-l-4 border-emerald-500 pl-4">
                  <p className="font-semibold text-gray-900">
                    {v.ref}
                    {v.translation && <span className="ml-2 text-xs font-normal text-gray-500">({v.translation})</span>}
                  </p>
                  {v.text && <p className="text-gray-700 mt-1 leading-relaxed">&ldquo;{v.text}&rdquo;</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Review questions */}
        {questions.length > 0 && (
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">Review Questions / Mga Tanong</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-700 leading-relaxed">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </section>
        )}

        {/* PDF */}
        {sermon.pdf && (
          <div className="mt-8">
            <a href={sermon.pdf} download>
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Download className="mr-2 h-4 w-4" />
                Download PDF / I-download ang PDF
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully` (the later static-export failure on `/reset-password` due to missing `.env.local` is pre-existing and unrelated — confirm no *new* page name appears in that error).

- [ ] **Step 4: Commit**

```bash
git add app/sermons/page.tsx "app/sermons/[slug]/page.tsx"
git commit -m "Read public sermon pages from Supabase instead of build-time data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Sermon server actions

**Files:**
- Modify: `app/portal/actions.ts` (append new section)

**Interfaces:**
- Consumes: `str`, `strOrNull`, `back`, `requireRoles`, `revalidatePath`, `redirect` — all already imported at the top of `app/portal/actions.ts`. Table `public.sermons` from Task 1.
- Produces: `export async function createSermon(fd: FormData)`, `export async function updateSermon(fd: FormData)`, `export async function toggleSermon(fd: FormData)`, `export async function deleteSermon(fd: FormData)` — consumed by Task 5's forms. Also two local (non-exported) helpers `parseVerses(fd)` and `parseQuestions(fd)` used only within this file.

- [ ] **Step 1: Append the sermon actions**

Add this new section at the end of `app/portal/actions.ts` (after the last existing export):

```ts
// ---------------------------------------------------------------
// SERMONS (Admin/Secretary lang) — Sermon Library sa publikong /sermons
// ---------------------------------------------------------------
function parseVerses(fd: FormData): { ref: string; text?: string; translation?: string }[] {
  const refs = fd.getAll("verse_ref").map(String);
  const texts = fd.getAll("verse_text").map(String);
  const translations = fd.getAll("verse_translation").map(String);
  const verses: { ref: string; text?: string; translation?: string }[] = [];
  refs.forEach((ref, i) => {
    if (!ref.trim()) return;
    verses.push({
      ref: ref.trim(),
      text: texts[i]?.trim() || undefined,
      translation: translations[i]?.trim() || undefined,
    });
  });
  return verses;
}

function parseQuestions(fd: FormData): string[] {
  return str(fd, "questions")
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);
}

export async function createSermon(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const slug = str(fd, "slug");
  const title = str(fd, "title");
  const speaker = str(fd, "speaker");
  const sermonDate = str(fd, "sermon_date");
  if (!slug || !title || !speaker || !sermonDate) back("/portal/sermons", "error", "Kumpletuhin ang slug, pamagat, speaker, at petsa.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) back("/portal/sermons", "error", "Ang slug ay maliliit na letra at numero lang, gitling ang pantugma (hal. walking-in-faith).");
  const { data, error } = await supabase
    .from("sermons")
    .insert({
      slug,
      title,
      title_tl: strOrNull(fd, "title_tl"),
      speaker,
      sermon_date: sermonDate,
      category: str(fd, "category") || "General",
      video_id: strOrNull(fd, "video_id"),
      summary: str(fd, "summary"),
      summary_tl: strOrNull(fd, "summary_tl"),
      verses: parseVerses(fd),
      questions: parseQuestions(fd),
      pdf_path: strOrNull(fd, "pdf_path"),
      published: str(fd, "published") === "on",
    })
    .select("id")
    .single();
  if (error) {
    back(
      "/portal/sermons",
      "error",
      error.code === "23505" ? "May sermon na gumagamit na ng slug na iyon." : "Hindi nagawa: " + error.message,
    );
  }
  revalidatePath("/portal/sermons");
  revalidatePath("/sermons");
  redirect(`/portal/sermons/${data!.id}`);
}

export async function updateSermon(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const path = `/portal/sermons/${id}`;
  const slug = str(fd, "slug");
  const title = str(fd, "title");
  const speaker = str(fd, "speaker");
  const sermonDate = str(fd, "sermon_date");
  if (!slug || !title || !speaker || !sermonDate) back(path, "error", "Kumpletuhin ang slug, pamagat, speaker, at petsa.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) back(path, "error", "Ang slug ay maliliit na letra at numero lang, gitling ang pantugma.");
  const { error } = await supabase
    .from("sermons")
    .update({
      slug,
      title,
      title_tl: strOrNull(fd, "title_tl"),
      speaker,
      sermon_date: sermonDate,
      category: str(fd, "category") || "General",
      video_id: strOrNull(fd, "video_id"),
      summary: str(fd, "summary"),
      summary_tl: strOrNull(fd, "summary_tl"),
      verses: parseVerses(fd),
      questions: parseQuestions(fd),
      pdf_path: strOrNull(fd, "pdf_path"),
      published: str(fd, "published") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    back(
      path,
      "error",
      error.code === "23505" ? "May sermon na gumagamit na ng slug na iyon." : "Hindi na-save: " + error.message,
    );
  }
  revalidatePath("/portal/sermons", "layout");
  revalidatePath("/sermons");
  back(path, "ok", "Na-update ang sermon.");
}

export async function toggleSermon(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase
    .from("sermons")
    .update({ published: str(fd, "publish") === "true" })
    .eq("id", id);
  if (error) back(`/portal/sermons/${id}`, "error", "Hindi na-update: " + error.message);
  revalidatePath("/portal/sermons", "layout");
  revalidatePath("/sermons");
  back(`/portal/sermons/${id}`, "ok", "Na-update ang sermon.");
}

export async function deleteSermon(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase.from("sermons").delete().eq("id", id);
  if (error) back(`/portal/sermons/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/sermons", "layout");
  revalidatePath("/sermons");
  redirect("/portal/sermons?ok=" + encodeURIComponent("Nabura ang sermon."));
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors (Tasks 5's pages don't exist yet, so nothing new references these actions yet — this step just confirms the actions file itself compiles).

- [ ] **Step 3: Commit**

```bash
git add app/portal/actions.ts
git commit -m "Add server actions for managing sermons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sermon admin pages + nav

**Files:**
- Create: `app/portal/sermons/page.tsx`
- Create: `app/portal/sermons/[id]/page.tsx`
- Modify: `app/portal/layout.tsx`

**Interfaces:**
- Consumes: `createSermon`, `updateSermon`, `toggleSermon`, `deleteSermon` from Task 4; `requireRoles`, `fmtDate` from `@/lib/portal`; `Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls` from `@/components/portal/ui`. Table `public.sermons` from Task 1.
- Produces: routes `/portal/sermons` and `/portal/sermons/[id]`, and a `{ href: "/portal/sermons", label: "Sermons" }` staff-only nav entry — nothing later in this plan depends on these directly.

- [ ] **Step 1: Create the list + create-form page**

Create `app/portal/sermons/page.tsx`:

```tsx
import Link from "next/link";
import { requireRoles, fmtDate } from "@/lib/portal";
import { createSermon } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function SermonsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data } = await supabase
    .from("sermons")
    .select("id, title, speaker, sermon_date, published")
    .order("sermon_date", { ascending: false })
    .limit(200);
  const list = (data ?? []) as { id: string; title: string; speaker: string; sermon_date: string; published: boolean }[];

  return (
    <>
      <PageHeader title="Sermons" subtitle="Pamahalaan ang Sermon Library na makikita sa publikong website." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel>
            {list.length === 0 ? (
              <Empty>Wala pang sermon.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((s) => (
                  <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/portal/sermons/${s.id}`} className="flex items-start justify-between gap-2 hover:underline">
                      <div>
                        <h3 className="font-semibold text-gray-900">{s.title}</h3>
                        <p className="text-xs text-gray-500">
                          {s.speaker} · {fmtDate(s.sermon_date)}
                        </p>
                      </div>
                      {!s.published && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Draft</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Magdagdag ng sermon">
          <form action={createSermon} className="grid gap-4">
            <Field label="Slug" hint="Maliliit na letra at gitling lang, hal. walking-in-faith">
              <input name="slug" required pattern="^[a-z0-9]+(-[a-z0-9]+)*$" className={inputCls} />
            </Field>
            <Field label="Pamagat (English)">
              <input name="title" required className={inputCls} />
            </Field>
            <Field label="Pamagat (Tagalog, opsyonal)">
              <input name="title_tl" className={inputCls} />
            </Field>
            <Field label="Speaker">
              <input name="speaker" required className={inputCls} />
            </Field>
            <Field label="Petsa">
              <input type="date" name="sermon_date" required className={inputCls} />
            </Field>
            <Field label="Kategorya">
              <input name="category" defaultValue="General" className={inputCls} />
            </Field>
            <Field label="YouTube Video ID (opsyonal)" hint="Ang bahagi pagkatapos ng v= sa YouTube URL">
              <input name="video_id" className={inputCls} />
            </Field>
            <Field label="Buod (English)">
              <textarea name="summary" required rows={3} className={inputCls} />
            </Field>
            <Field label="Buod (Tagalog, opsyonal)">
              <textarea name="summary_tl" rows={3} className={inputCls} />
            </Field>
            <Field label="Mga Talata sa Biblia (opsyonal, hanggang 3)">
              <div className="grid gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input name="verse_ref" placeholder="Ref (hal. John 3:16)" className={inputCls} />
                    <input name="verse_text" placeholder="Teksto (opsyonal)" className={inputCls} />
                    <input name="verse_translation" placeholder="Bersyon (hal. KJV)" className={inputCls} />
                  </div>
                ))}
              </div>
            </Field>
            <Field label="Mga tanong pang-review (opsyonal)" hint="Isang tanong bawat linya">
              <textarea name="questions" rows={3} className={inputCls} />
            </Field>
            <Field label="PDF path (opsyonal)" hint='Ilagay muna ang file sa public/sermons/pdf/, hal. "/sermons/pdf/walking-in-faith.pdf"'>
              <input name="pdf_path" className={inputCls} />
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

- [ ] **Step 2: Create the edit page**

Create `app/portal/sermons/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate } from "@/lib/portal";
import { updateSermon, toggleSermon, deleteSermon } from "../../actions";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

type Verse = { ref: string; text?: string; translation?: string };

export default async function SermonEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: sermon } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();
  if (!sermon) notFound();

  const verses = ((sermon.verses ?? []) as Verse[]).concat([{ ref: "" }, { ref: "" }, { ref: "" }]).slice(0, 3);
  const questions = ((sermon.questions ?? []) as string[]).join("\n");

  return (
    <>
      <PageHeader
        title={sermon.title}
        subtitle={`Huling na-update: ${fmtDate(sermon.updated_at)}`}
        action={
          <Link href="/portal/sermons" className={btnGhostCls}>
            ← Sermons
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="I-edit ang sermon">
            <form action={updateSermon} className="grid gap-4">
              <input type="hidden" name="id" value={sermon.id} />
              <Field label="Slug" hint="Maliliit na letra at gitling lang, hal. walking-in-faith">
                <input name="slug" defaultValue={sermon.slug} required pattern="^[a-z0-9]+(-[a-z0-9]+)*$" className={inputCls} />
              </Field>
              <Field label="Pamagat (English)">
                <input name="title" defaultValue={sermon.title} required className={inputCls} />
              </Field>
              <Field label="Pamagat (Tagalog, opsyonal)">
                <input name="title_tl" defaultValue={sermon.title_tl ?? ""} className={inputCls} />
              </Field>
              <Field label="Speaker">
                <input name="speaker" defaultValue={sermon.speaker} required className={inputCls} />
              </Field>
              <Field label="Petsa">
                <input type="date" name="sermon_date" defaultValue={sermon.sermon_date} required className={inputCls} />
              </Field>
              <Field label="Kategorya">
                <input name="category" defaultValue={sermon.category} className={inputCls} />
              </Field>
              <Field label="YouTube Video ID (opsyonal)">
                <input name="video_id" defaultValue={sermon.video_id ?? ""} className={inputCls} />
              </Field>
              <Field label="Buod (English)">
                <textarea name="summary" defaultValue={sermon.summary} required rows={3} className={inputCls} />
              </Field>
              <Field label="Buod (Tagalog, opsyonal)">
                <textarea name="summary_tl" defaultValue={sermon.summary_tl ?? ""} rows={3} className={inputCls} />
              </Field>
              <Field label="Mga Talata sa Biblia (opsyonal, hanggang 3)">
                <div className="grid gap-2">
                  {verses.map((v, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <input name="verse_ref" defaultValue={v.ref ?? ""} placeholder="Ref (hal. John 3:16)" className={inputCls} />
                      <input name="verse_text" defaultValue={v.text ?? ""} placeholder="Teksto (opsyonal)" className={inputCls} />
                      <input name="verse_translation" defaultValue={v.translation ?? ""} placeholder="Bersyon (hal. KJV)" className={inputCls} />
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Mga tanong pang-review (opsyonal)" hint="Isang tanong bawat linya">
                <textarea name="questions" defaultValue={questions} rows={3} className={inputCls} />
              </Field>
              <Field label="PDF path (opsyonal)">
                <input name="pdf_path" defaultValue={sermon.pdf_path ?? ""} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" defaultChecked={sermon.published} className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Katayuan">
            <p className="mb-3 text-sm text-gray-600">
              {sermon.published ? "Nakikita na ito ng publiko sa /sermons." : "Draft pa lang — hindi ito makikita sa /sermons."}
            </p>
            <form action={toggleSermon}>
              <input type="hidden" name="id" value={sermon.id} />
              <input type="hidden" name="publish" value={sermon.published ? "false" : "true"} />
              <button className={btnGhostCls}>{sermon.published ? "Gawing draft" : "I-publish"}</button>
            </form>
          </Panel>

          <Panel title="Burahin">
            <form action={deleteSermon}>
              <input type="hidden" name="id" value={sermon.id} />
              <button className={btnDangerCls}>Burahin ang sermon</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add the staff-only nav item**

In `app/portal/layout.tsx`, find this block:

```ts
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/attendance", label: "Attendance" });
    items.push({ href: "/portal/members", label: "Members" });
  }
```

Change it to:

```ts
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/attendance", label: "Attendance" });
    items.push({ href: "/portal/members", label: "Members" });
    items.push({ href: "/portal/sermons", label: "Sermons" });
  }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/portal/sermons app/portal/layout.tsx
git commit -m "Add sermon admin pages under /portal/sermons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Event server actions

**Files:**
- Modify: `app/portal/actions.ts` (append new section)

**Interfaces:**
- Consumes: `str`, `strOrNull`, `back`, `requireRoles`, `revalidatePath`, `redirect`, `LOCALITIES`, `type Locality` — all already imported at the top of `app/portal/actions.ts` (confirm `LOCALITIES`/`Locality` are already imported; if not, add `import { LOCALITIES, type Locality } from "@/lib/locality";` — this import already exists as of this plan's writing). Table `public.events` from Task 1.
- Produces: `export async function createEvent(fd: FormData)`, `export async function updateEvent(fd: FormData)`, `export async function toggleEvent(fd: FormData)`, `export async function deleteEvent(fd: FormData)` — consumed by Task 7's forms and, indirectly, by Task 8 (which only *reads* the `events` table, not these actions).

- [ ] **Step 1: Append the event actions**

Add this new section at the end of `app/portal/actions.ts` (after the sermon actions from Task 4):

```ts
// ---------------------------------------------------------------
// EVENTS (Admin/Secretary lang) — special events sa publikong /events
// ---------------------------------------------------------------
export async function createEvent(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const title = str(fd, "title");
  const eventDate = str(fd, "event_date");
  if (!title || !eventDate) back("/portal/events", "error", "Kumpletuhin ang pamagat at petsa.");
  const locality = strOrNull(fd, "locality");
  if (locality && !LOCALITIES.includes(locality as Locality)) back("/portal/events", "error", "Di-wastong lokal.");
  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      description: strOrNull(fd, "description"),
      event_date: eventDate,
      event_time: strOrNull(fd, "event_time"),
      locality,
      location: strOrNull(fd, "location"),
      link: strOrNull(fd, "link"),
      published: str(fd, "published") === "on",
    })
    .select("id")
    .single();
  if (error) back("/portal/events", "error", "Hindi nagawa: " + error.message);
  revalidatePath("/portal/events");
  revalidatePath("/events");
  redirect(`/portal/events/${data!.id}`);
}

export async function updateEvent(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const path = `/portal/events/${id}`;
  const title = str(fd, "title");
  const eventDate = str(fd, "event_date");
  if (!title || !eventDate) back(path, "error", "Kumpletuhin ang pamagat at petsa.");
  const locality = strOrNull(fd, "locality");
  if (locality && !LOCALITIES.includes(locality as Locality)) back(path, "error", "Di-wastong lokal.");
  const { error } = await supabase
    .from("events")
    .update({
      title,
      description: strOrNull(fd, "description"),
      event_date: eventDate,
      event_time: strOrNull(fd, "event_time"),
      locality,
      location: strOrNull(fd, "location"),
      link: strOrNull(fd, "link"),
      published: str(fd, "published") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) back(path, "error", "Hindi na-save: " + error.message);
  revalidatePath("/portal/events", "layout");
  revalidatePath("/events");
  back(path, "ok", "Na-update ang event.");
}

export async function toggleEvent(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase
    .from("events")
    .update({ published: str(fd, "publish") === "true" })
    .eq("id", id);
  if (error) back(`/portal/events/${id}`, "error", "Hindi na-update: " + error.message);
  revalidatePath("/portal/events", "layout");
  revalidatePath("/events");
  back(`/portal/events/${id}`, "ok", "Na-update ang event.");
}

export async function deleteEvent(fd: FormData) {
  const { supabase } = await requireRoles(["admin", "secretary"]);
  const id = str(fd, "id");
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) back(`/portal/events/${id}`, "error", "Hindi nabura: " + error.message);
  revalidatePath("/portal/events", "layout");
  revalidatePath("/events");
  redirect("/portal/events?ok=" + encodeURIComponent("Nabura ang event."));
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add app/portal/actions.ts
git commit -m "Add server actions for managing special events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Event admin pages + nav

**Files:**
- Create: `app/portal/events/page.tsx`
- Create: `app/portal/events/[id]/page.tsx`
- Modify: `app/portal/layout.tsx`

**Interfaces:**
- Consumes: `createEvent`, `updateEvent`, `toggleEvent`, `deleteEvent` from Task 6; `requireRoles`, `fmtDate`, `LOCALITIES`, `LOCALITY_LABEL` from `@/lib/portal`; `Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls` from `@/components/portal/ui`. Table `public.events` from Task 1.
- Produces: routes `/portal/events` and `/portal/events/[id]`, and a `{ href: "/portal/events", label: "Events" }` staff-only nav entry. Task 8 (public `/events` page) does not depend on these admin pages, only on the shared `events` table.

- [ ] **Step 1: Create the list + create-form page**

Create `app/portal/events/page.tsx`:

```tsx
import Link from "next/link";
import { requireRoles, fmtDate, LOCALITIES, LOCALITY_LABEL } from "@/lib/portal";
import { createEvent } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, locality, published")
    .order("event_date", { ascending: false })
    .limit(200);
  const list = (data ?? []) as {
    id: string;
    title: string;
    event_date: string;
    event_time: string | null;
    locality: keyof typeof LOCALITY_LABEL | null;
    published: boolean;
  }[];

  return (
    <>
      <PageHeader title="Events" subtitle="Pamahalaan ang mga special event na makikita sa publikong /events." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel>
            {list.length === 0 ? (
              <Empty>Wala pang naka-tala na special event.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((e) => (
                  <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={`/portal/events/${e.id}`} className="flex items-start justify-between gap-2 hover:underline">
                      <div>
                        <h3 className="font-semibold text-gray-900">{e.title}</h3>
                        <p className="text-xs text-gray-500">
                          {fmtDate(e.event_date)}
                          {e.event_time ? `, ${e.event_time}` : ""}
                          {e.locality ? ` · ${LOCALITY_LABEL[e.locality]}` : ""}
                        </p>
                      </div>
                      {!e.published && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Draft</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Magdagdag ng special event">
          <form action={createEvent} className="grid gap-4">
            <Field label="Pamagat">
              <input name="title" required className={inputCls} placeholder="Yearly Thanksgiving" />
            </Field>
            <Field label="Paglalarawan (opsyonal)">
              <textarea name="description" rows={3} className={inputCls} />
            </Field>
            <Field label="Petsa">
              <input type="date" name="event_date" required className={inputCls} />
            </Field>
            <Field label="Oras (opsyonal)" hint='Hal. "9:00 AM"'>
              <input name="event_time" className={inputCls} />
            </Field>
            <Field label="Lokal (opsyonal)">
              <select name="locality" className={inputCls} defaultValue="">
                <option value="">Lahat ng lokal</option>
                {LOCALITIES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALITY_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lugar (opsyonal)">
              <input name="location" className={inputCls} />
            </Field>
            <Field label="Link (opsyonal)" hint="Livestream o registration URL">
              <input name="link" type="url" className={inputCls} />
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

- [ ] **Step 2: Create the edit page**

Create `app/portal/events/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate, LOCALITIES, LOCALITY_LABEL } from "@/lib/portal";
import { updateEvent, toggleEvent, deleteEvent } from "../../actions";
import { Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={event.title}
        subtitle={`Huling na-update: ${fmtDate(event.updated_at)}`}
        action={
          <Link href="/portal/events" className={btnGhostCls}>
            ← Events
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="I-edit ang event">
            <form action={updateEvent} className="grid gap-4">
              <input type="hidden" name="id" value={event.id} />
              <Field label="Pamagat">
                <input name="title" defaultValue={event.title} required className={inputCls} />
              </Field>
              <Field label="Paglalarawan (opsyonal)">
                <textarea name="description" defaultValue={event.description ?? ""} rows={3} className={inputCls} />
              </Field>
              <Field label="Petsa">
                <input type="date" name="event_date" defaultValue={event.event_date} required className={inputCls} />
              </Field>
              <Field label="Oras (opsyonal)">
                <input name="event_time" defaultValue={event.event_time ?? ""} className={inputCls} />
              </Field>
              <Field label="Lokal (opsyonal)">
                <select name="locality" defaultValue={event.locality ?? ""} className={inputCls}>
                  <option value="">Lahat ng lokal</option>
                  {LOCALITIES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALITY_LABEL[l]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lugar (opsyonal)">
                <input name="location" defaultValue={event.location ?? ""} className={inputCls} />
              </Field>
              <Field label="Link (opsyonal)">
                <input name="link" type="url" defaultValue={event.link ?? ""} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" defaultChecked={event.published} className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>I-save</button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Katayuan">
            <p className="mb-3 text-sm text-gray-600">
              {event.published ? "Nakikita na ito ng publiko sa /events." : "Draft pa lang — hindi ito makikita sa /events."}
            </p>
            <form action={toggleEvent}>
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="publish" value={event.published ? "false" : "true"} />
              <button className={btnGhostCls}>{event.published ? "Gawing draft" : "I-publish"}</button>
            </form>
          </Panel>

          <Panel title="Burahin">
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button className={btnDangerCls}>Burahin ang event</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add the staff-only nav item**

In `app/portal/layout.tsx`, extend the same block Task 5 touched:

```ts
  if (isStaff(profile.role)) {
    items.push({ href: "/portal/attendance", label: "Attendance" });
    items.push({ href: "/portal/members", label: "Members" });
    items.push({ href: "/portal/sermons", label: "Sermons" });
    items.push({ href: "/portal/events", label: "Events" });
  }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/portal/events app/portal/layout.tsx
git commit -m "Add event admin pages under /portal/events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Public `/events` page — multi-locale worship + Special Events section

**Files:**
- Modify: `app/events/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `WORSHIP`, `WORSHIP_BATANGAS`, `WORSHIP_ALBERTA` from `@/lib/worship` (unchanged — no changes to that file); `getSupabase`, `todayPH`, `fmtDate`, `LOCALITY_LABEL` from `@/lib/portal`; table `public.events` from Task 1 (published rows only, via the `events_select_public`/`events_select_authenticated` RLS policies).
- Produces: nothing consumed elsewhere in this plan — last task before final verification.

- [ ] **Step 1: Replace the file contents**

Replace all of `app/events/page.tsx` with:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Repeat, CalendarDays } from "lucide-react";
import { getSupabase, todayPH, fmtDate, LOCALITY_LABEL } from "@/lib/portal";
import { WORSHIP, WORSHIP_BATANGAS, WORSHIP_ALBERTA } from "@/lib/worship";
import type { Locality } from "@/lib/locality";

// Page is rebuilt at most once an hour so the "next Sunday" date stays current.
export const revalidate = 3600;

const PH_OFFSET_HOURS = 8; // Philippines is UTC+8 all year

// All three locales worship on Sunday, so one shared "next Sunday" date
// covers all of them — only the display time differs per locale (see LOCALES
// below), and lib/worship.ts only stores those as human display strings, not
// hour/minute numbers, so we don't compute a precise per-locale instant.
function nextSundayPH(now: Date): Date {
  const ph = new Date(now.getTime() + PH_OFFSET_HOURS * 3600 * 1000);
  const daysToSunday = (7 - ph.getUTCDay()) % 7;
  return new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + daysToSunday));
}

function fmtSundayDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(d);
}

const LOCALES: { title: string; location: string; times: string[]; streamUrl?: string }[] = [
  { title: WORSHIP.title, location: WORSHIP.location, times: [WORSHIP.displayTime], streamUrl: WORSHIP.streamUrl },
  { title: "Sunday Worship", location: WORSHIP_BATANGAS.location, times: WORSHIP_BATANGAS.displayTimes },
  { title: "Sunday Worship", location: WORSHIP_ALBERTA.location, times: [WORSHIP_ALBERTA.displayTime] },
];

type SpecialEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  locality: Locality | null;
  location: string | null;
  link: string | null;
};

export default async function EventsPage() {
  const nextSunday = nextSundayPH(new Date());
  const monthPH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(nextSunday).toUpperCase();
  const dayPH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" }).format(nextSunday);

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("events")
    .select("id, title, description, event_date, event_time, locality, location, link")
    .eq("published", true)
    .gte("event_date", todayPH())
    .order("event_date");
  const specialEvents = (data ?? []) as SpecialEvent[];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* --- HEADER --- */}
      <section className="bg-white py-12 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Upcoming Events</h1>
          <p className="text-gray-600 text-lg">Mark your calendars and join us in fellowship.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-12 px-6 w-full space-y-6">
        {/* --- WEEKLY WORSHIP, ALL 3 LOCALES --- */}
        {LOCALES.map((loc) => (
          <div key={loc.location} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row gap-6">
            <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg w-full sm:w-24 h-24 border border-emerald-100">
              <span className="text-sm font-bold tracking-widest uppercase">{monthPH}</span>
              <span className="text-4xl font-extrabold">{dayPH}</span>
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{loc.title}</h3>
              <p className="flex items-center gap-1 text-emerald-700 text-sm font-medium mb-3">
                <Repeat className="w-4 h-4" />
                Every Sunday
              </p>

              <div className="space-y-2 text-gray-600 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    {fmtSundayDate(nextSunday)}, {loc.times.join(" and ")} (local time)
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{loc.location}</p>
                </div>
              </div>

              {loc.streamUrl && (
                <div className="mt-5">
                  <Link href={loc.streamUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">Join Live Stream</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* --- SPECIAL EVENTS --- */}
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-10 mb-4">
            <CalendarDays className="w-6 h-6 text-emerald-700" />
            Special Events
          </h2>
          {specialEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Walang nakatakdang special event sa ngayon.
            </div>
          ) : (
            <div className="space-y-4">
              {specialEvents.map((e) => (
                <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-xl font-bold text-gray-900">{e.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>
                        {fmtDate(e.event_date)}
                        {e.event_time ? `, ${e.event_time}` : ""}
                      </p>
                    </div>
                    {(e.location || e.locality) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{e.location || (e.locality ? LOCALITY_LABEL[e.locality] : "")}</p>
                      </div>
                    )}
                  </div>
                  {e.description && <p className="mt-3 text-gray-700">{e.description}</p>}
                  {e.link && (
                    <div className="mt-4">
                      <Link href={e.link} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">Learn More</Button>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center bg-white p-8 rounded-xl border border-dashed border-gray-300">
          <h3 className="text-lg font-semibold text-gray-900">Don't see what you're looking for?</h3>
          <p className="text-gray-500 mb-4">Contact us to ask about specific schedules.</p>
          <Link href="/contact">
            <Button variant="outline">Contact Us</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: back down to only the 3 pre-existing, unrelated errors.

Run: `npm run build`
Expected: reaches `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add app/events/page.tsx
git commit -m "Show all 3 worship locales and DB-driven special events on /events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification and rollout checklist

**Files:** none (verification only)

**Interfaces:** none — this task validates the whole feature built in Tasks 1-8.

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: exactly the 3 pre-existing errors from `components/auth-button.tsx` and `lib/supabase/server.ts`, nothing else.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: `✓ Compiled successfully`; the later static-export failure on `/reset-password` (missing `.env.local` in this dev environment) is expected and pre-existing.

- [ ] **Step 3: Review the full local commit log for this plan**

Run: `git log --oneline -9`
Expected: 8 commits from Tasks 1-8 (Task 9 has no commit of its own), each with a clear message, none pushed anywhere yet.

- [ ] **Step 4: Report the manual rollout checklist to the user**

This step is not a shell command — summarize the following for the user in chat (do not push anything or run SQL yourself):

1. Review and run `supabase/003_sermons_events.sql` in the Supabase SQL Editor on the production project.
2. Confirm in the Supabase Table Editor: `sermons` has the 3 seeded rows, `events` exists and is empty.
3. Ask the user whether to push the 8 local commits to `main` now (per standing instruction: never push without explicit go-ahead, especially to `main`, since it auto-deploys via Vercel).
4. After deploy, the user should check on the live site:
   - `/portal/sermons` and `/portal/events` as admin: create a draft, publish it, edit it, delete it.
   - `/sermons` and `/events` signed out: published items appear; drafts don't.
   - The 3 original sermons still display correctly (seed data check).
   - `/events` shows all 3 worship locales (Medina, Batangas, Alberta).

If the SQL migration (step 1 above) hasn't been run yet when the code deploys, `/sermons` and `/events` will error because the tables don't exist — the SQL must be applied before the code goes live, not after.
