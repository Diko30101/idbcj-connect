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
