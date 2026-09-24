import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceMinistryRecipientIds } from "@/lib/portal";
import {
  weekLabel,
  weeklyResiboText,
  type ResiboAbuluyanWeek,
  type ResiboGivingRow,
  type ResiboPasalamatRow,
  type WeeklyLocalResibo,
} from "@/lib/resibo";
import type { PasalamatType } from "@/lib/giving";

// Awtomatikong pagpapadala ng Lingguhang Resibo sa mga miyembro ng Finance
// Ministry tuwing Lunes, 8:00 AM Edmonton (14:00 UTC) — para sa NAKARAANG
// linggo (Lunes–Linggo, oras ng Edmonton). Tingnan ang vercel.json.
export const dynamic = "force-dynamic";

// "Ngayon" sa Edmonton bilang YYYY-MM-DD
function edmontonToday(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Nakaraang linggo (Lunes–Linggo) sa Edmonton. Kapag Lunes tumakbo ang cron,
// ito ang 7 araw bago ang araw na ito.
function lastWeekRange(now = new Date()): { start: string; end: string } {
  const today = edmontonToday(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0=Linggo … 6=Sabado
  const daysSinceMonday = (dow + 6) % 7;
  const start = addDays(today, -daysSinceMonday - 7);
  return { start, end: addDays(start, 6) };
}

export async function GET(request: Request) {
  // Tulad ng keep-alive: kung may CRON_SECRET, awtomatikong ipinapadala ito ng
  // Vercel Cron bilang "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "missing Supabase environment variables" }, { status: 500 });
  }

  const { start, end } = lastWeekRange();
  const endNext = addDays(end, 1);

  // Walang user session sa cron, kaya service-role client ang gamit (bypass RLS);
  // ang resibo ay church-wide (lahat ng lokal), puro NAIPADALANG record lang.
  const { data: localsData } = await supabase.from("locals").select("id, name").order("name");
  const localList = ((localsData ?? []) as { id: string; name: string }[]).filter((l) => l.id && l.name);
  const localNames: Record<string, string> = Object.fromEntries(localList.map((l) => [l.id, l.name]));

  const [abuluyanRes, ambaganRes, tulongRes, pasalamatRes] = await Promise.all([
    supabase
      .from("abuluyan_totals")
      .select("local_id, service_date, total_amount")
      .eq("status", "submitted")
      .gte("service_date", start)
      .lt("service_date", endNext),
    supabase
      .from("ambagan_records")
      .select("local_id, member_id, date_received, amount, notes")
      .eq("status", "submitted")
      .gte("date_received", start)
      .lt("date_received", endNext),
    supabase
      .from("tulong_klase_records")
      .select("local_id, member_id, date_received, amount, notes")
      .eq("status", "submitted")
      .gte("date_received", start)
      .lt("date_received", endNext),
    supabase
      .from("pasalamat_records")
      .select("local_id, member_id, type, date, amount, notes")
      .eq("status", "submitted")
      .gte("date", start)
      .lt("date", endNext),
  ]);

  type AbuluyanRow = { local_id: string; service_date: string; total_amount: unknown };
  type GivingRow = { local_id: string; member_id: string; date_received: string; amount: unknown; notes: string | null };
  type PasalamatRow = {
    local_id: string;
    member_id: string;
    type: PasalamatType;
    date: string;
    amount: unknown;
    notes: string | null;
  };

  const abuluyanRows = ((abuluyanRes.data ?? []) as AbuluyanRow[]).filter((r) => r.local_id);
  const ambaganRows = ((ambaganRes.data ?? []) as GivingRow[]).filter((r) => r.local_id);
  const tulongRows = ((tulongRes.data ?? []) as GivingRow[]).filter((r) => r.local_id);
  const pasalamatRows = ((pasalamatRes.data ?? []) as PasalamatRow[]).filter((r) => r.local_id);

  // Pangalan ng mga kaanib
  const memberIds = [...new Set([...ambaganRows, ...tulongRows, ...pasalamatRows].map((r) => r.member_id))];
  const names: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data } = await supabase.rpc("member_display_names", { p_ids: memberIds });
    for (const n of (data ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
  }
  const memberName = (id: string) => names[id] ?? "Hindi kilalang kaanib";

  const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0);
  const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  // Pangkatin kada lokal; lokal na walang record sa linggong ito ay hindi isasama
  const perLocal = new Map<string, WeeklyLocalResibo>();
  const ensure = (localId: string): WeeklyLocalResibo => {
    let s = perLocal.get(localId);
    if (!s) {
      s = {
        localId,
        localName: localNames[localId] ?? "Hindi kilalang lokal",
        abuluyan: [], abuluyanTotal: 0,
        ambagan: [], ambaganTotal: 0,
        tulong: [], tulongTotal: 0,
        pasalamat: [], pasalamatTotal: 0,
        grandTotal: 0, submittedCount: 0,
      };
      perLocal.set(localId, s);
    }
    return s;
  };

  for (const r of abuluyanRows) {
    const s = ensure(r.local_id);
    const w: ResiboAbuluyanWeek = {
      serviceDate: r.service_date,
      amount: r.total_amount === null ? 0 : Number(r.total_amount),
    };
    s.abuluyan.push(w);
  }
  const pushGiving = (rows: GivingRow[], key: "ambagan" | "tulong") => {
    for (const r of rows) {
      const s = ensure(r.local_id);
      const g: ResiboGivingRow = {
        memberId: r.member_id,
        memberName: memberName(r.member_id),
        date: r.date_received,
        amount: Number(r.amount),
        notes: r.notes,
      };
      s[key].push(g);
    }
  };
  pushGiving(ambaganRows, "ambagan");
  pushGiving(tulongRows, "tulong");
  for (const r of pasalamatRows) {
    const s = ensure(r.local_id);
    const p: ResiboPasalamatRow = {
      memberId: r.member_id,
      memberName: memberName(r.member_id),
      type: r.type,
      date: r.date,
      amount: Number(r.amount),
      notes: r.notes,
    };
    s.pasalamat.push(p);
  }

  const summaries: WeeklyLocalResibo[] = [];
  for (const s of perLocal.values()) {
    s.abuluyan.sort((a, b) => (a.serviceDate < b.serviceDate ? -1 : a.serviceDate > b.serviceDate ? 1 : 0));
    s.ambagan.sort(byDate);
    s.tulong.sort(byDate);
    s.pasalamat.sort(byDate);
    s.abuluyanTotal = sum(s.abuluyan.map((w) => w.amount));
    s.ambaganTotal = sum(s.ambagan.map((r) => r.amount));
    s.tulongTotal = sum(s.tulong.map((r) => r.amount));
    s.pasalamatTotal = sum(s.pasalamat.map((r) => r.amount));
    s.grandTotal = s.abuluyanTotal + s.ambaganTotal + s.tulongTotal + s.pasalamatTotal;
    s.submittedCount = s.abuluyan.length + s.ambagan.length + s.tulong.length + s.pasalamat.length;
    if (s.submittedCount > 0) summaries.push(s);
  }
  summaries.sort((a, b) => a.localName.localeCompare(b.localName));

  const totalSubmitted = summaries.reduce((n, s) => n + s.submittedCount, 0);
  if (totalSubmitted === 0) return NextResponse.json({ skipped: true, week: `${start}_${end}` });

  // Ang tatanggap: mga miyembro ng Finance Ministry (sila ang "Admin" sa sistemang ito)
  const recipientIds = await getFinanceMinistryRecipientIds(supabase);
  if (recipientIds.length === 0)
    return NextResponse.json({ ok: false, error: "no finance ministry members" }, { status: 500 });

  const label = weekLabel(start, end);
  const generatedLabel = edmontonToday(new Date());
  const body = weeklyResiboText(label, generatedLabel, summaries);

  // Walang tao ang nagpadala; ang unang miyembro ng Finance Ministry ang may-akda
  const authorId = recipientIds[0];
  const { data: letter, error } = await supabase
    .from("letters")
    .insert({ subject: `Lingguhang Resibo — ${label}`, created_by: authorId })
    .select("id")
    .single();
  if (error || !letter) return NextResponse.json({ ok: false, error: "letter insert failed" }, { status: 500 });

  const { error: e2 } = await supabase
    .from("letter_recipients")
    .insert(recipientIds.map((id) => ({ letter_id: letter.id, profile_id: id })));
  if (e2) return NextResponse.json({ ok: false, error: "recipients insert failed" }, { status: 500 });

  const { error: e3 } = await supabase
    .from("letter_messages")
    .insert({ letter_id: letter.id, author_id: authorId, body });
  if (e3) return NextResponse.json({ ok: false, error: "message insert failed" }, { status: 500 });

  return NextResponse.json({ sent: true, week: `${start}_${end}`, locals: summaries.length, records: totalSubmitted });
}
