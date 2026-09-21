import Link from "next/link";
import { requirePortalAccess, isStaff } from "@/lib/portal";
import { createMinistry } from "../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";

export default async function MinistriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requirePortalAccess();
  const staff = isStaff(profile.role);

  const [all, mine] = await Promise.all([
    supabase.from("ministries").select("id, name, name_tl, description").order("name"),
    supabase.from("ministry_members").select("ministry_id, is_leader").eq("profile_id", profile.id),
  ]);
  const myMap = new Map(((mine.data ?? []) as any[]).map((m) => [m.ministry_id, m.is_leader as boolean]));
  const list = (all.data ?? []) as { id: string; name: string; name_tl: string | null; description: string | null }[];

  return (
    <>
      <PageHeader title="Ministries" subtitle="Mga grupo ng paglilingkod at ang kanilang mga iskedyul." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={staff ? "lg:col-span-2" : "lg:col-span-3"}>
          {list.length === 0 ? (
            <Panel>
              <Empty>Wala pang ministry{staff ? ". Gumawa ng una sa kanan." : "."}</Empty>
            </Panel>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((m) => (
                <Link
                  key={m.id}
                  href={`/portal/ministries/${m.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{m.name}</h2>
                    {myMap.has(m.id) && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                        {myMap.get(m.id) ? "Leader" : "Miyembro"}
                      </span>
                    )}
                  </div>
                  {m.name_tl && <div className="text-xs italic text-gray-500">{m.name_tl}</div>}
                  {m.description && <p className="mt-2 text-sm text-gray-600 line-clamp-3">{m.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {staff && (
          <Panel title="Gumawa ng ministry">
            <form action={createMinistry} className="grid gap-4">
              <Field label="Pangalan (English)">
                <input name="name" required className={inputCls} placeholder="Choir" />
              </Field>
              <Field label="Pangalan (Tagalog, opsyonal)">
                <input name="name_tl" className={inputCls} />
              </Field>
              <Field label="Paglalarawan (opsyonal)">
                <textarea name="description" rows={3} className={inputCls} />
              </Field>
              <button className={btnCls}>Gumawa</button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
