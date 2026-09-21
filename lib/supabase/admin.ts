import { createClient } from "@supabase/supabase-js";

// PARA SA SERVER LANG. Ang SUPABASE_SERVICE_ROLE_KEY ay hindi dapat lumabas sa browser,
// kaya walang "NEXT_PUBLIC_" sa pangalan nito. Ilagay ito sa .env.local at sa Vercel.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_SERVICE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
