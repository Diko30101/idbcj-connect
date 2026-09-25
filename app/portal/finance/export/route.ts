import { NextRequest, NextResponse } from "next/server";
import {
  getPortalContext,
  isFinance,
  FINANCE_MINISTRY_NAME,
  LOCALITY_LABEL,
  FINANCE_CATEGORY_LABEL,
} from "@/lib/portal";
import { getYearlyCollections, LOCAL_KEY_TO_LOCALITY } from "@/lib/finance-collections";

// Iwas CSV injection (mga cell na nagsisimula sa = + - @)
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

// CSV ng koleksyon: ang data ay galing LAMANG sa Abuluyan, Ambagan,
// Tulong sa Aral at Pasalamat na na-encode ng Local Finance Ministry
// (mga naipadala na; hindi kasama ang draft at void).
export async function GET(req: NextRequest) {
  const { supabase, profile } = await getPortalContext();
  if (!isFinance(profile.role)) {
    const { data } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
    const isFinanceMinistryMember = ((data ?? []) as any[]).some((m) => m.ministries?.name === FINANCE_MINISTRY_NAME);
    if (!isFinanceMinistryMember) return new NextResponse("Forbidden", { status: 403 });
  }

  const yearParam = req.nextUrl.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(yearParam) ? yearParam : new Date().getFullYear().toString();

  const rows = await getYearlyCollections(supabase, year);
  rows.sort((a, b) => a.month.localeCompare(b.month) || (a.locality ?? "").localeCompare(b.locality ?? "") || a.category.localeCompare(b.category));

  const columns = ["buwan", "lokal", "kategorya", "halaga"];
  const lines = [columns.join(",")];
  for (const r of rows) {
    const locality = r.localKey ? (LOCAL_KEY_TO_LOCALITY[r.localKey] ?? null) : null;
    lines.push(
      [
        cell(`${year}-${r.month}`),
        cell(locality ? (LOCALITY_LABEL[locality] ?? locality) : (r.localKey ?? "")),
        cell(FINANCE_CATEGORY_LABEL[r.category] ?? r.category),
        cell(r.amount.toFixed(2)),
      ].join(","),
    );
  }

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="idbcj-koleksyon-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
