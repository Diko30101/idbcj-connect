// Pagsubok ng mga helper ng audit (lib/audit.ts) at ng pahintulot (lib/giving.ts). Pure; walang database.
// Patakbuhin: node --test tests/unit/audit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffAudit, auditTableLabel, fmtAuditValue, AUDIT_TABLE_LABEL } from "../../lib/audit.ts";
import { permissionState, PERMISSION_STATE_LABEL, parseConsultationNote, parseValidUntil } from "../../lib/giving.ts";

test("diffAudit: ang mga field na nagbago lang; hindi kasama ang updated_at/created_at; may Tagalog na label", () => {
  const d = diffAudit(
    { id: "1", status: "draft", amount: "100.00", updated_at: "2026-09-01T00:00:00Z", created_at: "x", notes: null },
    { id: "1", status: "submitted", amount: "100.00", updated_at: "2026-09-02T00:00:00Z", created_at: "x", notes: "tala" },
  );
  assert.deepEqual(d.map((x) => [x.field, x.label, x.from, x.to]), [["notes", "Tala", "—", "tala"], ["status", "Status", "draft", "submitted"]]);
});

test("diffAudit: walang pagbabago = walang laman; INSERT (walang dating halaga) = walang diff; hindi kilalang field ay ginagamit ang pangalan nito", () => {
  assert.deepEqual(diffAudit({ a: 1 }, { a: 1 }), []);
  assert.deepEqual(diffAudit(null, { status: "draft" }), []);
  const d = diffAudit({ bagong_field: 1 }, { bagong_field: 2 });
  assert.equal(d[0].label, "bagong_field"); assert.equal(d[0].from, "1"); assert.equal(d[0].to, "2");
});

test("diffAudit: ang mga nested/array na halaga ay ihinahambing nang tama at ipinapakita nang maikli", () => {
  const d = diffAudit({ x: { a: 1 } }, { x: { a: 2 } });
  assert.equal(d.length, 1); assert.match(d[0].to, /"a":2/);
  assert.equal(diffAudit({ x: [1, 2] }, { x: [1, 2] }).length, 0);
});

test("fmtAuditValue: null/undefined = —, boolean, numero, at pinuputol ang napakahabang teksto", () => {
  assert.equal(fmtAuditValue(null), "—"); assert.equal(fmtAuditValue(undefined), "—");
  assert.equal(fmtAuditValue(true), "oo"); assert.equal(fmtAuditValue(false), "hindi"); assert.equal(fmtAuditValue(12.5), "12.5");
  const long = fmtAuditValue("x".repeat(500)); assert.ok(long.length <= 81 && long.endsWith("…"));
});

test("auditTableLabel: Tagalog na label ng mga table na sakop; ang iba ay ang pangalan mismo", () => {
  for (const t of ["abuluyan_totals", "ambagan_records", "tulong_klase_records", "pasalamat_records", "giving_permissions", "members", "ministry_members", "attendance_records"]) {
    assert.ok(AUDIT_TABLE_LABEL[t], "walang label: " + t); assert.equal(auditTableLabel(t), AUDIT_TABLE_LABEL[t]);
  }
  assert.equal(auditTableLabel("iba_pang_table"), "iba_pang_table");
});

test("pahintulot: estado ayon sa pagbawi at sa petsa ng pagtatapos", () => {
  assert.equal(permissionState({ revoked_at: null, valid_until: "2026-12-31" }, "2026-09-24"), "aktibo");
  assert.equal(permissionState({ revoked_at: null, valid_until: "2026-09-24" }, "2026-09-24"), "aktibo", "hanggang sa mismong petsa");
  assert.equal(permissionState({ revoked_at: null, valid_until: "2026-09-23" }, "2026-09-24"), "lumipas");
  assert.equal(permissionState({ revoked_at: "2026-09-01T00:00:00Z", valid_until: "2026-12-31" }, "2026-09-24"), "nabawi");
  for (const s of ["aktibo", "lumipas", "nabawi"]) assert.ok(PERMISSION_STATE_LABEL[s]);
});

test("pahintulot: tala ng konsultasyon ay kailangan (hindi blangko), at valid_until ay tunay na petsa na hindi pa lumilipas", () => {
  assert.equal(parseConsultationNote("  Nakipag-usap sa pamilya  "), "Nakipag-usap sa pamilya");
  for (const bad of ["", "   ", "\n\t"]) assert.equal(parseConsultationNote(bad), null);
  assert.equal(parseConsultationNote("x".repeat(1001)), null);
  assert.equal(parseConsultationNote("x".repeat(1000))?.length, 1000);
  assert.equal(parseValidUntil("2026-12-31", "2026-09-24"), "2026-12-31");
  assert.equal(parseValidUntil("2026-09-24", "2026-09-24"), "2026-09-24");
  for (const bad of ["", "2026-09-23", "2026-02-30", "abc"]) assert.equal(parseValidUntil(bad, "2026-09-24"), null, `dapat null: "${bad}"`);
});

test("diffAudit: hindi kasama ang status_changed_at/by (paulit-ulit sa changed_by); may label ang profile_id", () => {
  const d = diffAudit(
    { status: "Active", status_changed_at: null, status_changed_by: null, profile_id: null },
    { status: "Inactive", status_changed_at: "2026-09-24T13:00:00Z", status_changed_by: "abc", profile_id: "p1" },
  );
  assert.deepEqual(d.map((x) => x.field), ["profile_id", "status"]);
  assert.equal(d[0].label, "Naka-link na profile");
});

test("fmtAuditTime: ISO na oras ay ginagawang nababasang petsa at oras (Manila); ang hindi ISO ay hindi ginagalaw", async () => {
  const { fmtAuditTime } = await import("../../lib/audit.ts");
  assert.match(fmtAuditTime("2026-09-24T13:25:18.548613+00:00"), /Sep 24, 2026.*9:25/);
  assert.equal(fmtAuditTime("hindi petsa"), "hindi petsa");
  assert.equal(fmtAuditTime("—"), "—");
});
