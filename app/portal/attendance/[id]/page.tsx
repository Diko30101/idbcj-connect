import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoles, fmtDate, KINDS, KIND_LABEL } from "@/lib/portal";
import { saveAttendance } from "../../actions";
import { Empty, Notice, PageHeader, Panel, btnGhostCls } from "@/components/portal/ui";
import { AttendanceList } from "@/components/portal/attendance-list";
import { ServiceControls } from "@/components/portal/service-controls";

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
      .select("id, full_name, phone_number, locality")
      .eq("status", "active")
      .order("full_name")
      .limit(1000),
    supabase.from("attendance").select("profile_id, present").eq("service_id", id).limit(1000),
  ]);

  const presentSet = new Set(((marks.data ?? []) as any[]).filter((a) => a.present).map((a) => a.profile_id));
  const list = (members.data ?? []) as { id: string; full_name: string | null; phone_number: string | null; locality: string | null }[];

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

      <div className="mb-6">
        <ServiceControls
          service={{ id: service.id, service_date: service.service_date, kind: service.kind, title: service.title }}
          kindOptions={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] ?? k }))}
        />
      </div>

      <form action={saveAttendance}>
        <input type="hidden" name="service_id" value={id} />
        <Panel>
          {list.length === 0 ? (
            <Empty>Walang aktibong member. Magdagdag muna sa Members.</Empty>
          ) : (
            <AttendanceList
              members={list.map((m) => ({ id: m.id, full_name: m.full_name, locality: m.locality as any }))}
              presentIds={Array.from(presentSet) as string[]}
              visitorsDefault={service.visitors_count ?? 0}
            />
          )}
        </Panel>
      </form>
    </>
  );
}
