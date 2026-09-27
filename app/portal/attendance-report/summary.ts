import type { SupabaseClient } from "@supabase/supabase-js";
import { monthDateRange } from "@/lib/abuluyan";
import { monthLabel } from "@/lib/finance";
import { gatheringTypeDisplay } from "@/app/portal/attendance-record/constants";
import type { AttendanceReportSummary } from "@/lib/attendance-report";

// Buod ng mga NAKA-DRAFT (hindi pa naipapasa) na pagdalo ng isang lokal para
// sa isang buwan — para makita ng Admin kung alin ang hindi pa naisusumite.
export type DraftAttendanceGathering = {
  serviceDate: string; // YYYY-MM-DD
  serviceType: string; // value ng finance_service_type enum
  typeLabel: string; // Tagalog na label (Pagsamba, Klase Ministerial, ...)
  attendeeCount: number; // mga kaanib + bisita/ibang lokal
};

export async function getDraftAttendanceGatherings(
  supabase: SupabaseClient,
  localId: string,
  buwan: string,
): Promise<DraftAttendanceGathering[]> {
  const { first, firstNext } = monthDateRange(buwan);

  const [recordsRes, guestsRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("member_id, service_date, service_type, custom_reason")
      .eq("local_id", localId)
      .eq("status", "draft")
      .gte("service_date", first)
      .lt("service_date", firstNext)
      .order("service_date", { ascending: true }),
    supabase
      .from("attendance_guests")
      .select("name, kind, service_date, service_type, custom_reason")
      .eq("local_id", localId)
      .eq("status", "draft")
      .gte("service_date", first)
      .lt("service_date", firstNext)
      .order("service_date", { ascending: true }),
  ]);

  type Gathering = {
    date: string;
    type: string;
    customReason: string | null;
    memberIds: Set<string>;
    guests: number;
  };
  const gatherings = new Map<string, Gathering>();
  const get = (date: string, type: string, customReason: string | null) => {
    const key = `${date}|${type}`;
    let g = gatherings.get(key);
    if (!g) {
      g = { date, type, customReason: null, memberIds: new Set(), guests: 0 };
      gatherings.set(key, g);
    }
    if (!g.customReason && customReason) g.customReason = customReason;
    return g;
  };

  for (const r of ((recordsRes.data ?? []) as any[])) {
    const g = get(r.service_date, r.service_type, r.custom_reason ?? null);
    g.memberIds.add(String(r.member_id));
  }
  for (const gu of ((guestsRes.data ?? []) as any[])) {
    const g = get(gu.service_date, gu.service_type, gu.custom_reason ?? null);
    g.guests += 1;
  }

  return [...gatherings.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type < b.type ? -1 : 1))
    .map((g) => ({
      serviceDate: g.date,
      serviceType: g.type,
      typeLabel: gatheringTypeDisplay(g.type, g.customReason),
      attendeeCount: g.memberIds.size + g.guests,
    }));
}

// Kumukuha ng mga NAISUMITENG (submitted) pagdalo ng isang lokal para sa isang
// buwan, at bumubuo ng AttendanceReportSummary. Ibinabahagi ng pahina at ng
// send action. Ang RLS ang huling harang: nakikita lang ang pinapayagan ng role.
export async function getAttendanceReportSummary(
  supabase: SupabaseClient,
  localId: string,
  localName: string,
  buwan: string,
): Promise<AttendanceReportSummary> {
  const { first, firstNext } = monthDateRange(buwan);

  const [recordsRes, guestsRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("member_id, service_date, service_type, custom_reason, members!attendance_records_member_id_fkey(full_name)")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .gte("service_date", first)
      .lt("service_date", firstNext)
      .order("service_date", { ascending: true }),
    supabase
      .from("attendance_guests")
      .select("name, kind, service_date, service_type, custom_reason")
      .eq("local_id", localId)
      .eq("status", "submitted")
      .gte("service_date", first)
      .lt("service_date", firstNext)
      .order("service_date", { ascending: true }),
  ]);

  type Gathering = {
    date: string;
    type: string;
    customReason: string | null;
    memberNames: Map<string, string>; // member_id -> full_name
    visitorNames: string[];
    otherLocalNames: string[];
  };
  const gatherings = new Map<string, Gathering>();
  const get = (date: string, type: string, customReason: string | null) => {
    const key = `${date}|${type}`;
    let g = gatherings.get(key);
    if (!g) {
      g = { date, type, customReason: null, memberNames: new Map(), visitorNames: [], otherLocalNames: [] };
      gatherings.set(key, g);
    }
    if (!g.customReason && customReason) g.customReason = customReason;
    return g;
  };

  for (const r of ((recordsRes.data ?? []) as any[])) {
    const g = get(r.service_date, r.service_type, r.custom_reason ?? null);
    const name = (r.members as any)?.full_name ?? "(walang pangalan)";
    g.memberNames.set(String(r.member_id), name);
  }
  for (const gu of ((guestsRes.data ?? []) as any[])) {
    const g = get(gu.service_date, gu.service_type, gu.custom_reason ?? null);
    const name = gu.name ?? "(walang pangalan)";
    if (gu.kind === "visitor") g.visitorNames.push(name);
    else g.otherLocalNames.push(name);
  }

  const rows = [...gatherings.values()]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type < b.type ? -1 : 1))
    .map((g) => {
      const memberNames = [...g.memberNames.values()].sort((a, b) => a.localeCompare(b));
      const visitorNames = [...g.visitorNames].sort((a, b) => a.localeCompare(b));
      const otherLocalNames = [...g.otherLocalNames].sort((a, b) => a.localeCompare(b));
      const members = memberNames.length;
      const visitors = visitorNames.length;
      const otherLocal = otherLocalNames.length;
      const total = members + visitors + otherLocal;
      return {
        serviceDate: g.date,
        serviceType: g.type,
        typeLabel: gatheringTypeDisplay(g.type, g.customReason),
        members,
        visitors,
        otherLocal,
        total,
        memberNames,
        visitorNames,
        otherLocalNames,
      };
    });

  const membersTotal = rows.reduce((s, r) => s + r.members, 0);
  const visitorsTotal = rows.reduce((s, r) => s + r.visitors, 0);
  const otherLocalTotal = rows.reduce((s, r) => s + r.otherLocal, 0);

  return {
    buwan,
    monthLabel: monthLabel(buwan),
    localId,
    localName,
    rows,
    membersTotal,
    visitorsTotal,
    otherLocalTotal,
    grandTotal: membersTotal + visitorsTotal + otherLocalTotal,
    gatheringCount: rows.length,
  };
}
