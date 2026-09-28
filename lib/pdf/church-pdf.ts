// Mga helper para bumuo ng opisyal na letterhead na PDF (Pagsamba, Ambagan, Aral, Pasalamat) gamit
// ang pdf-lib. Sinusunod ang disenyo ng mga blangkong papel na template (public/Pagsamba.pdf,
// public/Ambagan.pdf, public/Aral.pdf, public/Monthly Pasalamat Report.pdf): selyo + pangalan ng
// iglesia sa itaas, pamagat, LOCAL/LOKAL at BUWAN/TAON na field, talahanayan, TOTAL sa ilalim, at
// guhit ng lagda ng LOCAL SECRETARY.
// Walang server-only na import: ligtas tawagin mula sa isang Route Handler.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const TAGALOG_MONTHS_SHORT = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];

// "Set 6, 2026" mula sa "2026-09-06" (YYYY-MM-DD)
function fmtLinggoDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${TAGALOG_MONTHS_SHORT[m - 1] ?? ""} ${d}, ${y}`;
}

export const PAGE_W = 612; // US Letter, tulad ng mga opisyal na template
export const PAGE_H = 792;
export const MARGIN = 50;

export type ChurchFonts = {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
};

export async function loadChurchFonts(doc: PDFDocument): Promise<ChurchFonts> {
  return {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

function centerText(page: PDFPage, font: PDFFont, size: number, text: string, y: number) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color: rgb(0, 0, 0) });
}

// Putulin ang teksto (may "…" sa dulo) kung hindi ito kasya sa ibinigay na lapad —
// gamit ng mga hanay ng talahanayan na posibleng mahaba (hal. Detalye ng Pasalamat).
function truncateToWidth(font: PDFFont, size: number, text: string, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

// Iginuhit ang header (selyo + pangalan ng iglesia + pamagat). Ibinabalik ang "y" pagkatapos.
export async function drawLetterhead(
  doc: PDFDocument,
  page: PDFPage,
  fonts: ChurchFonts,
  logoBytes: Uint8Array,
  titleSpaced: string,
): Promise<number> {
  const logo = await doc.embedPng(logoBytes);
  const logoDim = logo.scale(58 / logo.width);
  let y = PAGE_H - MARGIN;
  page.drawImage(logo, { x: (PAGE_W - logoDim.width) / 2, y: y - logoDim.height, width: logoDim.width, height: logoDim.height });
  // 18pt na puwang (dati'y 6pt lang) — kasya na ang pataas na bahagi ("ascender") ng bold na
  // titik sa ilalim ng selyo, dahil dati'y natatakpan ito ng selyo (masyadong malapit).
  y -= logoDim.height + 18;
  centerText(page, fonts.serifBold, 14, "Iglesia ng Dios na Buhay", y);
  y -= 17;
  centerText(page, fonts.serifBold, 14, "kay Cristo Jesus", y);
  y -= 34;
  centerText(page, fonts.serifBold, 20, titleSpaced, y);
  y -= 34;
  return y;
}

// "LABEL :____value____"    "LABEL2:____value2____" — dalawang field sa isang hanay.
export function drawFieldsRow(
  page: PDFPage,
  fonts: ChurchFonts,
  y: number,
  left: { label: string; value: string },
  right: { label: string; value: string },
): number {
  page.drawText(left.label, { x: MARGIN, y, size: 11, font: fonts.sans });
  const leftLabelW = fonts.sans.widthOfTextAtSize(left.label, 11);
  page.drawLine({ start: { x: MARGIN + leftLabelW + 4, y: y - 2 }, end: { x: MARGIN + 250, y: y - 2 }, thickness: 0.75 });
  page.drawText(left.value, { x: MARGIN + leftLabelW + 8, y, size: 11, font: fonts.sans });

  const rightX = 348;
  page.drawText(right.label, { x: rightX, y, size: 11, font: fonts.sans });
  const rightLabelW = fonts.sans.widthOfTextAtSize(right.label, 11);
  page.drawLine({ start: { x: rightX + rightLabelW + 4, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.75 });
  page.drawText(right.value, { x: rightX + rightLabelW + 8, y, size: 11, font: fonts.sans });

  return y - 26;
}

// Walang glyph ang "₱" sa standard PDF font (WinAnsi), kaya "PHP" ang gamit sa loob ng PDF.
export function fmtPHP(n: number): string {
  return `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawTableHeaderRow(
  page: PDFPage,
  fonts: ChurchFonts,
  y: number,
  colWidths: number[],
  labels: string[],
  headerH: number,
): void {
  page.drawRectangle({
    x: MARGIN,
    y: y - headerH,
    width: colWidths.reduce((s, w) => s + w, 0),
    height: headerH,
    color: rgb(0.85, 0.85, 0.85),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.75,
  });
  let cx = MARGIN;
  labels.forEach((label, i) => {
    const w = colWidths[i];
    const tw = fonts.sansBold.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: cx + (w - tw) / 2, y: y - headerH + 6, size: 10, font: fonts.sansBold });
    cx += w;
  });
}

export type AmbaganPdfRow = { memberName: string; weeks: (number | null)[] };

// Bumubuo ng isa o higit pang pahina ng grid na Pangalan × Linggo I–V (matches public/Ambagan.pdf).
// Nagdaragdag ng bagong pahina kapag hindi na kasya ang mga kaanib sa isang pahina.
export async function drawAmbaganPages(
  doc: PDFDocument,
  fonts: ChurchFonts,
  logoBytes: Uint8Array,
  local: string,
  buwanTaon: string,
  rows: AmbaganPdfRow[],
  weekTotals: number[],
  grandTotal: number,
  secretaryName?: string,
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];
  const nameColW = 220;
  const weekColW = (PAGE_W - MARGIN * 2 - nameColW) / 5;
  const colWidths = [nameColW, weekColW, weekColW, weekColW, weekColW, weekColW];
  const headerLabels = ["Pangalan", "I", "II", "III", "IV", "V"];
  const headerH = 20;
  const rowH = 18;
  const footerReserve = 105; // TOTAL + guhit ng lagda + pangalan ng Local Secretary

  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = await drawLetterhead(doc, page, fonts, logoBytes, "A M B A G A N");
  y = drawFieldsRow(page, fonts, y, { label: "LOCAL :", value: local }, { label: "BUWAN/TAON:", value: buwanTaon });

  drawTableHeaderRow(page, fonts, y, colWidths, headerLabels, headerH);
  let ry = y - headerH;
  let isFirstPage = true;

  const newContinuationPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    isFirstPage = false;
    let cy = PAGE_H - MARGIN;
    page.drawText(`Ambagan (patuloy) — ${local} — ${buwanTaon}`, { x: MARGIN, y: cy, size: 10, font: fonts.sans, color: rgb(0.35, 0.35, 0.35) });
    cy -= 20;
    drawTableHeaderRow(page, fonts, cy, colWidths, headerLabels, headerH);
    ry = cy - headerH;
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const reserve = idx === rows.length - 1 ? footerReserve : 0;
    if (ry - rowH < MARGIN + reserve) newContinuationPage();
    const r = rows[idx];
    let cx = MARGIN;
    for (let c = 0; c < 6; c++) {
      const w = colWidths[c];
      page.drawRectangle({ x: cx, y: ry - rowH, width: w, height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
      if (c === 0) {
        page.drawText(r.memberName, { x: cx + 4, y: ry - rowH + 5, size: 9, font: fonts.sans });
      } else {
        const val = r.weeks[c - 1];
        if (val !== null) {
          const txt = val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const tw = fonts.sans.widthOfTextAtSize(txt, 9);
          page.drawText(txt, { x: cx + w - tw - 5, y: ry - rowH + 5, size: 9, font: fonts.sans });
        }
      }
      cx += w;
    }
    ry -= rowH;
  }

  if (rows.length === 0) {
    // Walang record: ipakita pa rin ang blangkong talahanayan (isang bakanteng hanay) para hindi mukhang sira.
  }

  const totalLine = `TOTAL: ${fmtPHP(grandTotal)}`;
  const totalTw = fonts.sans.widthOfTextAtSize(totalLine, 11);
  page.drawText(totalLine, { x: PAGE_W - MARGIN - totalTw, y: ry - 22, size: 11, font: fonts.sans });

  const sigY = ry - 70;
  page.drawLine({ start: { x: PAGE_W - MARGIN - 220, y: sigY }, end: { x: PAGE_W - MARGIN, y: sigY }, thickness: 0.75 });
  if (secretaryName) {
    const nameTw = fonts.sansBold.widthOfTextAtSize(secretaryName, 10);
    page.drawText(secretaryName, { x: PAGE_W - MARGIN - 110 - nameTw / 2, y: sigY - 11, size: 10, font: fonts.sansBold });
  }
  const sigLabel = "LOCAL SECRETARY";
  const sigTw = fonts.sans.widthOfTextAtSize(sigLabel, 9);
  page.drawText(sigLabel, { x: PAGE_W - MARGIN - 110 - sigTw / 2, y: sigY - 23, size: 9, font: fonts.sans });
  void isFirstPage;
  void weekTotals; // reserbado kung sakaling idagdag pa ang kabuuan bawat linggo sa hinaharap

  return pages;
}

export type AbuluyanPdfRow = { serviceDate: string; amount: number };

// Bumubuo ng isa o higit pang pahina ng Linggo | Halaga (matches public/Pagsamba.pdf) --
// ang lingguhang Abuluyan (pinagsamang handog, hindi per-miyembro).
export async function drawAbuluyanPages(
  doc: PDFDocument,
  fonts: ChurchFonts,
  logoBytes: Uint8Array,
  local: string,
  buwanTaon: string,
  rows: AbuluyanPdfRow[],
  grandTotal: number,
  secretaryName?: string,
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];
  const dateColW = 340;
  const amountColW = PAGE_W - MARGIN * 2 - dateColW;
  const colWidths = [dateColW, amountColW];
  const headerLabels = ["Linggo", "Halaga"];
  const headerH = 20;
  const rowH = 18;
  const footerReserve = 105;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = await drawLetterhead(doc, page, fonts, logoBytes, "P A G S A M B A");
  y = drawFieldsRow(page, fonts, y, { label: "LOKAL :", value: local }, { label: "BUWAN/TAON:", value: buwanTaon });

  drawTableHeaderRow(page, fonts, y, colWidths, headerLabels, headerH);
  let ry = y - headerH;

  const newContinuationPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let cy = PAGE_H - MARGIN;
    page.drawText(`Pagsamba (patuloy) — ${local} — ${buwanTaon}`, { x: MARGIN, y: cy, size: 10, font: fonts.sans, color: rgb(0.35, 0.35, 0.35) });
    cy -= 20;
    drawTableHeaderRow(page, fonts, cy, colWidths, headerLabels, headerH);
    ry = cy - headerH;
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const reserve = idx === rows.length - 1 ? footerReserve : 0;
    if (ry - rowH < MARGIN + reserve) newContinuationPage();
    const r = rows[idx];
    let cx = MARGIN;
    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[0], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawText(fmtLinggoDate(r.serviceDate), { x: cx + 4, y: ry - rowH + 5, size: 9, font: fonts.sans });
    cx += colWidths[0];
    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[1], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    const txt = r.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tw = fonts.sans.widthOfTextAtSize(txt, 9);
    page.drawText(txt, { x: cx + colWidths[1] - tw - 5, y: ry - rowH + 5, size: 9, font: fonts.sans });
    ry -= rowH;
  }

  const totalLine = `TOTAL: ${fmtPHP(grandTotal)}`;
  const totalTw = fonts.sans.widthOfTextAtSize(totalLine, 11);
  page.drawText(totalLine, { x: PAGE_W - MARGIN - totalTw, y: ry - 22, size: 11, font: fonts.sans });

  const sigY = ry - 70;
  page.drawLine({ start: { x: PAGE_W - MARGIN - 220, y: sigY }, end: { x: PAGE_W - MARGIN, y: sigY }, thickness: 0.75 });
  if (secretaryName) {
    const nameTw = fonts.sansBold.widthOfTextAtSize(secretaryName, 10);
    page.drawText(secretaryName, { x: PAGE_W - MARGIN - 110 - nameTw / 2, y: sigY - 11, size: 10, font: fonts.sansBold });
  }
  const sigLabel = "LOCAL SECRETARY";
  const sigTw = fonts.sans.widthOfTextAtSize(sigLabel, 9);
  page.drawText(sigLabel, { x: PAGE_W - MARGIN - 110 - sigTw / 2, y: sigY - 23, size: 9, font: fonts.sans });

  return pages;
}

export type PasalamatPdfRow = { date: string; memberName: string; description: string; amount: number };

// Bumubuo ng isa o higit pang pahina ng Petsa | Pangalan | Detalye | Halaga
// (matches public/Monthly Pasalamat Report.pdf).
export async function drawPasalamatPages(
  doc: PDFDocument,
  fonts: ChurchFonts,
  logoBytes: Uint8Array,
  local: string,
  buwanTaon: string,
  rows: PasalamatPdfRow[],
  grandTotal: number,
  secretaryName?: string,
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];
  const dateColW = 62;
  const nameColW = 140;
  const amountColW = 60;
  const descColW = PAGE_W - MARGIN * 2 - dateColW - nameColW - amountColW;
  const colWidths = [dateColW, nameColW, descColW, amountColW];
  const headerLabels = ["Petsa", "Pangalan", "Detalye", "Halaga"];
  const headerH = 20;
  const rowH = 18;
  const footerReserve = 105;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = await drawLetterhead(doc, page, fonts, logoBytes, "P A S A L A M A T");
  y = drawFieldsRow(page, fonts, y, { label: "LOKAL :", value: local }, { label: "BUWAN/TAON:", value: buwanTaon });

  drawTableHeaderRow(page, fonts, y, colWidths, headerLabels, headerH);
  let ry = y - headerH;

  const newContinuationPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let cy = PAGE_H - MARGIN;
    page.drawText(`Pasalamat (patuloy) — ${local} — ${buwanTaon}`, { x: MARGIN, y: cy, size: 10, font: fonts.sans, color: rgb(0.35, 0.35, 0.35) });
    cy -= 20;
    drawTableHeaderRow(page, fonts, cy, colWidths, headerLabels, headerH);
    ry = cy - headerH;
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const reserve = idx === rows.length - 1 ? footerReserve : 0;
    if (ry - rowH < MARGIN + reserve) newContinuationPage();
    const r = rows[idx];
    let cx = MARGIN;

    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[0], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawText(truncateToWidth(fonts.sans, 8, fmtLinggoDate(r.date), colWidths[0] - 6), { x: cx + 3, y: ry - rowH + 5, size: 8, font: fonts.sans });
    cx += colWidths[0];

    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[1], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawText(truncateToWidth(fonts.sans, 9, r.memberName, colWidths[1] - 8), { x: cx + 4, y: ry - rowH + 5, size: 9, font: fonts.sans });
    cx += colWidths[1];

    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[2], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawText(truncateToWidth(fonts.sans, 9, r.description, colWidths[2] - 8), { x: cx + 4, y: ry - rowH + 5, size: 9, font: fonts.sans });
    cx += colWidths[2];

    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[3], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    const txt = r.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tw = fonts.sans.widthOfTextAtSize(txt, 9);
    page.drawText(txt, { x: cx + colWidths[3] - tw - 5, y: ry - rowH + 5, size: 9, font: fonts.sans });

    ry -= rowH;
  }

  const totalLine = `TOTAL: ${fmtPHP(grandTotal)}`;
  const totalTw = fonts.sans.widthOfTextAtSize(totalLine, 11);
  page.drawText(totalLine, { x: PAGE_W - MARGIN - totalTw, y: ry - 22, size: 11, font: fonts.sans });

  const sigY2 = ry - 70;
  page.drawLine({ start: { x: PAGE_W - MARGIN - 220, y: sigY2 }, end: { x: PAGE_W - MARGIN, y: sigY2 }, thickness: 0.75 });
  if (secretaryName) {
    const nameTw2 = fonts.sansBold.widthOfTextAtSize(secretaryName, 10);
    page.drawText(secretaryName, { x: PAGE_W - MARGIN - 110 - nameTw2 / 2, y: sigY2 - 11, size: 10, font: fonts.sansBold });
  }
  const sigLabel2 = "LOCAL SECRETARY";
  const sigTw2 = fonts.sans.widthOfTextAtSize(sigLabel2, 9);
  page.drawText(sigLabel2, { x: PAGE_W - MARGIN - 110 - sigTw2 / 2, y: sigY2 - 23, size: 9, font: fonts.sans });

  return pages;
}

export type AralPdfRow = { memberName: string; amount: number };

// Bumubuo ng isa o higit pang pahina ng Pangalan | Halaga (matches public/Aral.pdf).
export async function drawAralPages(
  doc: PDFDocument,
  fonts: ChurchFonts,
  logoBytes: Uint8Array,
  local: string,
  buwanTaon: string,
  rows: AralPdfRow[],
  grandTotal: number,
  secretaryName?: string,
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];
  const nameColW = 340;
  const amountColW = PAGE_W - MARGIN * 2 - nameColW;
  const colWidths = [nameColW, amountColW];
  const headerLabels = ["Pangalan", "Halaga"];
  const headerH = 20;
  const rowH = 18;
  const footerReserve = 105;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = await drawLetterhead(doc, page, fonts, logoBytes, "A R A L");
  y = drawFieldsRow(page, fonts, y, { label: "LOKAL :", value: local }, { label: "BUWAN/TAON:", value: buwanTaon });

  drawTableHeaderRow(page, fonts, y, colWidths, headerLabels, headerH);
  let ry = y - headerH;

  const newContinuationPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    let cy = PAGE_H - MARGIN;
    page.drawText(`Aral (patuloy) — ${local} — ${buwanTaon}`, { x: MARGIN, y: cy, size: 10, font: fonts.sans, color: rgb(0.35, 0.35, 0.35) });
    cy -= 20;
    drawTableHeaderRow(page, fonts, cy, colWidths, headerLabels, headerH);
    ry = cy - headerH;
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const reserve = idx === rows.length - 1 ? footerReserve : 0;
    if (ry - rowH < MARGIN + reserve) newContinuationPage();
    const r = rows[idx];
    let cx = MARGIN;
    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[0], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    page.drawText(r.memberName, { x: cx + 4, y: ry - rowH + 5, size: 9, font: fonts.sans });
    cx += colWidths[0];
    page.drawRectangle({ x: cx, y: ry - rowH, width: colWidths[1], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    const txt = r.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tw = fonts.sans.widthOfTextAtSize(txt, 9);
    page.drawText(txt, { x: cx + colWidths[1] - tw - 5, y: ry - rowH + 5, size: 9, font: fonts.sans });
    ry -= rowH;
  }

  const totalLine = `TOTAL: ${fmtPHP(grandTotal)}`;
  const totalTw = fonts.sans.widthOfTextAtSize(totalLine, 11);
  page.drawText(totalLine, { x: PAGE_W - MARGIN - totalTw, y: ry - 22, size: 11, font: fonts.sans });

  const sigY = ry - 70;
  page.drawLine({ start: { x: PAGE_W - MARGIN - 220, y: sigY }, end: { x: PAGE_W - MARGIN, y: sigY }, thickness: 0.75 });
  if (secretaryName) {
    const nameTw = fonts.sansBold.widthOfTextAtSize(secretaryName, 10);
    page.drawText(secretaryName, { x: PAGE_W - MARGIN - 110 - nameTw / 2, y: sigY - 11, size: 10, font: fonts.sansBold });
  }
  const sigLabel = "LOCAL SECRETARY";
  const sigTw = fonts.sans.widthOfTextAtSize(sigLabel, 9);
  page.drawText(sigLabel, { x: PAGE_W - MARGIN - 110 - sigTw / 2, y: sigY - 23, size: 9, font: fonts.sans });

  return pages;
}
