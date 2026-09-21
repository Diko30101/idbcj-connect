import { requirePortalAccess, fmtDate, DPO_CONTACT, CATEGORY_LABEL } from "@/lib/portal";
import { shownEmail } from "@/lib/username";
import { updateMyProfile } from "../actions";
import { Field, Notice, Panel, PageHeader, RoleBadge, StatusBadge, btnCls, inputCls } from "@/components/portal/ui";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const { supabase, profile: p } = await requirePortalAccess();

  const { data: mine } = await supabase
    .from("ministry_members")
    .select("is_leader, ministries(name)")
    .eq("profile_id", p.id);

  return (
    <>
      <PageHeader title="My Profile" subtitle="Ang iyong impormasyon sa talaan ng simbahan." />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Update Information" className="lg:col-span-2">
          <form action={updateMyProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name / Buong Pangalan">
              <input name="full_name" defaultValue={p.full_name ?? ""} required className={inputCls} />
            </Field>
            <Field label="Phone Number / Telepono">
              <input name="phone_number" defaultValue={p.phone_number ?? ""} inputMode="tel" className={inputCls} />
            </Field>
            <Field label="Birthday / Kaarawan">
              <input type="date" name="birthday" defaultValue={p.birthday ?? ""} className={inputCls} />
            </Field>
            <Field label="City or Town / Lungsod o Bayan">
              <input name="city" defaultValue={p.city ?? ""} className={inputCls} />
            </Field>
            <Field label="Emergency Contact Name" hint="Kamag-anak na maaaring tawagan.">
              <input name="emergency_contact_name" defaultValue={p.emergency_contact_name ?? ""} className={inputCls} />
            </Field>
            <Field label="Emergency Contact Phone">
              <input name="emergency_contact_phone" defaultValue={p.emergency_contact_phone ?? ""} inputMode="tel" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className={btnCls}>Save Changes</button>
            </div>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="Account">
            <dl className="space-y-3 text-sm">
              {p.username && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</dt>
                  <dd className="break-all font-mono text-gray-800">{p.username}</dd>
                </div>
              )}
              {shownEmail(p.email) && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</dt>
                  <dd className="break-all text-gray-800">{p.email}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Category</dt>
                <dd className="text-gray-800">{CATEGORY_LABEL[p.category] ?? p.category}</dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <RoleBadge role={p.role} />
                <StatusBadge status={p.status} />
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ministries</dt>
                <dd className="text-gray-800">
                  {(mine ?? []).length
                    ? (mine as any[]).map((m) => m.ministries?.name).join(", ")
                    : "Wala pa"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Baptism</dt>
                <dd className="text-gray-800">
                  {p.baptism_status ?? "-"}
                  {p.baptism_date ? ` (${fmtDate(p.baptism_date)})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Member since</dt>
                <dd className="text-gray-800">{fmtDate(p.member_since)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-400">
              Ang status, binyag, at ministry ay inaayos ng secretary o ng Presiding Minister.
            </p>
          </Panel>

          <Panel title="Privacy">
            <p className="text-xs text-gray-600">
              Pumayag ka sa Privacy Notice noong {fmtDate(p.consent_at)} ({p.consent_version}). Para humiling
              na itama o alisin ang iyong data: {DPO_CONTACT}.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
