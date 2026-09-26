"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "tulong_session";
const BASE = "/tulong-financial";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

async function supa() {
  return createClient(cookies());
}

// Borrower login: username + password (dedicated Tulong Financial credentials,
// itinakda ng Finance Ministry). Ang session ay httpOnly cookie na may 7-araw na bisa.
export async function borrowerLogin(fd: FormData): Promise<never> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const supabase = await supa();

  if (!username || !password) redirect(`${BASE}/login?error=` + encodeURIComponent("Ilagay ang username at password."));

  const { data, error } = await supabase.rpc("tulong_borrower_login", {
    p_username: username,
    p_password: password,
  });
  const token = (data as any)?.token as string | undefined;
  if (error || !token) {
    redirect(`${BASE}/login?error=` + encodeURIComponent("Maling username o password."));
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
  redirect(BASE);
}

export async function borrowerLogout(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect(`${BASE}/login`);
}

export async function getBorrowerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

// Borrower: humiling ng hiram (kailangan aktibo ang account; walang username = walang hiram).
// Ang kahilingan ay makikita ng Finance Ministry at ipapadala sa admin para sa apruba.
export async function submitLoanRequest(fd: FormData): Promise<never> {
  const token = await getBorrowerSessionToken();
  if (!token) redirect(`${BASE}/login`);

  const amount = Number(String(fd.get("amount") ?? "").replace(/,/g, ""));
  const target = String(fd.get("target_return_date") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0)
    redirect(`${BASE}?error=` + encodeURIComponent("Maglagay ng wastong halaga."));

  const supabase = await supa();
  const { data, error } = await supabase.rpc("tulong_create_loan_request", {
    p_token: token,
    p_amount: Math.round(amount * 100) / 100,
    p_target_return_date: /^\d{4}-\d{2}-\d{2}$/.test(target) ? target : null,
    p_notes: notes || null,
  });
  if (error || !data)
    redirect(
      `${BASE}?error=` +
        encodeURIComponent("Hindi naipadala ang kahilingan. Maaaring may naghihintay ka pang kahilingan."),
    );
  redirect(`${BASE}?ok=` + encodeURIComponent("Naipadala na ang iyong kahilingan ng hiram. Hintayin ang apruba ng admin."));
}

// Borrower: palitan ang sariling password (kailangan ang kasalukuyang password).
// Ginagamit ito pagkatapos ng unang login gamit ang temporary password.
export async function changeBorrowerPassword(fd: FormData): Promise<never> {
  const token = await getBorrowerSessionToken();
  if (!token) redirect(`${BASE}/login`);

  const current = String(fd.get("current_password") ?? "");
  const next = String(fd.get("new_password") ?? "");
  const confirm = String(fd.get("confirm_password") ?? "");
  if (next.length < 6)
    redirect(`${BASE}?error=` + encodeURIComponent("Ang bagong password ay hindi bababa sa 6 na characters."));
  if (next !== confirm)
    redirect(`${BASE}?error=` + encodeURIComponent("Hindi magkatugma ang bagong password at ang kumpirmasyon."));

  const supabase = await supa();
  const { error } = await supabase.rpc("tulong_borrower_change_password", {
    p_token: token,
    p_current: current,
    p_new: next,
  });
  if (error)
    redirect(`${BASE}?error=` + encodeURIComponent("Hindi napalitan ang password: " + error.message));
  redirect(`${BASE}?ok=` + encodeURIComponent("Napalitan na ang iyong password."));
}
