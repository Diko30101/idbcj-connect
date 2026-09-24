import type { SupabaseClient } from "@supabase/supabase-js";
import { monthDateRange } from "@/lib/abuluyan";
import { monthLabel } from "@/lib/finance";
import type { PasalamatType } from "@/lib/giving";
import type { ResiboSummary } from "@/lib/resibo";

// Kumukuha ng mga NAIPADALANG (submitted) record ng apat na kategorya para sa isang
// lokal at isang buwan, at bumubuo ng ResiboSummary. Ibinabahagi ng pahina at ng
// send action. Ang RLS ang huling harang: nakikita lang ang pinapayagan ng role.
export async function getResiboSummary(
  supabase: SupabaseClient,
  localId: string,
  localName: string,
  buwan: string,
): Promise<ResiboSummary> {
  const { first, firstNext } = monthDateRange(buwan);

  const [abuluyanRes, ambaganRes, tulongRes, pasalamatRes] = await Promise.all([
    supabase
      .from("abuluyan_totals")
      .select("service_date, total_amount")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .gte("service_date", first)
      .lt("service_date", firstNext)
      .order("service_date", { ascending: true }),
    supabase
      .from("ambagan_records")
      .select("member_id, date_received, amount, notes")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .eq("period_month", first)
      .order("date_received", { ascending: true }),
    supabase
      .from("tulong_klase_records")
      .select("member_id, date_received, amount, notes")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .eq("period_month", first)
      .order("date_received", { ascending: true }),
    supabase
      .from("pasalamat_records")
      .select("member_id, type, date, amount, notes")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .gte("date", first)
      .lt("date", firstNext)
      .order("date", { ascending: true }),
  ]);

  const abuluyan = ((abuluyanRes.data ?? []) as { service_date: string; total_amount: unknown }[]).map((r) => ({
    serviceDate: r.service_date,
    amount: r.total_amount === null ? 0 : Number(r.total_amount),
  }));

  type GivingRow = { member_id: string; date_received: string; amount: unknown; notes: string | null };
  const toGiving = (rows: GivingRow[], names: Record<string, string>) =>
    rows.map((r) => ({
      memberId: r.member_id,
      memberName: names[r.member_id] ?? "Hindi kilalang kaanib",
      date: r.date_received,
      amount: Number(r.amount),
      notes: r.notes,
    }));

  const ambaganRows = (ambaganRes.data ?? []) as GivingRow[];
  const tulongRows = (tulongRes.data ?? []) as GivingRow[];
  const pasalamatRows = (pasalamatRes.data ?? []) as {
    member_id: string;
    type: PasalamatType;
    date: string;
    amount: unknown;
    notes: string | null;
  }[];

  const memberIds = [...new Set([...ambaganRows, ...tulongRows, ...pasalamatRows].map((r) => r.member_id))];
  const names: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data } = await supabase.rpc("member_display_names", { p_ids: memberIds });
    for (const n of (data ?? []) as { member_id: string; full_name: string }[]) names[n.member_id] = n.full_name;
  }

  const ambagan = toGiving(ambaganRows, names);
  const tulong = toGiving(tulongRows, names);
  const pasalamat = pasalamatRows.map((r) => ({
    memberId: r.member_id,
    memberName: names[r.member_id] ?? "Hindi kilalang kaanib",
    type: r.type,
    date: r.date,
    amount: Number(r.amount),
    notes: r.notes,
  }));

  const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0);
  const abuluyanTotal = sum(abuluyan.map((w) => w.amount));
  const ambaganTotal = sum(ambagan.map((r) => r.amount));
  const tulongTotal = sum(tulong.map((r) => r.amount));
  const pasalamatTotal = sum(pasalamat.map((r) => r.amount));

  const generatedLabel = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return {
    buwan,
    monthLabel: monthLabel(buwan),
    localId,
    localName,
    generatedLabel,
    abuluyan,
    abuluyanTotal,
    ambagan,
    ambaganTotal,
    tulong,
    tulongTotal,
    pasalamat,
    pasalamatTotal,
    grandTotal: abuluyanTotal + ambaganTotal + tulongTotal + pasalamatTotal,
    submittedCount: abuluyan.length + ambagan.length + tulong.length + pasalamat.length,
  };
}
