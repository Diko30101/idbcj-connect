// Pinag-isang pagkuha ng koleksyon para sa Finance menu.
// Ang data ay GALING LAMANG sa apat na pinagmumulan na in-encode ng
// Local Finance Ministry: Abuluyan, Ambagan, Tulong sa Klase Ministeryal,
// at Pasalamat. Ang binibilang lang ay ang mga naipadala na
// (status = "submitted"); hindi kasama ang draft at void.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceCategory } from "./finance";
import type { Locality } from "./locality";

// locals.key -> lumang locality enum (ayon sa migration 008:
// 'batangas' (luma) ay naging locals.key na 'sto_tomas')
export const LOCAL_KEY_TO_LOCALITY: Record<string, Locality> = {
  medina: "medina",
  sto_tomas: "batangas",
  fort_mcmurray: "fort_mcmurray",
  other: "other",
};

export const LOCALITY_TO_LOCAL_KEY: Record<Locality, string> = {
  medina: "medina",
  batangas: "sto_tomas",
  fort_mcmurray: "fort_mcmurray",
  other: "other",
};

export type CollectionRow = {
  month: string; // "01".."12"
  category: FinanceCategory;
  locality: Locality | null;
  localKey: string | null;
  amount: number;
};

type GivingRow = {
  service_date?: string | null;
  date_received?: string | null;
  date?: string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
  local_id?: string | null;
};

// Paged na pagbasa (ang PostgREST ay may limit bawat request).
async function fetchSubmitted(
  supabase: SupabaseClient,
  table: string,
  select: string,
  dateCol: string,
  year: string,
): Promise<GivingRow[]> {
  const out: GivingRow[] = [];
  const PAGE = 1000;
  for (let page = 0; ; page++) {
    const res = (await supabase
      .from(table)
      .select(select)
      .eq("status", "submitted")
      .gte(dateCol, `${year}-01-01`)
      .lt(dateCol, `${Number(year) + 1}-01-01`)
      .range(page * PAGE, page * PAGE + PAGE - 1)) as unknown as { data: GivingRow[] | null };
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// Lahat ng koleksyon sa isang taon, bawat record ginawang CollectionRow.
export async function getYearlyCollections(
  supabase: SupabaseClient,
  year: string,
): Promise<CollectionRow[]> {
  const { data: locals } = await supabase.from("locals").select("id, key");
  const keyById = new Map(((locals ?? []) as { id: string; key: string }[]).map((l) => [l.id, l.key]));

  const [abuluyan, ambagan, tulong, pasalamat] = await Promise.all([
    fetchSubmitted(supabase, "abuluyan_totals", "service_date, total_amount, local_id", "service_date", year),
    fetchSubmitted(supabase, "ambagan_records", "date_received, amount, local_id", "date_received", year),
    fetchSubmitted(supabase, "tulong_klase_records", "date_received, amount, local_id", "date_received", year),
    fetchSubmitted(supabase, "pasalamat_records", "date, amount, local_id", "date", year),
  ]);

  const rows: CollectionRow[] = [];
  const push = (dateStr: unknown, amount: unknown, localId: unknown, category: FinanceCategory) => {
    const mm = String(dateStr ?? "").slice(5, 7);
    if (!/^(0[1-9]|1[0-2])$/.test(mm)) return;
    const localKey = typeof localId === "string" ? (keyById.get(localId) ?? null) : null;
    rows.push({
      month: mm,
      category,
      locality: localKey ? (LOCAL_KEY_TO_LOCALITY[localKey] ?? null) : null,
      localKey,
      amount: Number(amount) || 0,
    });
  };

  for (const r of abuluyan) push(r.service_date, r.total_amount, r.local_id, "abuluyan");
  for (const r of ambagan) push(r.date_received, r.amount, r.local_id, "ambagan");
  for (const r of tulong) push(r.date_received, r.amount, r.local_id, "tulong_sa_aral");
  for (const r of pasalamat) push(r.date, r.amount, r.local_id, "pasalamat");

  return rows;
}

// Buod: key = `${MM}_${category}` -> kabuuan. Kung may localityFilter,
// ang mga row lang ng local na iyon ang isasama.
export function summarizeCollections(
  rows: CollectionRow[],
  localityFilter: Locality | "" = "",
): Map<string, number> {
  const grid = new Map<string, number>();
  for (const r of rows) {
    if (localityFilter && r.locality !== localityFilter) continue;
    const key = `${r.month}_${r.category}`;
    grid.set(key, (grid.get(key) ?? 0) + r.amount);
  }
  return grid;
}
