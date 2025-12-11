import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Check if there is a 'next' param, or default to dashboard
  const next = searchParams.get("next") ?? "/dashboard";
  // Check the TYPE of email link (e.g., 'recovery', 'signup', 'invite')
  const type = searchParams.get("type");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Exchange the code for a session (logs the user in)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // --- THE FIX ---
      // If this was a Password Reset link, send them to the reset page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // Otherwise, proceed as normal
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If error, send to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}