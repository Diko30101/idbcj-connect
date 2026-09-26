import type { SupabaseClient } from "@supabase/supabase-js";
import { monthDateRange } from "@/lib/abuluyan";
import { monthLabel } from "@/lib/finance";
import type { PasalamatType } from "@/lib/giving";
import type { ResiboAbuluyanWeek, ResiboGivingRow, ResiboPasalamatRow } from "@/lib/resibo";

// Buwanang Resibo ng Kaanib (per-member, per-buwan) para sa Local Finance Ministry.
// - Abuluyan: lingguhang total ng LOKAL sa buwan (walang per-member na tala ng abuloy)
// - Ambagan / Tulong sa Aral / Pasalamat: per-member records ng napiling kaanib
// Lahat ay NAIPADALANG (submitted) records lang. Ang RLS ang huling harang.
export type KaanibResiboSummary = {
  buwan: string; // YYYY-MM
  monthLabel: string;
  localId: string;
  localName: string;
  memberId: string;
  memberName: string;
  generatedLabel: string;
  abuluyan: ResiboAbuluyanWeek[];
  abuluyanTotal: number;
  ambagan: ResiboGivingRow[];
  ambaganTotal: number;
  tulong: ResiboGivingRow[];
  tulongTotal: number;
  pasalamat: ResiboPasalamatRow[];
  pasalamatTotal: number;
  memberTotal: number; // kabuuan ng per-member na handog (ambagan + tulong + pasalamat)
  grandTotal: number; // kasama ang abuluyan ng lokal
  submittedCount: number;
};

export async function getKaanibResiboSummary(
  supabase: SupabaseClient,
  localId: string,
  localName: string,
  memberId: string,
  memberName: string,
  buwan: string,
): Promise<KaanibResiboSummary> {
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
      .select("date_received, amount, notes")
      .eq("local_id", localId)
      .eq("member_id", memberId)
      .eq("status", "submitted")
      .eq("period_month", first)
      .order("date_received", { ascending: true }),
    supabase
      .from("tulong_klase_records")
      .select("date_received, amount, notes")
      .eq("local_id", localId)
      .eq("member_id", memberId)
      .eq("status", "submitted")
      .eq("period_month", first)
      .order("date_received", { ascending: true }),
    supabase
      .from("pasalamat_records")
      .select("type, date, amount, notes")
      .eq("local_id", localId)
      .eq("member_id", memberId)
      .eq("status", "submitted")
      .gte("date", first)
      .lt("date", firstNext)
      .order("date", { ascending: true }),
  ]);

  const abuluyan = ((abuluyanRes.data ?? []) as { service_date: string; total_amount: unknown }[]).map((r) => ({
    serviceDate: r.service_date,
    amount: r.total_amount === null ? 0 : Number(r.total_amount),
  }));

  type GivingRow = { date_received: string; amount: unknown; notes: string | null };
  const toGiving = (rows: GivingRow[]): ResiboGivingRow[] =>
    rows.map((r) => ({
      memberId,
      memberName,
      date: r.date_received,
      amount: Number(r.amount),
      notes: r.notes,
    }));

  const ambagan = toGiving(((ambaganRes.data ?? []) as GivingRow[]));
  const tulong = toGiving(((tulongRes.data ?? []) as GivingRow[]));
  const pasalamat = ((pasalamatRes.data ?? []) as { type: PasalamatType; date: string; amount: unknown; notes: string | null }[]).map(
    (r) => ({
      memberId,
      memberName,
      type: r.type,
      date: r.date,
      amount: Number(r.amount),
      notes: r.notes,
    }),
  );

  const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0);
  const abuluyanTotal = sum(abuluyan.map((w) => w.amount));
  const ambaganTotal = sum(ambagan.map((r) => r.amount));
  const tulongTotal = sum(tulong.map((r) => r.amount));
  const pasalamatTotal = sum(pasalamat.map((r) => r.amount));
  const memberTotal = ambaganTotal + tulongTotal + pasalamatTotal;

  const generatedLabel = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return {
    buwan,
    monthLabel: monthLabel(buwan),
    localId,
    localName,
    memberId,
    memberName,
    generatedLabel,
    abuluyan,
    abuluyanTotal,
    ambagan,
    ambaganTotal,
    tulong,
    tulongTotal,
    pasalamat,
    pasalamatTotal,
    memberTotal,
    grandTotal: abuluyanTotal + memberTotal,
    submittedCount: abuluyan.length + ambagan.length + tulong.length + pasalamat.length,
  };
}
