import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { getAbuluyanContext, denyAbuluyan } from "@/lib/portal";
import { isValidMonth } from "@/lib/abuluyan";
import { currentMonthPH } from "@/lib/finance";
import { groupAmbaganByMember, groupGivingByMember } from "@/lib/resibo";
import { pasalamatTypeLabel } from "@/lib/giving";
import { getResiboSummary } from "../summary";
import { loadChurchFonts, drawAbuluyanPages, drawAmbaganPages, drawAralPages, drawPasalamatPages } from "@/lib/pdf/church-pdf";

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
  if (wide) {
    if (!localId2Uuid(localParam)) return new NextResponse("Di-wastong lokal.", { status: 400 });
    const { data } = await ctx.supabase.from("locals").select("id, name").eq("id", localParam).maybeSingle();
    const row = data as { id: string; name: string } | null;
    if (!row) return new NextResponse("Di-wastong lokal.", { status: 400 });
    localId = row.id;
    localName = row.name;
  } else {
    if (!ctx.local) denyAbuluyan();
    localId = ctx.local.id;
    localName = ctx.local.name;
  }

  const [summary, secretaryName] = await Promise.all([
    getResiboSummary(ctx.supabase, localId, localName, buwan),
    getLocalSecretaryName(ctx.supabase, localId),
  ]);
  const ambaganGrid = groupAmbaganByMember(summary.ambagan);
  const aralRows = groupGivingByMember(summary.tulong);

  const doc = await PDFDocument.create();
  doc.setTitle(`Pagsamba, Ambagan, Aral at Pasalamat — ${localName} — ${summary.monthLabel}`);
  doc.setProducer("IDBCJ Connect");
  const fonts = await loadChurchFonts(doc);
  const logoBytes = fs.readFileSync(path.join(process.cwd(), "public", "logo-seal.png"));

  await drawAbuluyanPages(
    doc,
    fonts,
    logoBytes,
    localName,
    summary.monthLabel,
    summary.abuluyan.map((w) => ({ serviceDate: w.serviceDate, amount: w.amount })),
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

// Pangalan ng Local Secretary (leader ng Local Finance Ministry ng local --
// walang hiwalay na "Local Secretary" na field sa database, kaya ito ang tugma).
// Ipinapakita sa ilalim ng guhit ng lagda sa bawat pahina ng Buwanang Resibo PDF.
async function getLocalSecretaryName(
  supabase: Awaited<ReturnType<typeof getAbuluyanContext>>["supabase"],
  localId: string,
): Promise<string> {
  const { data } = await supabase
    .from("ministry_members")
    .select("profiles(full_name), ministries!inner(name)")
    .eq("local_id", localId)
    .eq("is_leader", true)
    .eq("ministries.name", "Local Finance Ministry");
  const row = ((data ?? []) as { profiles: { full_name: string | null } | null }[])[0];
  return row?.profiles?.full_name ?? "";
}
