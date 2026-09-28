// Pagbasa ng .docx na Texto ng buwan (server-only): kinukuha ang mga pamagat ng Paksa (hanggang 5, Linggo 1-5)
// batay sa istruktura ng aktwal na texto na ginagamit (bawat Paksa ay may pamagat na LAHAT-KAPITAL na
// paragraph, hiwalay sa mga tanong/sagot at pangalan ng awtor). Walang AI/OCR — pure text heuristic lang,
// kaya laging dapat masuri ng Admin ang resulta bago ito huling gamitin.
import JSZip from "jszip";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Kinukuha ang text ng bawat <w:p> (paragraph) sa word/document.xml, sunod-sunod gaya ng sa dokumento.
export async function extractDocxParagraphs(buf: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Hindi wastong .docx file (walang word/document.xml).");
  const xml = await entry.async("text");
  const pMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return pMatches.map((p) => {
    const tMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    return decodeXmlEntities(tMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(""));
  });
}

// Heuristic: ang pamagat ng Paksa ay isang paragraph na LAHAT-KAPITAL (hindi kasama ang "PAS/." na tanong),
// may sapat na haba (higit sa 12 letra), sunod-sunod ayon sa pagkakalitaw sa dokumento. Hanggang 5 lang
// (Linggo 1-5) ang kukunin.
export function extractPagsambaTopics(paragraphs: string[]): string[] {
  const titles: string[] = [];
  for (const raw of paragraphs) {
    const t = raw.trim();
    if (!t) continue;
    if (t.toUpperCase().startsWith("PAS")) continue;
    const lettersOnly = t.replace(/[^A-Za-z]/g, "");
    if (lettersOnly.length <= 12) continue;
    if (t.toUpperCase() !== t) continue;
    titles.push(t);
  }
  return titles.slice(0, 5);
}
