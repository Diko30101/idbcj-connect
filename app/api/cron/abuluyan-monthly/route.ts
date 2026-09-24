import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthlySummaryText, prevMonth } from "@/lib/abuluyan";
import { currentMonthPH, monthLabel } from "@/lib/finance";
import { getMonthlySummary } from "@/app/portal/finance/abuluyan/buwanan/summary";

// Awtomatikong pagpapadala ng Buwanang Ulat ng Abuluyan sa Admin tuwing ika-1
// ng buwan, 8:00 AM Edmonton (14:00 UTC) — para sa NAKARAANG buwan.
// Tingnan ang vercel.json para sa schedule.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Tulad ng keep-alive: kung may CRON_SECRET, awtomatikong ipinapadala ito ng
  // Vercel Cron bilang "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const buwan = prevMonth(currentMonthPH());

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "missing Supabase environment variables" }, { status: 500 });
  }

  // Walang user session sa cron, kaya service-role client ang gamit (bypass RLS);
  // ang ulat ay church-wide (lahat ng local), puro NAIPADALANG record lang.
  const { summary, submittedCount } = await getMonthlySummary(supabase, { wide: true }, buwan);
  if (submittedCount === 0) return NextResponse.json({ skipped: true, month: buwan });

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin").eq("status", "active");
  const recipientIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);
  if (recipientIds.length === 0) return NextResponse.json({ ok: false, error: "no active admins" }, { status: 500 });

  // Walang tao ang nagpadala; ang unang Admin ang ilalagay na may-akda ng liham
  const authorId = recipientIds[0];
  const { data: letter, error } = await supabase
    .from("letters")
    .insert({ subject: `Buwanang Ulat ng Abuluyan — ${monthLabel(buwan)}`, created_by: authorId })
    .select("id")
    .single();
  if (error || !letter) return NextResponse.json({ ok: false, error: "letter insert failed" }, { status: 500 });

  const { error: e2 } = await supabase
    .from("letter_recipients")
    .insert(recipientIds.map((id) => ({ letter_id: letter.id, profile_id: id })));
  if (e2) return NextResponse.json({ ok: false, error: "recipients insert failed" }, { status: 500 });

  const { error: e3 } = await supabase
    .from("letter_messages")
    .insert({ letter_id: letter.id, author_id: authorId, body: monthlySummaryText(summary) });
  if (e3) return NextResponse.json({ ok: false, error: "message insert failed" }, { status: 500 });

  return NextResponse.json({ sent: true, month: buwan });
}
