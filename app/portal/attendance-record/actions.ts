"use server";

import { revalidatePath } from "next/cache";
import { back, fmtDate, getRosterContext, str } from "@/lib/portal";
import { ATTENDANCE_RECORD_BASE, SERVICE_TYPES, gatheringTypeDisplay, isCustomType, isSunday, isSundayOnlyType, isValidDate } from "./constants";

// Petsa depende sa uri ng pagkakatipon: ang "Linggo" ay Linggo lang;
// ang mga Pasalamat ay pwedeng kahit anong araw sa kalendaryo.
function dateErrorForType(date: string, type: string): string | null {
  if (!isValidDate(date)) return "Hindi wastong petsa.";
  if (isSundayOnlyType(type) && !isSunday(date)) {
    return "Araw ng Linggo lang ang pwedeng talain para sa ganitong uri ng pagkakatipon.";
  }
  return null;
}

// Paghahanap ng pangalan sa roster ng ibang local (para sa autocomplete).
// Ibinabalik lang: id at full_name (max 20).
export async function searchOtherLocalMembers(
  homeLocalId: string,
  query: string,
): Promise<{ id: string; full_name: string }[]> {
  const { supabase } = await getRosterContext();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(homeLocalId)) return [];
  const q = (query ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc("search_roster_members", { p_local_id: homeLocalId, p_query: q });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({ id: String(r.member_id), full_name: String(r.full_name) }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// I-save ang pagdalo ng isang pagkakatipon (local + petsa + uri).
// Strategy: burahin ang dating tala ng pagtitipong ito, tapos ipasok
// ang bago -- kaya pwedeng i-edit at i-save ulit.
export async function saveAttendanceRecord(fd: FormData) {
  const { supabase, user, locals } = await getRosterContext();
  const localId = str(fd, "local_id");
  const local = locals.find((l) => l.id === localId);
  const date = str(fd, "service_date");
  const type = str(fd, "service_type");
  const path = ATTENDANCE_RECORD_BASE;
  if (!local || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(SERVICE_TYPES as readonly string[]).includes(type)) {
    back(path, "error", "Kumpletuhin ang local, petsa at uri ng pagkakatipon.");
  }
  const dateError = dateErrorForType(date, type);
  if (dateError) {
    back(path, "error", dateError);
  }
  const customReason = isCustomType(type) ? str(fd, "custom_reason").trim().slice(0, 120) : "";
  if (isCustomType(type) && !customReason) {
    back(path, "error", "I-type ang dahilan ng pagkakatipon.");
  }
  const backPath = `${path}?tab=magtala&local=${localId}&date=${date}&type=${encodeURIComponent(type)}`;

  // Hindi na pwedeng baguhin ang na-submit na sa Administrative Ministry
  const { data: locked } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type)
    .eq("status", "submitted")
    .limit(1);
  if ((locked ?? []).length > 0) {
    back(backPath, "error", "Na-submit na ang pagtitipong ito sa Administrative Ministry; hindi na pwedeng baguhin.");
  }

  // Tiyaking kaanib ng roster ng local na ito ang mga tsinsek
  const presentIds = [...new Set(fd.getAll("present").map(String).filter(Boolean))];
  const { data: roster } = await supabase.from("members").select("id").eq("local_id", localId).limit(2000);
  const rosterIds = new Set(((roster ?? []) as any[]).map((m) => String(m.id)));
  const validPresent = presentIds.filter((id) => rosterIds.has(id));

  const visitors = [...new Set(fd.getAll("visitor").map(String).map((s) => s.trim()).filter(Boolean))].slice(0, 200);
  // Dumalo mula sa ibang local: "homeLocalId|memberId" -- bineberipika sa
  // roster ng ibang local (hindi free-text, para matiyak na nakatala talaga).
  const otherLocalRefs = [...new Set(
    fd
      .getAll("other_local")
      .map(String)
      .map((s) => {
        const i = s.indexOf("|");
        if (i < 0) return null;
        const homeLocalId = s.slice(0, i);
        const memberId = s.slice(i + 1);
        return UUID_RE.test(homeLocalId) && UUID_RE.test(memberId) ? `${homeLocalId}|${memberId}` : null;
      })
      .filter((o): o is string => !!o),
  )]
    .map((s) => {
      const i = s.indexOf("|");
      return { homeLocalId: s.slice(0, i), memberId: s.slice(i + 1) };
    })
    .slice(0, 200);
  const otherLocals: { homeLocalId: string; memberId: string; name: string }[] = [];
  if (otherLocalRefs.length > 0) {
    const checks = await Promise.all(
      otherLocalRefs.map(async (o) => {
        const { data } = await supabase.rpc("verify_roster_member", { p_member_id: o.memberId });
        const row = ((data ?? []) as any[])[0] as
          | { member_id: string; full_name: string; local_id: string }
          | undefined;
        return { ref: o, row };
      }),
    );
    for (const c of checks) {
      if (!c.row || String(c.row.local_id) !== c.ref.homeLocalId) {
        back(backPath, "error", "Hindi maberipika sa roster: may dadalong hindi nakatala sa napiling local. Piliin ulit ang pangalan sa paghahanap.");
      }
      otherLocals.push({ homeLocalId: c.ref.homeLocalId, memberId: String(c.row.member_id), name: c.row.full_name });
    }
  }

  // Burahin ang dating tala ng pagtitipong ito (parehong local/petsa/uri)
  const { error: d1 } = await supabase
    .from("attendance_records")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d1) back(path, "error", "Hindi na-update ang talaan: " + d1.message);
  const { error: d2 } = await supabase
    .from("attendance_guests")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d2) back(path, "error", "Hindi na-update ang talaan ng bisita: " + d2.message);

  if (validPresent.length > 0) {
    const rows = validPresent.map((member_id) => ({
      member_id,
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      present: true,
      recorded_by: user.id,
    }));
    const { error } = await supabase.from("attendance_records").insert(rows);
    if (error) back(path, "error", "Hindi na-save ang pagdalo: " + error.message);
  }

  const guestRows = [
    ...visitors.map((name) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      name,
      kind: "visitor",
      recorded_by: user.id,
    })),
    ...otherLocals.map((o) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      name: o.name,
      kind: "other_local",
      home_local_id: o.homeLocalId,
      member_id: o.memberId,
      recorded_by: user.id,
    })),
  ];
  if (guestRows.length > 0) {
    const { error } = await supabase.from("attendance_guests").insert(guestRows);
    if (error) back(backPath, "error", "Hindi na-save ang bisita: " + error.message);
  }

  revalidatePath(ATTENDANCE_RECORD_BASE, "layout");
  const total = validPresent.length + guestRows.length;
  back(
    backPath,
    "ok",
    `Na-save bilang draft ang pagdalo sa ${fmtDate(date)} (${gatheringTypeDisplay(type, customReason)}): ${total} ang naitala.`,
  );
}

// I-submit ang mga napiling draft na pagdalo sa Administrative Ministry
// (mula sa tab na "Mga dumalo"; may checkbox kung alin ang i-submit).
// Pagka-submit ay naka-lock na (hindi na pwedeng baguhin).
export async function submitManyAttendanceRecords(fd: FormData) {
  const { supabase, locals } = await getRosterContext();
  const localId = str(fd, "local_id");
  const local = locals.find((l) => l.id === localId);
  const path = `${ATTENDANCE_RECORD_BASE}?tab=dumalo&local=${localId}`;
  if (!local) {
    back(ATTENDANCE_RECORD_BASE, "error", "Piliin ang local.");
  }
  const keys = [...new Set(fd.getAll("gatherings").map(String).filter(Boolean))];
  if (keys.length === 0) {
    back(path, "error", "Walang napiling pagdalo na i-submit.");
  }
  if (keys.length > 500) {
    back(path, "error", "Masyadong marami ang napili (500 lang ang pinakamarami).");
  }

  let n = 0;
  for (const key of keys) {
    const [date, type] = key.split("|");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !(SERVICE_TYPES as readonly string[]).includes(type ?? "")) {
      continue;
    }
    if (dateErrorForType(date, type)) continue;
    const { error: e1 } = await supabase
      .from("attendance_records")
      .update({ status: "submitted" })
      .eq("local_id", localId)
      .eq("service_date", date)
      .eq("service_type", type)
      .eq("status", "draft");
    const { error: e2 } = await supabase
      .from("attendance_guests")
      .update({ status: "submitted" })
      .eq("local_id", localId)
      .eq("service_date", date)
      .eq("service_type", type)
      .eq("status", "draft");
    if (!e1 && !e2) n++;
  }

  revalidatePath(ATTENDANCE_RECORD_BASE, "layout");
  if (n === 0) {
    back(path, "error", "Walang na-submit. Baka na-submit na ang mga napili.");
  }
  back(
    path,
    "ok",
    `Na-submit ang ${n} pagdalo sa Administrative Ministry. Naka-lock na ang mga ito; hindi na pwedeng baguhin.`,
  );
}

// ---------------------------------------------------------------
// CSV export / import
// Format: pangalan,kategorya,home_local
// kategorya: kaanib | bisita | ibang_local
// ---------------------------------------------------------------

const normName = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

function csvCell(s: string | null | undefined): string {
  const v = s ?? "";
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Payak na CSV parser (marunong sa naka-quote na field at "" escape).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // laktawan -- kakambal ng \n
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normCat(s: string): "kaanib" | "bisita" | "ibang_local" | null {
  const v = normName(s);
  if (!v) return null;
  if (["kaanib", "member", "miyembro", "roster"].includes(v)) return "kaanib";
  if (["bisita", "visitor", "guest", "panauhin"].includes(v)) return "bisita";
  if (["ibang_local", "ibang local", "other_local", "other local"].includes(v)) return "ibang_local";
  return null;
}

type ExportResult = { ok: true; csv: string; filename: string } | { ok: false; message: string };

// I-export ang pagdalo ng isang pagkakatipon bilang CSV.
export async function exportAttendanceCsv(localId: string, date: string, type: string): Promise<ExportResult> {
  const { supabase, locals } = await getRosterContext();
  const local = locals.find((l) => l.id === localId);
  const dateErr = dateErrorForType(date, type);
  if (!local || !(SERVICE_TYPES as readonly string[]).includes(type) || dateErr) {
    return { ok: false, message: dateErr ?? "Kumpletuhin ang local, petsa at uri ng pagkakatipon." };
  }

  const [{ data: records }, { data: guests }, { data: allLocals }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("member_id")
      .eq("local_id", localId)
      .eq("service_date", date)
      .eq("service_type", type)
      .limit(5000),
    supabase
      .from("attendance_guests")
      .select("name, kind, home_local_id")
      .eq("local_id", localId)
      .eq("service_date", date)
      .eq("service_type", type)
      .limit(2000),
    supabase.from("locals").select("id, name"),
  ]);

  const memberIds = [...new Set(((records ?? []) as any[]).map((r) => String(r.member_id)))];
  const memberNames = new Map<string, string>();
  for (let i = 0; i < memberIds.length; i += 200) {
    const { data: members } = await supabase
      .from("members")
      .select("id, full_name")
      .in("id", memberIds.slice(i, i + 200));
    for (const m of (members ?? []) as any[]) memberNames.set(String(m.id), (m.full_name as string) ?? "");
  }
  const localName = new Map(((allLocals ?? []) as any[]).map((l) => [String(l.id), l.name as string]));

  const rows: string[][] = [["pangalan", "kategorya", "home_local", "member_id"]];
  const kaanib = memberIds
    .map((id) => memberNames.get(id) ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "tl"));
  for (const n of kaanib) rows.push([n, "kaanib", "", ""]);
  const gs = ((guests ?? []) as any[]).sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "tl"));
  for (const g of gs) {
    const isOther = g.kind === "other_local";
    rows.push([
      String(g.name ?? ""),
      isOther ? "ibang_local" : "bisita",
      isOther ? (localName.get(String(g.home_local_id)) ?? "") : "",
      isOther && g.member_id ? String(g.member_id) : "",
    ]);
  }

  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const filename = `attendance-${local.name}-${date}-${type}.csv`.replace(/[^\w\-.]+/g, "_");
  return { ok: true, csv, filename };
}

// I-import ang CSV at palitan ang tala ng pagtitipong ito
// (parehong strategy ng manual save: burahin ang luma, ipasok ang bago).
export async function importAttendanceCsv(fd: FormData) {
  const { supabase, user, locals } = await getRosterContext();
  const localId = str(fd, "local_id");
  const local = locals.find((l) => l.id === localId);
  const date = str(fd, "service_date");
  const type = str(fd, "service_type");
  const csvText = String(fd.get("csv") ?? "");
  const backPath = `${ATTENDANCE_RECORD_BASE}?tab=magtala&local=${localId}&date=${date}&type=${encodeURIComponent(type)}`;
  const dateErr = dateErrorForType(date, type);
  if (!local || !(SERVICE_TYPES as readonly string[]).includes(type) || dateErr) {
    back(ATTENDANCE_RECORD_BASE, "error", dateErr ?? "Kumpletuhin ang local, petsa at uri ng pagkakatipon.");
  }
  const customReason = isCustomType(type) ? str(fd, "custom_reason").trim().slice(0, 120) : "";
  if (isCustomType(type) && !customReason) {
    back(backPath, "error", "I-type ang dahilan ng pagkakatipon bago mag-import.");
  }
  const { data: locked } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type)
    .eq("status", "submitted")
    .limit(1);
  if ((locked ?? []).length > 0) {
    back(backPath, "error", "Na-submit na ang pagtitipong ito sa Administrative Ministry; hindi na pwedeng baguhin.");
  }
  if (!csvText || csvText.length > 300_000) {
    back(backPath, "error", "Walang CSV na na-upload o masyadong malaki ang file (hanggang 300KB).");
  }

  const rows = parseCsv(csvText);
  let start = 0;
  if (rows.length > 0 && normName(rows[0][0] ?? "") === "pangalan") start = 1;
  const data = rows.slice(start, start + 2000);

  const [{ data: roster }, { data: allLocals }] = await Promise.all([
    supabase.from("members").select("id, full_name").eq("local_id", localId).eq("status", "Active").limit(2000),
    supabase.from("locals").select("id, name"),
  ]);
  const rosterByName = new Map<string, string>();
  for (const m of (roster ?? []) as any[]) {
    const k = normName(String(m.full_name ?? ""));
    if (k && !rosterByName.has(k)) rosterByName.set(k, String(m.id));
  }
  const localByName = new Map(((allLocals ?? []) as any[]).map((l) => [normName(String(l.name)), String(l.id)]));

  const kaanibIds = new Set<string>();
  const visitorSeen = new Set<string>();
  const visitors: string[] = [];
  const otherSeen = new Set<string>();
  const rawOthers: { name: string; homeLocalId: string | null; memberId: string }[] = [];
  const otherLocals: { name: string; memberId: string; homeLocalId: string }[] = [];
  const unknown: string[] = [];

  for (const r of data) {
    const name = (r[0] ?? "").trim();
    if (!name) continue;
    const cat = normCat(r[1] ?? "") ?? "kaanib";
    if (cat === "kaanib") {
      const id = rosterByName.get(normName(name));
      if (id) kaanibIds.add(id);
      else if (!unknown.includes(name)) unknown.push(name);
    } else if (cat === "bisita") {
      const k = normName(name);
      if (!visitorSeen.has(k)) {
        visitorSeen.add(k);
        visitors.push(name);
      }
    } else {
      const homeName = (r[2] ?? "").trim();
      const homeLocalId = homeName ? (localByName.get(normName(homeName)) ?? null) : null;
      const k = `${homeLocalId ?? ""}|${normName(name)}`;
      if (!otherSeen.has(k)) {
        otherSeen.add(k);
        rawOthers.push({ name, homeLocalId, memberId: (r[3] ?? "").trim() });
      }
    }
  }

  // Beripikasyon: ang bawat ibang_local ay dapat nakatala talaga sa
  // roster ng sinabing local (hindi free-text).
  for (const o of rawOthers) {
    if (!o.homeLocalId || !UUID_RE.test(o.homeLocalId)) {
      if (!unknown.includes(o.name)) unknown.push(`${o.name} (ibang local: hindi kilala)`);
      continue;
    }
    // Kung may member_id sa CSV, beripikahin ito; kung wala, hanapin sa pangalan.
    if (o.memberId && UUID_RE.test(o.memberId)) {
      const { data } = await supabase.rpc("verify_roster_member", { p_member_id: o.memberId });
      const row = ((data ?? []) as any[])[0];
      if (row && String(row.local_id) === o.homeLocalId) {
        otherLocals.push({ name: String(row.full_name), memberId: String(row.member_id), homeLocalId: o.homeLocalId });
        continue;
      }
    }
    const { data } = await supabase.rpc("search_roster_members", { p_local_id: o.homeLocalId, p_query: o.name });
    const match = ((data ?? []) as any[]).find((r) => normName(String(r.full_name)) === normName(o.name));
    if (match) {
      otherLocals.push({ name: String(match.full_name), memberId: String(match.member_id), homeLocalId: o.homeLocalId });
    } else if (!unknown.includes(o.name)) {
      unknown.push(`${o.name} (hindi nakatala sa roster ng ibang local)`);
    }
  }

  const { error: d1 } = await supabase
    .from("attendance_records")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d1) back(backPath, "error", "Hindi na-import ang CSV: " + d1.message);
  const { error: d2 } = await supabase
    .from("attendance_guests")
    .delete()
    .eq("local_id", localId)
    .eq("service_date", date)
    .eq("service_type", type);
  if (d2) back(backPath, "error", "Hindi na-import ang CSV: " + d2.message);

  if (kaanibIds.size > 0) {
    const rowsIns = [...kaanibIds].map((member_id) => ({
      member_id,
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      present: true,
      recorded_by: user.id,
    }));
    const { error } = await supabase.from("attendance_records").insert(rowsIns);
    if (error) back(backPath, "error", "Hindi na-import ang CSV: " + error.message);
  }
  const guestRows = [
    ...visitors.map((name) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      name,
      kind: "visitor",
      recorded_by: user.id,
    })),
    ...otherLocals.map((o) => ({
      local_id: localId,
      service_date: date,
      service_type: type,
      custom_reason: customReason || null,
      name: o.name,
      kind: "other_local",
      home_local_id: o.homeLocalId,
      member_id: o.memberId,
      recorded_by: user.id,
    })),
  ];
  if (guestRows.length > 0) {
    const { error } = await supabase.from("attendance_guests").insert(guestRows);
    if (error) back(backPath, "error", "Hindi na-import ang CSV: " + error.message);
  }

  revalidatePath(ATTENDANCE_RECORD_BASE, "layout");
  const total = kaanibIds.size + guestRows.length;
  let msg = `Na-import ang CSV para sa ${fmtDate(date)} (${gatheringTypeDisplay(type, customReason)}): ${total} ang naitala (${kaanibIds.size} kaanib, ${visitors.length} bisita, ${otherLocals.length} galing ibang local).`;
  if (unknown.length > 0) {
    msg += ` Hindi nakilala sa roster (${unknown.length}): ${unknown.slice(0, 10).join(", ")}${unknown.length > 10 ? ", …" : ""}`;
  }
  back(backPath, "ok", msg);
}
