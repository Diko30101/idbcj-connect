import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if user is actually logged in
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await supabase.auth.signOut();
  }

  // --- THE FIX: Change "/sign-in" to "/login" ---
  return NextResponse.redirect(new URL("/auth/login", request.url), {
    status: 302,
  });
}