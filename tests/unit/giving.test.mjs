// Pagsubok ng mga helper ng pagbibigay (lib/giving.ts) at ng doktrina. Pure; walang database.
// Patakbuhin: node --test tests/unit/giving.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseGivingAmount, parsePeriodMonth, parseIsoDate, givingErrorMessage, safeGivingPath, GIVING_AMOUNT_MAX } from "../../lib/giving.ts";

test("halaga: libre pero > 0, hanggang 2 decimal; walang default; hindi tinatanggap ang 0, negatibo, blangko, hindi numero", () => {
  assert.equal(parseGivingAmount("100"), 100);
  assert.equal(parseGivingAmount(" 100.50 "), 100.5);
  assert.equal(parseGivingAmount("0.01"), 0.01);
  for (const bad of ["", "   ", "0", "0.00", "-5", "abc", "1e3", "1,000", "100.555", "12.", ".5x", "NaN", "Infinity"]) {
    assert.equal(parseGivingAmount(bad), "invalid", `dapat di-wasto: "${bad}"`);
  }
  assert.equal(parseGivingAmount(String(GIVING_AMOUNT_MAX)), GIVING_AMOUNT_MAX);
  assert.equal(parseGivingAmount("10000000000.00"), "invalid", "lampas sa numeric(12,2)");
});

test("buwan ng ambag: YYYY-MM ay nagiging unang araw ng buwan; ang di-wasto ay null", () => {
  assert.equal(parsePeriodMonth("2026-09"), "2026-09-01");
  assert.equal(parsePeriodMonth("2026-12"), "2026-12-01");
  for (const bad of ["", "2026-9", "2026-13", "2026-00", "26-09", "2026-09-01", "abc"]) assert.equal(parsePeriodMonth(bad), null, `dapat null: "${bad}"`);
});

test("petsa: tunay na petsa ng kalendaryo lang", () => {
  assert.equal(parseIsoDate("2026-09-20"), "2026-09-20");
  assert.equal(parseIsoDate("2024-02-29"), "2024-02-29");
  for (const bad of ["", "2026-02-30", "2025-02-29", "2026-9-2", "20-09-2026", "2026-13-01"]) assert.equal(parseIsoDate(bad), null, `dapat null: "${bad}"`);
});

test("givingErrorMessage: ipinapakita ang Tagalog na mensahe ng database; ang teknikal ay fallback", () => {
  const tl = "Hindi pa kinukumpirma ng Admin ang kaanib na ito. Hindi maaaring i-record ang handog hangga't hindi siya nakukumpirma.";
  assert.equal(givingErrorMessage({ code: "23514", message: tl }, "fb"), tl);
  assert.equal(givingErrorMessage({ code: "23503", message: "Hindi kaanib ang napiling tao. Walang tinatanggap na handog mula sa hindi kaanib." }, "fb"), "Hindi kaanib ang napiling tao. Walang tinatanggap na handog mula sa hindi kaanib.");
  assert.equal(givingErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "ambagan_records"' }, "fb"), "fb");
  assert.equal(givingErrorMessage({ code: "23514", message: 'new row for relation "ambagan_records" violates check constraint "ambagan_records_amount_check"' }, "fb"), "fb");
  assert.equal(givingErrorMessage({ code: "23502", message: 'null value in column "member_id" of relation "x" violates not-null constraint' }, "fb"), "fb");
  assert.equal(givingErrorMessage({ code: "XX000", message: "internal" }, "fb"), "fb");
  assert.equal(givingErrorMessage(null, "fb"), "fb");
});

test("safeGivingPath: tinatanggap lang ang mga pahina ng handog (may query); ang iba ay ibinabalik sa Ambagan", () => {
  assert.equal(safeGivingPath("/portal/finance/ambagan?local=abc"), "/portal/finance/ambagan?local=abc");
  assert.equal(safeGivingPath("/portal/finance/tulong"), "/portal/finance/tulong");
  assert.equal(safeGivingPath("/portal/finance/pasalamat"), "/portal/finance/pasalamat");
  assert.equal(safeGivingPath("https://evil.example"), "/portal/finance/ambagan");
  assert.equal(safeGivingPath("//evil.example"), "/portal/finance/ambagan");
  assert.equal(safeGivingPath("/portal/roster"), "/portal/finance/ambagan");
});

// Doktrina (spec seksyon 1): walang "kulang", "delinquent", "hindi pa nag-ambag", o default/suggested/expected na halaga
test("doktrina: walang salitang kulang/delinquent/hindi pa nag-ambag sa mga file ng handog", () => {
  const roots = ["app/portal/finance/ambagan", "app/portal/finance/tulong", "app/portal/finance/pasalamat", "app/portal/finance/audit", "app/portal/giving-permissions", "components/portal", "lib"];
  const files = [];
  const walk = (p) => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else files.push(p); };
  for (const r of roots) walk(r);
  const giving = files.filter((f) => /(giving|member-picker|ambagan|tulong|pasalamat|audit|permission)/i.test(f) && /\.(ts|tsx)$/.test(f));
  assert.ok(giving.length >= 2, "walang nahanap na file ng handog: " + giving.length);
  const forbidden = /(kulang|delinquent|hindi\s+pa\s+nag-?ambag|hindi\s+nag-?ambag|utang|arrears|nagkulang)/i;
  for (const f of giving) {
    const text = fs.readFileSync(f, "utf8");
    assert.ok(!forbidden.test(text), `ipinagbabawal na salita sa ${f}: ${text.match(forbidden)?.[0]}`);
  }
});

test("doktrina: walang default/placeholder na halaga sa form ng ambagan", () => {
  const files = ["components/portal/ambagan-form.tsx"].filter((f) => fs.existsSync(f));
  assert.ok(files.length === 1, "wala pa ang form");
  const text = fs.readFileSync(files[0], "utf8");
  // Bawal: placeholder, literal na value/defaultValue (hal. "0", "100"). Pinapayagan: defaultValue na galing sa umiiral na record (edit).
  const amountInput = /<input[^>]*name="amount"[^>]*\/>/s.exec(text)?.[0] ?? "";
  assert.ok(amountInput !== "", "hindi nakita ang input ng halaga");
  assert.ok(!/placeholder=/.test(amountInput), "may placeholder ang halaga");
  assert.ok(!/\bvalue=["'{]/.test(amountInput), "may value ang halaga");
  assert.ok(!/defaultValue=(\{["'0-9]|["'])/.test(amountInput), "may literal na default ang halaga");
  assert.ok(/defaultValue=\{edit \?/.test(amountInput), "ang default ay dapat galing lang sa edit");
  assert.ok(!/placeholder="[0-9]/.test(text), "may halimbawang halaga sa placeholder");
});

// ---------------- Pasalamat (hakbang 3) ----------------
import { parsePasalamatType, PASALAMAT_TYPES, PASALAMAT_TYPE_LABEL } from "../../lib/giving.ts";

test("pasalamat: apat na uri (ayon sa enum ng 011), lahat ay may Tagalog na label; ang di-kilala ay null; walang default na uri", () => {
  assert.deepEqual([...PASALAMAT_TYPES].sort(), ["anniversary", "extra", "new_year", "private"]);
  for (const t of PASALAMAT_TYPES) { assert.ok(PASALAMAT_TYPE_LABEL[t] && PASALAMAT_TYPE_LABEL[t].length > 2, "walang label: " + t); assert.equal(parsePasalamatType(t), t); }
  for (const bad of ["", " ", "NEW_YEAR", "bogus", "new year"]) assert.equal(parsePasalamatType(bad), null, `dapat null: "${bad}"`);
});

test("doktrina: walang default/placeholder na halaga sa form ng pasalamat; ang uri ay walang paunang napili", () => {
  const f = "components/portal/pasalamat-form.tsx";
  assert.ok(fs.existsSync(f), "wala pa ang form ng pasalamat");
  const text = fs.readFileSync(f, "utf8");
  const amountInput = /<input[^>]*name="amount"[^>]*\/>/s.exec(text)?.[0] ?? "";
  assert.ok(amountInput !== "", "hindi nakita ang input ng halaga");
  assert.ok(!/placeholder=/.test(amountInput) && !/\bvalue=["'{]/.test(amountInput), "may placeholder o value ang halaga");
  assert.ok(!/defaultValue=(\{["'0-9]|["'])/.test(amountInput), "may literal na default ang halaga");
  const select = /<select[^>]*name="type"[^>]*>/s.exec(text)?.[0] ?? "";
  assert.ok(select !== "", "hindi nakita ang select ng uri");
  assert.ok(!/defaultValue=["']/.test(select), "may paunang napiling uri");
});
