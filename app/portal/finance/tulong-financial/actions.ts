"use server";

import { revalidatePath } from "next/cache";
import { requireTulongFinancialAccess, back } from "@/lib/portal";

const BASE = "/portal/finance/tulong-financial";

// Saan babalik pagkatapos ng action: ang bagong Tulong Financial portal
// (/tulong-financial/finance) o ang main portal page. Default: main portal.
function returnTo(fd: FormData): string {
  const r = String(fd.get("return_to") ?? "").trim();
  if (r === BASE || r === "/tulong-financial/finance") return r;
  return BASE;
}

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
  const ret = returnTo(fd);
  const memberId = String(fd.get("member_id") ?? "").trim();
  const amount = parseAmount(fd.get("amount"));
  const dateBorrowed = parseDate(fd.get("date_borrowed"));
  const targetReturn = parseDate(fd.get("target_return_date"));
  const notes = String(fd.get("notes") ?? "").trim();

  if (!memberId) back(ret, "error", "Pumili ng kaanib.");
  if (amount === null) back(ret, "error", "Maglagay ng wastong halagang hiniram.");
  if (!dateBorrowed) back(ret, "error", "Maglagay ng petsa ng paghiram.");

  const { data: member } = await supabase
    .from("members")
    .select("id, local_id, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) back(ret, "error", "Hindi nakita ang kaanib.");
  if ((member as any).status !== "Active")
    back(ret, "error", "Active na kaanib lang ang maaaring humiram.");

  const { error } = await supabase.from("tulong_financial_loans").insert({
    member_id: memberId,
    local_id: (member as any).local_id ?? null,
    amount,
    date_borrowed: dateBorrowed,
    target_return_date: targetReturn,
    notes: notes || null,
    recorded_by: profile.id,
  });
  if (error) back(ret, "error", "Hindi naitala ang hiram. Subukan ulit.");

  revalidatePath(ret);
  back(ret, "ok", "Naitala ang hiram.");
}

// Magtala ng bayad (installment) sa isang hiram.
export async function addTulongPayment(fd: FormData): Promise<never> {
  const { supabase, profile } = await requireTulongFinancialAccess();
  const ret = returnTo(fd);
  const loanId = String(fd.get("loan_id") ?? "").trim();
  const amount = parseAmount(fd.get("amount"));
  const datePaid = parseDate(fd.get("date_paid"));
  const notes = String(fd.get("notes") ?? "").trim();

  if (!loanId) back(ret, "error", "Pumili ng hiram na babayaran.");
  if (amount === null) back(ret, "error", "Maglagay ng wastong halaga ng bayad.");
  if (!datePaid) back(ret, "error", "Maglagay ng petsa ng bayad.");

  const { data: loan } = await supabase
    .from("tulong_financial_loans")
    .select("id, amount, tulong_financial_payments(amount)")
    .eq("id", loanId)
    .maybeSingle();
  if (!loan) back(ret, "error", "Hindi nakita ang hiram.");

  const paid = ((loan as any).tulong_financial_payments ?? []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0,
  );
  const balance = Math.round((Number((loan as any).amount) - paid) * 100) / 100;
  if (balance <= 0) back(ret, "error", "Bayad na ang hiraming ito.");
  if (amount > balance)
    back(ret, "error", `Ang bayad ay lumampas sa balanse (${balance.toFixed(2)}).`);

  const { error } = await supabase.from("tulong_financial_payments").insert({
    loan_id: loanId,
    amount,
    date_paid: datePaid,
    notes: notes || null,
    recorded_by: profile.id,
  });
  if (error) back(ret, "error", "Hindi naitala ang bayad. Subukan ulit.");

  revalidatePath(ret);
  back(ret, "ok", "Naitala ang bayad.");
}

// ---------------------------------------------------------------------------
// Borrower logins (username/password) -- hinahawakan ng Finance Ministry.
// ---------------------------------------------------------------------------

function validUsername(u: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(u);
}

async function hashPassword(supabase: any, password: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("tulong_hash_password", { p_password: password });
  if (error || !data) return null;
  return data as string;
}

// Gumawa ng login para sa isang active member.
export async function createBorrowerLogin(fd: FormData): Promise<never> {
  const { supabase, profile } = await requireTulongFinancialAccess();
  const ret = returnTo(fd);
  const memberId = String(fd.get("member_id") ?? "").trim();
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (!memberId) back(ret, "error", "Pumili ng kaanib.");
  if (!validUsername(username))
    back(ret, "error", "Ang username ay 3-30 characters: letra, numero, tuldok, gitling o underscore lang.");
  if (password.length < 6) back(ret, "error", "Ang password ay hindi bababa sa 6 na characters.");

  const { data: member } = await supabase
    .from("members")
    .select("id, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || (member as any).status !== "Active")
    back(ret, "error", "Active na kaanib lang ang maaaring bigyan ng login.");

  const { data: existing } = await supabase
    .from("tulong_financial_borrowers")
    .select("id")
    .or(`member_id.eq.${memberId},username.ilike.${username}`)
    .limit(1);
  if ((existing ?? []).length > 0)
    back(ret, "error", "May login na ang kaanib na ito o gamit na ang username.");

  const passwordHash = await hashPassword(supabase, password);
  if (!passwordHash) back(ret, "error", "Hindi nalikha ang password. Subukan ulit.");

  const { error } = await supabase.from("tulong_financial_borrowers").insert({
    member_id: memberId,
    username,
    password_hash: passwordHash,
    created_by: profile.id,
  });
  if (error) back(ret, "error", "Hindi nalikha ang login. Subukan ulit.");

  revalidatePath(ret);
  back(ret, "ok", `Nalikha ang login para sa kaanib (username: ${username}).`);
}

// I-reset ang password ng isang borrower (pinapatay din ang lahat ng session niya).
export async function resetBorrowerPassword(fd: FormData): Promise<never> {
  const { supabase } = await requireTulongFinancialAccess();
  const ret = returnTo(fd);
  const borrowerId = String(fd.get("borrower_id") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!borrowerId || password.length < 6)
    back(ret, "error", "Ang bagong password ay hindi bababa sa 6 na characters.");

  const passwordHash = await hashPassword(supabase, password);
  if (!passwordHash) back(ret, "error", "Hindi na-reset ang password. Subukan ulit.");

  const { error } = await supabase
    .from("tulong_financial_borrowers")
    .update({ password_hash: passwordHash })
    .eq("id", borrowerId);
  if (error) back(ret, "error", "Hindi na-reset ang password. Subukan ulit.");
  await supabase.from("tulong_financial_sessions").delete().eq("borrower_id", borrowerId);

  revalidatePath(ret);
  back(ret, "ok", "Na-reset ang password. Kailangang mag-login ulit ang kaanib.");
}

// I-activate o i-deactivate ang login ng isang borrower.
export async function setBorrowerActive(fd: FormData): Promise<never> {
  const { supabase } = await requireTulongFinancialAccess();
  const ret = returnTo(fd);
  const borrowerId = String(fd.get("borrower_id") ?? "").trim();
  const active = String(fd.get("active") ?? "") === "true";
  if (!borrowerId) back(ret, "error", "Hindi nakita ang login.");

  const { error } = await supabase
    .from("tulong_financial_borrowers")
    .update({ is_active: active })
    .eq("id", borrowerId);
  if (error) back(ret, "error", "Hindi nabago ang status. Subukan ulit.");
  if (!active) await supabase.from("tulong_financial_sessions").delete().eq("borrower_id", borrowerId);

  revalidatePath(ret);
  back(ret, "ok", active ? "Na-activate ang login." : "Na-deactivate ang login.");
}
