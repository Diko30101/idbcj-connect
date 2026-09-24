// Pagsubok ng mga helper ng roster (lib/roster.ts). Pure; walang database. Sintetikong pangalan lang.
// Patakbuhin: node --test tests/unit/roster.test.mjs   (Node 22.6+ ay direktang tumatakbo ng .ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, nameKey, rosterErrorMessage } from "../../lib/roster.ts";

test("normalizeName at nameKey: tinatanggal ang sobrang espasyo; ang key ay hindi nagbabago sa laki ng titik", () => {
  assert.equal(normalizeName("  T   Kaanib   Isa "), "T Kaanib Isa");
  assert.equal(nameKey(" t  KAANIB isa"), nameKey("T Kaanib Isa"));
  assert.notEqual(nameKey("T Kaanib Isa"), nameKey("T Kaanib Dalawa"));
});

test("rosterErrorMessage: Tagalog na mensahe ng database ay ipinapakita; RLS at teknikal na error ay fallback", () => {
  assert.equal(rosterErrorMessage({ code: "42501", message: "Ang Admin lang ang makapagpapalit ng status o ng local ng kaanib." }, "fb"), "Ang Admin lang ang makapagpapalit ng status o ng local ng kaanib.");
  assert.equal(rosterErrorMessage({ code: "23514", message: "Kailangan ang dahilan sa pagpapalit ng status ng kaanib." }, "fb"), "Kailangan ang dahilan sa pagpapalit ng status ng kaanib.");
  assert.equal(rosterErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "members"' }, "fb"), "fb");
  assert.equal(rosterErrorMessage({ code: "XX000", message: "internal" }, "fb"), "fb");
  assert.equal(rosterErrorMessage(null, "fb"), "fb");
});
