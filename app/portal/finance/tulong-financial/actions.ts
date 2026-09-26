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
