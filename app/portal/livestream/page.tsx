import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { requirePortalAccess } from "@/lib/portal";
import { LivestreamPlayer } from "@/components/livestream-player";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Live Stream | IDBCJ",
  description: "Watch the IDBCJ Sunday livestream live. Members only.",
};

const CHANNEL_ID = "UC2w4L4NiiVrcGlE0c1XW-Hw";

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
  const supabase = await getSupabase();
  const { error } = await supabase.from("site_settings").upsert(
    [
      { key: "livestream_fallback_video_id", value: cleanId, updated_by: ctx.profile.id },
      { key: "livestream_backup_url", value: backupUrl, updated_by: ctx.profile.id },
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
  const isAdmin = ctx.profile.role === "admin";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-extrabold text-slate-900">Live Stream</h1>
      <p className="mt-2 text-slate-600">
        Mapanood nang live ang ating pagsamba tuwing Linggo.
      </p>
      <div className="mt-6">
        <LivestreamPlayer channelId={CHANNEL_ID} fallbackVideoId={fallbackVideoId || undefined} />
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
        <form action={saveLivestreamSettings}
          className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Admin: Livestream Settings</h2>
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
