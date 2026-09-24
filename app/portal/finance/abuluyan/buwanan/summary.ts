import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMonthlySummary, monthDateRange, type MonthlySummary } from "@/lib/abuluyan";

// Sakop ng ulat: church-wide/Admin (lahat ng local) o Local Finance (sariling local lang)
export type AbuluyanSummaryScope = { wide: true } | { wide: false; localId: string; localName: string };

// Kumukuha ng mga NAIPADALANG (submitted) Abuluyan record para sa isang buwan at
// bumubuo ng MonthlySummary. Ibinabahagi ng pahina, ng send action, at ng cron.
export async function getMonthlySummary(
  supabase: SupabaseClient,
  scope: AbuluyanSummaryScope,
  buwan: string,
): Promise<{ summary: MonthlySummary; submittedCount: number }> {
  let locals: { id: string; name: string }[];
  if (scope.wide) {
    const { data } = await supabase.from("locals").select("id, name").order("name");
    locals = (data ?? []) as { id: string; name: string }[];
  } else {
    locals = [{ id: scope.localId, name: scope.localName }];
  }

  const { first, firstNext } = monthDateRange(buwan);
  const localIds = locals.map((l) => l.id);
  const { data } = localIds.length
    ? await supabase
        .from("abuluyan_totals")
        .select("local_id, service_date, total_amount")
        .eq("status", "submitted")
        .gte("service_date", first)
        .lt("service_date", firstNext)
        .in("local_id", localIds)
        .order("service_date", { ascending: true })
    : { data: [] as unknown[] };

  const records = ((data ?? []) as { local_id: string; service_date: string; total_amount: unknown }[]).map((r) => ({
    local_id: r.local_id,
    service_date: r.service_date,
    total_amount: r.total_amount === null ? null : Number(r.total_amount),
  }));

  const generatedLabel = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const summary = buildMonthlySummary(records, locals, buwan, generatedLabel);
  return { summary, submittedCount: records.length };
}
