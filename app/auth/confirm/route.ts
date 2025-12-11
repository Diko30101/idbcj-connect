import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers"; // Added this import

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    // FIX: Pass cookies to createClient
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // --- THE FIX: Redirect Password Resets ---
      if (type === "recovery") {
        const url = request.nextUrl.clone();
        url.pathname = "/reset-password";
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        return NextResponse.redirect(url);
      }

      // Normal Login / Sign Up confirmation
      const url = request.nextUrl.clone();
      url.pathname = next;
      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
      return NextResponse.redirect(url);
    }
  }

  // If error, redirect to error page
  const url = request.nextUrl.clone();
  url.pathname = "/auth/auth-code-error";
  return NextResponse.redirect(url);
}