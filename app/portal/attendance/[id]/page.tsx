import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate, KIND_LABEL } from "@/lib/portal";
import { saveAttendance } from "../../actions";
import { Empty, Field, Notice, PageHeader, Panel, btnCls, btnGhostCls, inputCls } from "@/components/portal/ui";

export default async function ServiceAttendance({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireRoles(["admin", "secretary"]);

  const { data: service } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (!service) notFound();

  const [members, marks] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone_number")
      .eq("status", "active")
      .order("full_name")
      .limit(1000),
    supabase.from("attendance").select("profile_id, present").eq("service_id", id).limit(1000),
  ]);

  const presentSet = new Set(((marks.data ?? []) as any[]).filter((a) => a.present).map((a) => a.profile_id));
  const list = (members.data ?? []) as { id: string; full_name: string | null; phone_number: string | null }[];

  return (
    <>
      <PageHeader
        title={`${KIND_LABEL[service.kind] ?? service.kind} · ${fmtDate(service.service_date)}`}
        subtitle={service.title ?? "Lagyan ng tsek ang mga dumalo, tapos i-save."}
        action={
          <Link href="/portal/attendance" className={btnGhostCls}>
            ← Attendance
          </Link>
        }
      />
      <Notice ok={ok} error={error} />

      <form action={saveAttendance}>
        <input type="hidden" name="service_id" value={id} />
        <Panel>
          {list.length === 0 ? (
            <Empty>Walang aktibong member. Magdagdag muna sa Members.</Empty>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <p className="text-sm text-gray-600">
                  Dumalo na: <strong>{presentSet.size}</strong> sa {list.length} na aktibong member
                </p>
                <div className="w-40">
                  <Field label="Bilang ng bisita">
                    <input
                      type="number"
                      min={0}
                      name="visitors_count"
                      defaultValue={service.visitors_count}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {list.map((m) => (
                  <li key={m.id} className="border-b border-gray-100">
                    <input type="hidden" name="all" value={m.id} />
                    <label className="flex cursor-pointer items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        name="present"
                        value={m.id}
                        defaultChecked={presentSet.has(m.id)}
                        className="h-5 w-5 accent-emerald-700"
                      />
                      <span className="text-sm font-medium text-gray-900">{m.full_name || "(walang pangalan)"}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-gray-100 bg-white/95 px-5 py-3">
                <button type="submit" className={btnCls}>Save Attendance</button>
              </div>
            </>
          )}
        </Panel>
      </form>
    </>
  );
}
