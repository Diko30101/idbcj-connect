"use server";

import { revalidatePath } from "next/cache";
import { requireTulongFinancialAccess, back } from "@/lib/portal";

const BASE = "/portal/finance/tulong-financial";

function parseAmount(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function parseDate(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Magtala ng bagong hiram (active member lang).
export async function createTulongLoan(fd: FormData): Promise<never> {
  const { supabase, profile } = await requireTulongFinancialAccess();
  const memberId = String(fd.get("member_id") ?? "").trim();
  const amount = parseAmount(fd.get("amount"));
  const dateBorrowed = parseDate(fd.get("date_borrowed"));
  const targetReturn = parseDate(fd.get("target_return_date"));
  const notes = String(fd.get("notes") ?? "").trim();

  if (!memberId) back(BASE, "error", "Pumili ng kaanib.");
  if (amount === null) back(BASE, "error", "Maglagay ng wastong halagang hiniram.");
  if (!dateBorrowed) back(BASE, "error", "Maglagay ng petsa ng paghiram.");

  const { data: member } = await supabase
    .from("members")
    .select("id, local_id, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) back(BASE, "error", "Hindi nakita ang kaanib.");
  if ((member as any).status !== "Active")
    back(BASE, "error", "Active na kaanib lang ang maaaring humiram.");

  const { error } = await supabase.from("tulong_financial_loans").insert({
    member_id: memberId,
    local_id: (member as any).local_id ?? null,
    amount,
    date_borrowed: dateBorrowed,
    target_return_date: targetReturn,
    notes: notes || null,
    recorded_by: profile.id,
  });
  if (error) back(BASE, "error", "Hindi naitala ang hiram. Subukan ulit.");

  revalidatePath(BASE);
  back(BASE, "ok", "Naitala ang hiram.");
}

// Magtala ng bayad (installment) sa isang hiram.
export async function addTulongPayment(fd: FormData): Promise<never> {
  const { supabase, profile } = await requireTulongFinancialAccess();
  const loanId = String(fd.get("loan_id") ?? "").trim();
  const amount = parseAmount(fd.get("amount"));
  const datePaid = parseDate(fd.get("date_paid"));
  const notes = String(fd.get("notes") ?? "").trim();

  if (!loanId) back(BASE, "error", "Pumili ng hiram na babayaran.");
  if (amount === null) back(BASE, "error", "Maglagay ng wastong halaga ng bayad.");
  if (!datePaid) back(BASE, "error", "Maglagay ng petsa ng bayad.");

  const { data: loan } = await supabase
    .from("tulong_financial_loans")
    .select("id, amount, tulong_financial_payments(amount)")
    .eq("id", loanId)
    .maybeSingle();
  if (!loan) back(BASE, "error", "Hindi nakita ang hiram.");

  const paid = ((loan as any).tulong_financial_payments ?? []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0,
  );
  const balance = Math.round((Number((loan as any).amount) - paid) * 100) / 100;
  if (balance <= 0) back(BASE, "error", "Bayad na ang hiraming ito.");
  if (amount > balance)
    back(BASE, "error", `Ang bayad ay lumampas sa balanse (${balance.toFixed(2)}).`);

  const { error } = await supabase.from("tulong_financial_payments").insert({
    loan_id: loanId,
    amount,
    date_paid: datePaid,
    notes: notes || null,
    recorded_by: profile.id,
  });
  if (error) back(BASE, "error", "Hindi naitala ang bayad. Subukan ulit.");

  revalidatePath(BASE);
  back(BASE, "ok", "Naitala ang bayad.");
}
