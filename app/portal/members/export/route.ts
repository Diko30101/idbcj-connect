import { NextResponse } from "next/server";
import { getPortalContext } from "@/lib/portal";

const COLUMNS = [
  "full_name",
  "username",
  "category",
  "email",
  "phone_number",
  "city",
  "birthday",
  "role",
  "status",
  "baptism_status",
  "baptism_date",
  "member_since",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;

// Iwas CSV injection (mga cell na nagsisimula sa = + - @)
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const { supabase, profile } = await getPortalContext();
  if (profile.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS.join(","))
    .order("full_name", { ascending: true });
  if (error) return new NextResponse("Error", { status: 500 });

  const lines = [COLUMNS.join(",")];
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    lines.push(COLUMNS.map((c) => cell(row[c])).join(","));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="idbcj-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
