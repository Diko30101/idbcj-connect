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
