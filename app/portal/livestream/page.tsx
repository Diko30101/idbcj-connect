import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { requirePortalAccess } from "@/lib/portal";
import { LivestreamPlayer } from "@/components/livestream-player";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Live Stream | IDBCJ",
  description: "Watch the IDBCJ Sunday livestream live. Members only.",
};

const DEFAULT_CHANNEL_ID = "UC2w4L4NiIVrcGiE0c1XW-Hw";

async function getSetting(key: string): Promise<string> {
  const { getSupabase } = await import("@/lib/portal");
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .single();
  return (data?.value ?? "").trim();
}

async function saveLivestreamSettings(formData: FormData) {
  "use server";
  const { requireRoles, str, getSupabase } = await import("@/lib/portal");
  const ctx = await requireRoles(["admin"]);
  const videoId = str(formData, "video_id").trim();
  const match = videoId.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  const cleanId = match ? match[1] : videoId;
  if (cleanId && !/^[A-Za-z0-9_-]{11}$/.test(cleanId)) {
    throw new Error("Hindi valid ang YouTube video ID.");
  }
  const backupUrl = str(formData, "backup_url").trim();
  if (backupUrl && !/^https?:\/\/.+/.test(backupUrl)) {
    throw new Error("Hindi valid ang backup URL.");
  }
  const channelId = str(formData, "channel_id").trim() || DEFAULT_CHANNEL_ID;
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    throw new Error("Hindi valid ang YouTube channel ID.");
  }
  const liveVideoId = str(formData, "live_video_id").trim();
  const liveMatch = liveVideoId.match(/(?:v=|youtu\.be\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  const cleanLiveId = liveMatch ? liveMatch[1] : liveVideoId;
  if (cleanLiveId && !/^[A-Za-z0-9_-]{11}$/.test(cleanLiveId)) {
    throw new Error("Hindi valid ang live video ID.");
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from("site_settings").upsert(
    [
      { key: "livestream_fallback_video_id", value: cleanId, updated_by: ctx.profile.id },
      { key: "livestream_backup_url", value: backupUrl, updated_by: ctx.profile.id },
      { key: "livestream_channel_id", value: channelId, updated_by: ctx.profile.id },
      { key: "livestream_live_video_id", value: cleanLiveId, updated_by: ctx.profile.id },
    ],
    { onConflict: "key" }
  );
  if (error) throw new Error("Hindi na-save: " + error.message);
  revalidatePath("/portal/livestream");
}

export default async function PortalLivestreamPage() {
  const ctx = await requirePortalAccess();
  const fallbackVideoId = await getSetting("livestream_fallback_video_id");
  const backupUrl = await getSetting("livestream_backup_url");
  const channelId = (await getSetting("livestream_channel_id")) || DEFAULT_CHANNEL_ID;
  const liveVideoId = await getSetting("livestream_live_video_id");
  const isAdmin = ctx.profile.role === "admin";

  // I-record ang attendance ng member (isang beses bawat araw)
  const { getSupabase } = await import("@/lib/portal");
  const supabase = await getSupabase();
  await supabase.from("livestream_attendance").upsert(
    { profile_id: ctx.profile.id, service_date: new Date().toISOString().split("T")[0] },
    { onConflict: "profile_id,service_date", ignoreDuplicates: true }
  );

  // Para sa admin: kunin ang attendance ngayong araw
  let todayAttendance: { full_name: string; attended_at: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("livestream_attendance")
      .select("attended_at, profiles!inner(full_name)")
      .eq("service_date", new Date().toISOString().split("T")[0])
      .order("attended_at", { ascending: true });
    todayAttendance = (data || []).map((r: any) => ({
      full_name: r.profiles.full_name || "Hindi kilala",
      attended_at: r.attended_at,
    }));
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-extrabold text-slate-900">Live Stream</h1>
      <p className="mt-2 text-slate-600">
        Mapanood nang live ang ating pagsamba tuwing Linggo.
      </p>
      <div className="mt-6">
        <LivestreamPlayer channelId={channelId} fallbackVideoId={fallbackVideoId || undefined} liveVideoId={liveVideoId || undefined} />
      {liveVideoId && (
        <p className="mt-2 text-center text-sm font-semibold text-red-600">
          ● LIVE ngayon
        </p>
      )}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Kung walang live ngayon, ipinapakita ang pinakahuling video.
      </p>
      {backupUrl && (
        <p className="mt-4 text-center text-sm">
          <a href={backupUrl} target="_blank" rel="noopener noreferrer"
            className="text-emerald-700 underline hover:text-emerald-900">
            Kung hindi gumagana ang video sa itaas, panoorin dito (backup link)
          </a>
        </p>
      )}
      {isAdmin && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">
            Online Attendance ngayong araw ({todayAttendance.length})
          </h2>
          {todayAttendance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Wala pang nanonood ngayon.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {todayAttendance.map((a, i) => (
                <li key={i} className="text-sm text-slate-700">
                  {a.full_name}
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(a.attended_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {isAdmin && (
        <form action={saveLivestreamSettings}
          className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Admin: Livestream Settings</h2>
          <div>
            <label className="text-xs font-semibold text-slate-600">YouTube Channel ID</label>
            <p className="mt-1 text-xs text-slate-500">
              Ang channel ID ng IDBCJ YouTube channel (nagsisimula sa UC).
            </p>
            <input type="text" name="channel_id"
              placeholder="Hal. UC2w4L4NiIVrcGiE0c1XW-Hw"
              defaultValue={channelId}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Live Video ID (kapag nag-live)</label>
            <p className="mt-1 text-xs text-slate-500">
              I-paste ang YouTube live URL kapag nagsimula ang livestream para agad itong lumabas.
              Burahin kapag tapos na ang live para bumalik sa awtomatiko.
            </p>
            <input type="text" name="live_video_id"
              placeholder="Hal. https://www.youtube.com/watch?v=xxxx o blangko kung walang live"
              defaultValue={liveVideoId}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Fallback YouTube Video</label>
            <p className="mt-1 text-xs text-slate-500">
              I-paste ang YouTube video ID o buong URL ng video na ipapakita kapag walang live.
            </p>
            <input type="text" name="video_id"
              placeholder="Hal. mrSxVztHbZY o https://youtu.be/mrSxVztHbZY"
              defaultValue={fallbackVideoId}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Backup Stream Link (Restream)</label>
            <p className="mt-1 text-xs text-slate-500">
              I-paste ang Restream share link URL bilang backup.
            </p>
            <input type="url" name="backup_url"
              placeholder="Hal. https://app.restream.io/s/xxxx-xxxx-xxxx-xxxx"
              defaultValue={backupUrl}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            I-save
          </button>
        </form>
      )}
    </div>
  );
}
