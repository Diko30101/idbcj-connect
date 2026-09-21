import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate, KIND_LABEL, ROLE_LABEL, CATEGORY_LABEL, LOCALITY_LABEL } from "@/lib/portal";
import { shownEmail } from "@/lib/username";
import { ResetPasswordButton } from "@/components/portal/reset-password-button";
import { addMemberToMinistry, removeFromMinistry, updateMember } from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnDangerCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function MemberDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile: me } = await requireRoles(["admin", "secretary"]);

  const { data: m } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();

  const [memberships, allMinistries, att] = await Promise.all([
    supabase.from("ministry_members").select("is_leader, ministries(id, name)").eq("profile_id", id),
    supabase.from("ministries").select("id, name").order("name"),
    supabase.from("attendance").select("present, services(service_date, kind)").eq("profile_id", id),
  ]);

  const joinedIds = new Set(((memberships.data ?? []) as any[]).map((x) => x.ministries?.id));
  const available = ((allMinistries.data ?? []) as any[]).filter((x) => !joinedIds.has(x.id));
  const history = ((att.data ?? []) as any[])
    .filter((a) => a.services)
    .sort((a, b) => b.services.service_date.localeCompare(a.services.service_date))
    .slice(0, 10);

  const readOnlyAdmin = m.role === "admin" && me.role !== "admin";

  return (
    <>
      <PageHeader
        title={m.full_name || "(walang pangalan)"}
        subtitle={[m.username ? `Username: ${m.username}` : null, shownEmail(m.email)].filter(Boolean).join(" · ")}
        action={
          <Link href="/portal/members" className={btnGhostCls}>
            ← Members
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Impormasyon" className="lg:col-span-2">
          {readOnlyAdmin && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Ang admin lang ang puwedeng mag-edit ng profile ng admin.
            </p>
          )}
          <form action={updateMember} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={m.id} />
            <Field label="Full Name">
              <input name="full_name" defaultValue={m.full_name ?? ""} required className={inputCls} disabled={readOnlyAdmin} />
            </Field>
            <Field label="Phone">
              <input name="phone_number" defaultValue={m.phone_number ?? ""} className={inputCls} disabled={readOnlyAdmin} />
            </Field>
            <Field label="City or Town">
              <input name="city" defaultValue={m.city ?? ""} className={inputCls} disabled={readOnlyAdmin} />
            </Field>
            <Field label="Locality" hint="Ginagamit sa pag-uulat ng attendance kada lokalidad.">
              <select name="locality" defaultValue={m.locality ?? ""} className={inputCls} disabled={readOnlyAdmin}>
                <option value="">(Wala pang nakatakda)</option>
                {(Object.keys(LOCALITY_LABEL) as (keyof typeof LOCALITY_LABEL)[]).map((l) => (
                  <option key={l} value={l}>{LOCALITY_LABEL[l]}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={m.category ?? "adult"} className={inputCls} disabled={readOnlyAdmin}>
                {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={m.status} className={inputCls} disabled={readOnlyAdmin}>
                <option value="active">Active</option>
                <option value="visitor">Visitor</option>
                <option value="inactive">Inactive (hindi na makakapasok)</option>
              </select>
            </Field>
            <Field label="Baptism Status">
              <select name="baptism_status" defaultValue={m.baptism_status ?? "Not Baptized"} className={inputCls} disabled={readOnlyAdmin}>
                <option>Not Baptized</option>
                <option>Scheduled</option>
                <option>Baptized</option>
              </select>
            </Field>
            <Field label="Baptism Date">
              <input type="date" name="baptism_date" defaultValue={m.baptism_date ?? ""} className={inputCls} disabled={readOnlyAdmin} />
            </Field>
            <Field label="Member Since">
              <input type="date" name="member_since" defaultValue={m.member_since ?? ""} className={inputCls} disabled={readOnlyAdmin} />
            </Field>
            {me.role === "admin" ? (
              <Field label="Role" hint="Admin lang ang puwedeng magpalit ng role.">
                <select name="role" defaultValue={m.role} className={inputCls}>
                  {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Role">
                <input value={ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]} disabled className={inputCls} readOnly />
              </Field>
            )}
            <div className="grid gap-1 rounded-md bg-slate-50 p-3 text-sm text-gray-600 sm:col-span-2">
              <div>Birthday: {fmtDate(m.birthday)}</div>
              <div>Emergency contact: {m.emergency_contact_name || "-"} {m.emergency_contact_phone ? `(${m.emergency_contact_phone})` : ""}</div>
              <div>Consent: {m.consent_at ? `${fmtDate(m.consent_at)} (${m.consent_version})` : "Wala pa"}</div>
              <div className="text-xs text-gray-400">Ang birthday at emergency contact ay ang member lang ang nag-e-edit.</div>
            </div>
            {!readOnlyAdmin && (
              <div className="sm:col-span-2">
                <button type="submit" className={btnCls}>Save Changes</button>
              </div>
            )}
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="Login">
            <dl className="mb-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</dt>
                <dd className="font-mono text-gray-800">{m.username ?? "(gumagamit ng email)"}</dd>
              </div>
              {m.must_change_password && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Hindi pa napapalitan ang temporary password.
                </p>
              )}
            </dl>
            <ResetPasswordButton id={m.id} disabled={readOnlyAdmin} />
          </Panel>

          <Panel title="Mga Ministry">
            {((memberships.data ?? []) as any[]).length === 0 ? (
              <Empty>Wala pang ministry.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {((memberships.data ?? []) as any[]).map((x) => (
                  <li key={x.ministries?.id} className="flex items-center justify-between gap-2">
                    <span>
                      {x.ministries?.name}
                      {x.is_leader && <span className="ml-2 text-xs text-purple-700">Leader</span>}
                    </span>
                    <form action={removeFromMinistry}>
                      <input type="hidden" name="profile_id" value={m.id} />
                      <input type="hidden" name="ministry_id" value={x.ministries?.id} />
                      <button className={btnDangerCls}>Alisin</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {available.length > 0 && (
              <form action={addMemberToMinistry} className="mt-4 flex gap-2">
                <input type="hidden" name="profile_id" value={m.id} />
                <select name="ministry_id" className={inputCls} defaultValue="">
                  <option value="" disabled>Idagdag sa ministry…</option>
                  {available.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
                <button className={btnCls}>Idagdag</button>
              </form>
            )}
          </Panel>

          <Panel title="Huling attendance">
            {history.length === 0 ? (
              <Empty>Wala pang naka-tala.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {history.map((a, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-gray-600">
                      {fmtDate(a.services.service_date)} · {KIND_LABEL[a.services.kind] ?? a.services.kind}
                    </span>
                    <span className={a.present ? "font-semibold text-emerald-700" : "text-gray-400"}>
                      {a.present ? "Dumalo" : "Wala"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
