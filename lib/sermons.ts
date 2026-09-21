// ============================================================
// SERMON LIBRARY DATA
// Dito lang ie-edit ang mga sermon. Isang block = isang sermon.
//
// MGA PATAKARAN:
// - Ang "verses" ay dapat aktwal na teksto na galing sa Biblia. Isulat ang
//   translation (hal. "KJV" o "Ang Dating Biblia"). Kung reference lang
//   ang alam, iwan ang "text" at ang reference lang ang lalabas.
// - Ang buod, review questions at doktrina ay dapat aprubado muna ng
//   Presiding Minister bago gawing published: true.
// - Ang PDF ay ilagay sa public/sermons/pdf/<slug>.pdf at isulat sa "pdf".
// ============================================================

export type Verse = {
  ref: string; // hal. "2 Corinthians 5:7"
  text?: string; // aktwal na teksto ng verse (optional)
  translation?: string; // hal. "KJV"
};

export type Sermon = {
  slug: string; // para sa link: /sermons/<slug> (maliliit na letra, may gitling)
  title: string;
  titleTl?: string; // Tagalog na pamagat (optional)
  speaker: string;
  date: string; // YYYY-MM-DD
  category: string;
  videoId?: string; // YouTube video ID
  summary: string; // buod (English)
  summaryTl?: string; // buod (Tagalog, optional)
  verses?: Verse[];
  questions?: string[]; // mga tanong pang-review
  pdf?: string; // hal. "/sermons/pdf/walking-in-faith.pdf"
  published: boolean; // false = hindi lalabas sa website (draft)
};

export const sermons: Sermon[] = [
  {
    slug: "walking-in-faith-not-by-sight",
    title: "Walking in Faith, Not by Sight",
    speaker: "Elder Bro. Rod S. Villaverde",
    date: "2025-12-09",
    category: "Faith Series",
    videoId: "oEBwRr2aILc",
    summary:
      "Discover what it means to truly trust God when the path ahead is unclear. We explore 2 Corinthians 5:7 and learn how to navigate life's challenges through spiritual vision.",
    published: true,
  },
  {
    slug: "the-power-of-prayer",
    title: "The Power of Prayer",
    speaker: "Bro. Abon Mangubat",
    date: "2023-02-12",
    category: "Prayer Works",
    videoId: "0ustuDLHTjI",
    summary:
      "Prayer is not just asking for things; it is a conversation with the Creator. Learn how to deepen your prayer life and see real change.",
    published: true,
  },
  {
    slug: "living-a-life-of-gratitude",
    title: "Living a Life of Gratitude",
    speaker: "Bro. Abon Mangubat",
    date: "2025-12-01",
    category: "Thanksgiving",
    videoId: "c5aaOqqp5tc",
    summary:
      "Gratitude changes our attitude. In this message, we look at how being thankful in all circumstances can transform your mental and spiritual health.",
    published: true,
  },
];

// --- Mga helper (huwag galawin) ---

export function getPublishedSermons(): Sermon[] {
  return sermons
    .filter((s) => s.published)
    .sort((a, b) => b.date.localeCompare(a.date)); // pinakabago muna
}

export function getSermon(slug: string): Sermon | undefined {
  return getPublishedSermons().find((s) => s.slug === slug);
}

export function formatSermonDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
