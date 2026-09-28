import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { isValidMonth } from "@/lib/abuluyan";
import { currentMonthPH, monthToDate } from "@/lib/finance";
import { groupAmbaganByMember, groupGivingByMember } from "@/lib/resibo";
import { pasalamatTypeLabel } from "@/lib/giving";
import { getResiboSummary } from "../summary";
import { loadChurchFonts, drawPagsambaPages, drawAmbaganPages, drawAralPages, drawPasalamatPages, type PagsambaPdfWeek } from "@/lib/pdf/church-pdf";
import { LOCAL_KEY_TO_LOCALITY } from "@/lib/finance-collections";
import { sundaysOfMonth } from "@/lib/pagsamba";

// Downloadable/printable na PDF ng Buwanang Resibo (Pagsamba/Abuluyan + Ambagan + Tulong sa Aral +
// Pasalamat), sundan ang eksaktong disenyo ng opisyal na letterhead template (public/Pagsamba.pdf,
// public/Ambagan.pdf, public/Aral.pdf, public/Monthly Pasalamat Report.pdf).
// Parehong pahintulot gaya ng /portal/finance/resibo (Church-wide Finance, Admin, o Local Finance
// ng sariling lokal). Ang RLS pa rin ang huling harang sa datos.
export async function GET(req: NextRequest) {
  const ctx = await getAbuluyanContext();
  const wide = ctx.isChurch || ctx.isAdmin;

  const localParam = req.nextUrl.searchParams.get("local") ?? "";
  const buwanParam = req.nextUrl.searchParams.get("buwan") ?? "";
  const buwan = isValidMonth(buwanParam) ? buwanParam : currentMonthPH();

  let localId: string;
  let localName: string;
  let localKey: string;
  if (wide) {
    if (!localId2Uuid(localParam)) return new NextResponse("Di-wastong lokal.", { status: 400 });
    const { data } = await ctx.supabase.from("locals").select("id, name, key").eq("id", localParam).maybeSingle();
    const row = data as { id: string; name: string; key: string } | null;
    if (!row) return new NextResponse("Di-wastong lokal.", { status: 400 });
    localId = row.id;
    localName = row.name;
    localKey = row.key;
  } else {
    if (!ctx.local) denyAbuluyan();
    localId = ctx.local.id;
    localName = ctx.local.name;
    localKey = ctx.local.key;
  }

  const [summary, secretaryName] = await Promise.all([
    getResiboSummary(ctx.supabase, localId, localName, buwan),
    getLocalSecretaryName(ctx.supabase, localKey),
  ]);
  const ambaganGrid = groupAmbaganByMember(summary.ambagan);
  const aralRows = groupGivingByMember(summary.tulong);
  const pagsambaWeeks = await getPagsambaWeeks(ctx.supabase, localId, buwan, summary.abuluyan);

  const doc = await PDFDocument.create();
  doc.setTitle(`Pagsamba, Ambagan, Aral at Pasalamat — ${localName} — ${summary.monthLabel}`);
  doc.setProducer("IDBCJ Connect");
  const fonts = await loadChurchFonts(doc);
  const logoBytes = fs.readFileSync(path.join(process.cwd(), "public", "logo-seal.png"));

  await drawPagsambaPages(
    doc,
    fonts,
    logoBytes,
    localName,
    summary.monthLabel,
    pagsambaWeeks,
    summary.abuluyanTotal,
    secretaryName,
  );
  await drawAmbaganPages(
    doc,
    fonts,
    logoBytes,
    localName,
    summary.monthLabel,
    ambaganGrid.map((r) => ({ memberName: r.memberName, weeks: r.weeks })),
    [0, 1, 2, 3, 4].map((i) => ambaganGrid.reduce((s, r) => s + (r.weeks[i] ?? 0), 0)),
    summary.ambaganTotal,
    secretaryName,
  );
  await drawAralPages(
    doc,
    fonts,
    logoBytes,
    localName,
    summary.monthLabel,
    aralRows.map((r) => ({ memberName: r.memberName, amount: r.amount })),
    summary.tulongTotal,
    secretaryName,
  );
  await drawPasalamatPages(
    doc,
    fonts,
    logoBytes,
    localName,
    summary.monthLabel,
    summary.pasalamat.map((r) => ({
      date: r.date,
      memberName: r.memberName,
      description: r.notes ? `${pasalamatTypeLabel(r.type)} — ${r.notes}` : pasalamatTypeLabel(r.type),
      amount: r.amount,
    })),
    summary.pasalamatTotal,
    secretaryName,
  );

  const bytes = await doc.save();
  const filename = `Pagsamba-Ambagan-Aral-Pasalamat-${localName.replace(/[^\w-]+/g, "_")}-${buwan}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Simpleng UUID shape check bago i-query (iwas walang-kwentang query kung malformed ang param)
function localId2Uuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Pangalan ng Local Secretary: ang member na naka-set ng role = "local_secretary" (lib/portal.ts)
// sa locality ng local na ito. Ipinapakita sa ilalim ng guhit ng lagda sa bawat pahina ng
// Buwanang Resibo PDF.
async function getLocalSecretaryName(
  supabase: Awaited<ReturnType<typeof getAbuluyanContext>>["supabase"],
  localKey: string,
): Promise<string> {
  const locality = LOCAL_KEY_TO_LOCALITY[localKey];
  if (!locality) return "";
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("role", "local_secretary")
    .eq("locality", locality)
    .limit(1);
  const row = ((data ?? []) as { full_name: string | null }[])[0];
  return row?.full_name ?? "";
}

// Katitikan ng Pagsamba bawat Linggo ng buwan: Paksa (church-wide, mula sa pagsamba_topics),
// Sugo ng pangunahing session (per local, mula sa pagsamba_records), Blg. ng Dumalo/Panauhin
// (read-only mula sa attendance, service_type = "Linggo" lang), at Abuluyan ng Linggo na iyon
// (mula sa summary.abuluyan na kinuha na, `null` kung wala pang naipapasang record).
async function getPagsambaWeeks(
  supabase: SupabaseClient,
  localId: string,
  buwan: string,
  abuluyan: { serviceDate: string; amount: number }[],
): Promise<PagsambaPdfWeek[]> {
  const dates = sundaysOfMonth(buwan);
  if (dates.length === 0) return [];
  const abuluyanByDate = new Map(abuluyan.map((w) => [w.serviceDate, w.amount]));
  const periodMonth = monthToDate(buwan);

  const [{ data: topicRows }, { data: recRows }, { data: attRows }, { data: guestRows }] = await Promise.all([
    supabase.from("pagsamba_topics").select("week_number, paksa").eq("period_month", periodMonth),
    supabase.from("pagsamba_records").select("service_date, sugo_id").eq("local_id", localId).eq("session_label", "").in("service_date", dates),
    supabase.from("attendance_records").select("service_date, present").eq("local_id", localId).eq("service_type", "Linggo").in("service_date", dates),
    supabase.from("attendance_guests").select("service_date").eq("local_id", localId).eq("service_type", "Linggo").in("service_date", dates),
  ]);

  const topicByWeek = new Map<number, string>();
  for (const t of (topicRows ?? []) as { week_number: number; paksa: string }[]) topicByWeek.set(t.week_number, t.paksa);

  const sugoIdByDate = new Map<string, string>();
  for (const r of (recRows ?? []) as { service_date: string; sugo_id: string | null }[]) {
    if (r.sugo_id) sugoIdByDate.set(r.service_date, r.sugo_id);
  }
  const sugoIds = [...new Set([...sugoIdByDate.values()])];
  const sugoNameById = new Map<string, string>();
  if (sugoIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", sugoIds);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) sugoNameById.set(p.id, p.full_name ?? "");
  }

  const presentByDate = new Map<string, number>();
  for (const r of (attRows ?? []) as { service_date: string; present: boolean }[]) {
    if (r.present) presentByDate.set(r.service_date, (presentByDate.get(r.service_date) ?? 0) + 1);
  }
  const guestByDate = new Map<string, number>();
  for (const r of (guestRows ?? []) as { service_date: string }[]) {
    guestByDate.set(r.service_date, (guestByDate.get(r.service_date) ?? 0) + 1);
  }

  return dates.map((date, i) => {
    const weekNumber = i + 1;
    const sugoId = sugoIdByDate.get(date);
    return {
      weekLabel: `Linggo ${weekNumber}`,
      serviceDate: date,
      paksa: topicByWeek.get(weekNumber) ?? "",
      sugo: sugoId ? sugoNameById.get(sugoId) ?? "" : "",
      dumalo: presentByDate.get(date) ?? 0,
      panauhin: guestByDate.get(date) ?? 0,
      abuluyan: abuluyanByDate.get(date) ?? null,
    };
  });
}
