"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { fakeElectron, fresh } = require("./helpers");

const userData = fakeElectron();
const store = fresh("../ai/skills/store");
const bundled = fresh("../ai/skills/bundled");

const opts = {
  instructionHash: bundled.instructionHash,
  legacyHashes: bundled.LEGACY_HASHES,
  legacyIds: bundled.V1_IDS,
};
const storeFile = path.join(userData, "ai-skills.json");
const metaFile = path.join(userData, "ai-skills-meta.json");

function reset() {
  for (const f of [storeFile, metaFile]) { try { fs.unlinkSync(f); } catch {} }
}

// The v1 seed, reconstructed: same ids/tools as today minus sop-doc, but with
// instructions whose hashes are in LEGACY_HASHES. We can't regenerate the old
// text, so fake it by registering the fake text's hash as legacy for the test.
function writeV1Store(lang, edits = {}) {
  const legacy = new Set(bundled.LEGACY_HASHES);
  const v1 = bundled.bundledSkills(lang)
    .filter((s) => bundled.V1_IDS.includes(s.id))
    .map((s) => {
      const instruction = edits[s.id] || `v1 text for ${s.id}`;
      if (!edits[s.id]) legacy.add(bundled.instructionHash(instruction));
      return { ...s, instruction };
    });
  fs.writeFileSync(storeFile, JSON.stringify(v1));
  return legacy;
}

test("first run seeds every bundled skill, including sop-doc", () => {
  reset();
  const all = store.syncBundled(bundled.bundledSkills("tr"), opts);
  assert.equal(all.length, 6);
  assert.ok(all.find((s) => s.id === "bundled-sop-doc"));
  const mt = all.find((s) => s.id === "bundled-meeting-notes");
  assert.deepEqual(mt.tools, ["create_docx", "create_xlsx"]);
  assert.ok(mt.instruction.length <= 2000);
});

test("upgrade: unedited v1 copies replaced, edited kept, new skill added", () => {
  reset();
  const legacy = writeV1Store("tr", { "bundled-summary-doc": "benim özel talimatım" });
  const all = store.syncBundled(bundled.bundledSkills("tr"), { ...opts, legacyHashes: legacy });
  const byId = Object.fromEntries(all.map((s) => [s.id, s]));
  assert.match(byId["bundled-meeting-notes"].instruction, /teyit edilecek/);
  assert.equal(byId["bundled-summary-doc"].instruction, "benim özel talimatım");
  assert.ok(byId["bundled-sop-doc"], "new starter skill added for existing installs");
});

test("a deleted bundled skill is never resurrected", () => {
  reset();
  store.syncBundled(bundled.bundledSkills("en"), opts);
  store.remove("bundled-sop-doc");
  store.remove("bundled-csv-data");
  const all = store.syncBundled(bundled.bundledSkills("en"), opts);
  assert.ok(!all.find((s) => s.id === "bundled-sop-doc"));
  assert.ok(!all.find((s) => s.id === "bundled-csv-data"));
});

test("a skill edited after seeding is left alone on later syncs", () => {
  reset();
  store.syncBundled(bundled.bundledSkills("en"), opts);
  const mine = store.list().find((s) => s.id === "bundled-slide-deck");
  store.save({ ...mine, instruction: "my own deck rules" });
  const all = store.syncBundled(bundled.bundledSkills("en"), opts);
  assert.equal(all.find((s) => s.id === "bundled-slide-deck").instruction, "my own deck rules");
});

test("every bundled language has every skill and a valid tool list", () => {
  for (const lang of ["tr", "en", "ko", "ja"]) {
    const list = bundled.bundledSkills(lang);
    assert.equal(list.length, 6);
    for (const s of list) {
      assert.ok(store.sanitize(s), `${lang}/${s.id} sanitizes`);
      assert.ok(s.instruction.length <= 2000, `${lang}/${s.id} fits`);
      assert.ok(s.triggers.length <= 8);
      for (const t of s.tools) assert.ok(store.VALID_TOOLS.includes(t));
    }
  }
});
