import { NextResponse } from "next/server";

// Daily keep-alive for the Supabase Free plan.
// Vercel Cron calls this route once a day (see vercel.json). It reads one row
// from public.keep_alive so the database sees regular activity and the Free
// project is not paused for inactivity. It only reads; it never writes.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Optional protection: if CRON_SECRET is set in Vercel, Vercel Cron sends it
  // automatically as "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "missing Supabase environment variables" },
      { status: 500 },
    );
  }

  // New-style publishable keys ("sb_...") are not JWTs, so send them only in
  // the apikey header. Older anon keys (JWT) are also sent as a Bearer token.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_")) {
    headers.Authorization = `Bearer ${key}`;
  }

  try {
    const res = await fetch(`${url}/rest/v1/keep_alive?select=id&limit=1`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, supabaseStatus: res.status },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, error: "could not reach Supabase" },
      { status: 500 },
    );
  }
}
