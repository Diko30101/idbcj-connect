import { getPermissionsContext, todayPH } from "@/lib/portal";
import { grantPermission } from "./actions";
import { Notice, PageHeader, Panel, btnCls, inputCls } from "@/components/portal/ui";
import { GivingPermissionList } from "@/components/portal/giving-permission-list";
import { PERMISSION_NOTE_MAX, type GivingPermission } from "@/lib/giving";

// Pahintulot para sa kaanib na Inactive na tatanggap ng handog. Pastoral leader (Admin): nagbibigay at bumabawi.
// Church-wide Finance: nakakabasa lang. Hindi nito binabago ang status ng kaanib (iyon ay sa roster, ng Admin).
export default async function GivingPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const ctx = await getPermissionsContext();
  const { supabase, isPastoral } = ctx;
  const today = todayPH();

  const { data: permData } = await supabase
    .from("giving_permissions")
    .select("id, member_id, granted_at, valid_until, consultation_note, revoked_at, reason")
    .order("granted_at", { ascending: false })
    .limit(300);
  const permissions = (permData ?? []) as GivingPermission[];

  // Mga pangalan: mula sa roster (nababasa ng Pastoral leader at ng church-wide)
  const ids = [...new Set(permissions.map((p) => p.member_id))];
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const { data } = await supabase.from("members").select("id, full_name").in("id", ids);
    for (const m of (data ?? []) as { id: string; full_name: string }[]) names[m.id] = m.full_name;
  }

  // Mga kaanib na Inactive na mapipili (para sa Pastoral leader)
  let inactive: { id: string; full_name: string; local: string }[] = [];
  if (isPastoral) {
    const [{ data: mem }, { data: locs }] = await Promise.all([
      supabase.from("members").select("id, full_name, local_id").eq("status", "Inactive").order("full_name").limit(500),
      supabase.from("locals").select("id, name"),
    ]);
    const localName = new Map(((locs ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
    inactive = ((mem ?? []) as { id: string; full_name: string; local_id: string }[]).map((m) => ({ id: m.id, full_name: m.full_name, local: localName.get(m.local_id) ?? "" }));
  }

  return (
    <>
      <PageHeader
        title="Mga Pahintulot sa Inactive na Kaanib"
        subtitle={isPastoral ? "Pastoral Ministry: magbigay o bumawi ng pahintulot" : "Church-wide Finance: pagbasa lamang"}
      />
      <Notice ok={ok} error={error} />

      {isPastoral && (
        <div className="mt-6">
          <Panel title="Magbigay ng pahintulot">
            <form action={grantPermission} className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Kaanib na Inactive</span>
                <select name="member_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    {inactive.length === 0 ? "Walang kaanib na Inactive" : "Pumili ng kaanib…"}
                  </option>
                  {inactive.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} · {m.local}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700">Valid hanggang</span>
                <input type="date" name="valid_until" min={today} required autoComplete="off" className={inputCls} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Tala ng konsultasyon (kailangan)</span>
                <textarea name="consultation_note" required maxLength={PERMISSION_NOTE_MAX} rows={3} className={inputCls} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={btnCls}>
                  Ibigay ang pahintulot
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs text-gray-500">
              Ang pagpapalawig ay bagong pahintulot (nananatili ang luma). Ang pahintulot ay hindi nagpapabago ng status ng kaanib.
            </p>
          </Panel>
        </div>
      )}

      <div className="mt-6">
        <Panel title="Mga Pahintulot">
          <GivingPermissionList permissions={permissions} names={names} today={today} canRevoke={isPastoral} />
        </Panel>
      </div>
    </>
  );
}
