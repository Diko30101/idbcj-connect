import { NextRequest, NextResponse } from "next/server";
import {
  getPortalContext,
  isFinance,
  FINANCE_MINISTRY_NAME,
  LOCALITY_LABEL,
  FINANCE_CATEGORY_LABEL,
  type Locality,
  type FinanceCategory,
} from "@/lib/portal";

// Iwas CSV injection (mga cell na nagsisimula sa = + - @)
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const { supabase, profile } = await getPortalContext();
  if (!isFinance(profile.role)) {
    const { data } = await supabase.from("ministry_members").select("ministries(name)").eq("profile_id", profile.id);
    const isFinanceMinistryMember = ((data ?? []) as any[]).some((m) => m.ministries?.name === FINANCE_MINISTRY_NAME);
    if (!isFinanceMinistryMember) return new NextResponse("Forbidden", { status: 403 });
  }

  const yearParam = req.nextUrl.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(yearParam) ? yearParam : new Date().getFullYear().toString();

  const { data, error } = await supabase
    .from("financial_records")
    .select("record_month, locality, category, amount, note")
    .gte("record_month", `${year}-01-01`)
    .lt("record_month", `${Number(year) + 1}-01-01`)
    .order("record_month", { ascending: true })
    .order("locality", { ascending: true })
    .order("category", { ascending: true });
  if (error) return new NextResponse("Error", { status: 500 });

  const columns = ["buwan", "lokal", "kategorya", "halaga", "tala"];
  const lines = [columns.join(",")];
  for (const row of (data ?? []) as any[]) {
    lines.push(
      [
        cell(row.record_month.slice(0, 7)),
        cell(LOCALITY_LABEL[row.locality as Locality] ?? row.locality),
        cell(FINANCE_CATEGORY_LABEL[row.category as FinanceCategory] ?? row.category),
        cell(Number(row.amount).toFixed(2)),
        cell(row.note ?? ""),
      ].join(","),
    );
  }

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="idbcj-financial-records-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
