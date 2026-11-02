import data from "./suhay/content.json";
import { createAdminClient } from "@/lib/supabase/admin";

// SUHAY (static rebuild, 2026-11-02): ang content ay galing sa WordPress export
// ng lumang SUHAY site, na-convert sa JSON (lib/suhay/content.json). Ang mga
// pahina ay ise-serve sa loob ng portal (/portal/suhay) kaya ang portal login
// ang bantay. Ang media (audio narasyon, PDF, larawan) ay nasa private
// Supabase Storage bucket na "suhay-media" at binubuksan sa pamamagitan ng
// signed URLs na dito ginagawa (server-side, service role).

export const SUHAY_BUCKET = "suhay-media";

export type SuhayGroup = "aralin" | "yugto" | "core" | "post";

export type SuhayPage = {
  slug: string;
  title: string;
  kind: string;
  group: SuhayGroup;
  num: number | null;
  html: string;
  audio: string | null;
};

export const suhayPages = (data as unknown as { pages: SuhayPage[] }).pages;

export function getSuhayPage(slug: string): SuhayPage | undefined {
  return suhayPages.find((p) => p.slug === slug);
}

export const suhayLessons = (): SuhayPage[] =>
  suhayPages
    .filter((p) => p.group === "aralin")
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

export const suhayYugto = (): SuhayPage[] =>
  suhayPages
    .filter((p) => p.group === "yugto")
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

export const suhayCore = (): SuhayPage[] =>
  suhayPages.filter((p) => p.group === "core");

export const suhayWelcome = (): SuhayPage | undefined =>
  suhayPages.find((p) => p.group === "post");

const MEDIA_RE = /media\/([A-Za-z0-9._%-]+)/g;

// Palitan ang mga "media/<file>" na reperensya sa HTML ng signed URLs mula sa
// private bucket. Kung hindi pa handa ang bucket o ang file, iwanang ganoon
// ang reperensya (hindi babagsak ang pahina).
export async function resolveSuhayMedia(html: string): Promise<string> {
  const files = [...new Set([...html.matchAll(MEDIA_RE)].map((m) => m[1]))];
  if (files.length === 0) return html;
  try {
    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage
      .from(SUHAY_BUCKET)
      .createSignedUrls(files, 3600);
    if (error || !signed) return html;
    const byPath = new Map<string, string>();
    for (const s of signed) {
      if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
    }
    let out = html;
    for (const f of files) {
      const url = byPath.get(f);
      if (url) out = out.split(`media/${f}`).join(url);
    }
    return out;
  } catch {
    return html;
  }
}

// Signed URL para sa iisang media file (hal. ang audio narasyon ng aralin).
export async function suhayMediaUrl(file: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(SUHAY_BUCKET)
      .createSignedUrl(file, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
