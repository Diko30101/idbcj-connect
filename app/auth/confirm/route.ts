import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. Look for BOTH types of verification
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  
  const next = searchParams.get("next") ?? "/dashboard";

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // CASE A: It is a PKCE Code (Most likely what you are getting)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If the URL says it's for recovery, go to reset password
      // (We check the original request URL for hints, or default to checking if we are logged in)
      const isRecovery = request.url.includes("type=recovery") || next === "/reset-password";
      
      if (isRecovery) {
         return NextResponse.redirect(new URL("/reset-password", request.url));
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // CASE B: It is a Token Hash (The older style)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", request.url));
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If we got here, something failed. Redirect to error page.
  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}