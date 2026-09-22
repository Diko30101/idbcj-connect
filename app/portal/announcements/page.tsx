import Link from "next/link";
import { requirePortalAccess, isStaff, fmtDate } from "@/lib/portal";
import { createAnnouncement, deleteAnnouncement, toggleAnnouncement, updateAnnouncement } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string }>;
}) {
  const { ok, error, edit } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const [ann, led, allMin] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, ministry_id, published, publish_at, expires_at, ministries(name)")
      .order("publish_at", { ascending: false })
      .limit(50),
    supabase.from("ministry_members").select("ministry_id, ministries(name)").eq("profile_id", profile.id).eq("is_leader", true),
    staff ? supabase.from("ministries").select("id, name").order("name") : Promise.resolve({ data: [] as any[] }),
  ]);

  const ledMinistries: { id: string; name: string }[] = staff
    ? ((allMin.data ?? []) as any[])
    : ((led.data ?? []) as any[]).map((l) => ({ id: l.ministry_id, name: l.ministries?.name }));
  const ledIds = new Set(((led.data ?? []) as any[]).map((l) => l.ministry_id));
  const canPost = staff || ledMinistries.length > 0;
  const list = (ann.data ?? []) as any[];

  return (
    <>
      <PageHeader title="Announcements" subtitle="Mga anunsyo para sa mga kapatiran." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={canPost ? "lg:col-span-2" : "lg:col-span-3"}>
          <Panel>
            {list.length === 0 ? (
              <Empty>Wala pang anunsyo.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((a) => {
                  const manage = staff || (a.ministry_id && ledIds.has(a.ministry_id));
                  const isEditing = manage && edit === a.id;
                  return (
                    <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                      {isEditing ? (
                        <form action={updateAnnouncement} className="grid gap-3">
                          <input type="hidden" name="id" value={a.id} />
                          <Field label="Pamagat">
                            <input name="title" required defaultValue={a.title} className={inputCls} />
                          </Field>
                          <Field label="Mensahe">
                            <textarea name="body" required rows={4} defaultValue={a.body} className={inputCls} />
                          </Field>
                          <Field label="Hanggang kailan (opsyonal)">
                            <input type="date" name="expires_at" defaultValue={a.expires_at ?? ""} className={inputCls} />
                          </Field>
                          <div className="flex gap-2">
                            <button className={btnCls}>I-save</button>
                            <Link href="/portal/announcements" className={btnGhostCls}>
                              Kanselahin
                            </Link>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-gray-900">{a.title}</h3>
                            <span className="shrink-0 text-xs text-gray-400">{fmtDate(a.publish_at)}</span>
                          </div>
                          <div className="mb-1 flex flex-wrap gap-2 text-xs">
                            <span className="font-medium text-purple-700">{a.ministries?.name ?? "Para sa lahat"}</span>
                            {!a.published && <span className="rounded bg-amber-50 px-1.5 text-amber-700">Draft</span>}
                            {a.expires_at && <span className="text-gray-400">hanggang {fmtDate(a.expires_at)}</span>}
                          </div>
                          <p className="whitespace-pre-line text-sm text-gray-600">{a.body}</p>
                          {manage && (
                            <div className="mt-3 flex gap-2">
                              <Link href={`/portal/announcements?edit=${a.id}`} className={btnGhostCls}>
                                I-edit
                              </Link>
                              <form action={toggleAnnouncement}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="publish" value={a.published ? "false" : "true"} />
                                <button className={btnGhostCls}>{a.published ? "Gawing draft" : "I-publish"}</button>
                              </form>
                              <form action={deleteAnnouncement}>
                                <input type="hidden" name="id" value={a.id} />
                                <button className={btnDangerCls}>Burahin</button>
                              </form>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {canPost && (
          <Panel title="Gumawa ng anunsyo">
            <form action={createAnnouncement} className="grid gap-4">
              <Field label="Pamagat">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Mensahe">
                <textarea name="body" required rows={5} className={inputCls} />
              </Field>
              <Field label="Para kanino">
                <select name="ministry_id" className={inputCls} defaultValue={staff ? "" : ledMinistries[0]?.id}>
                  {staff && <option value="">Lahat ng members</option>}
                  {ledMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Hanggang kailan (opsyonal)">
                <input type="date" name="expires_at" className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="published" defaultChecked className="h-4 w-4 accent-emerald-700" />
                I-publish agad
              </label>
              <button className={btnCls}>Gumawa</button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}