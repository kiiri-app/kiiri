"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron } = require("./helpers");

fakeElectron();
const chars = require("../characters");

const cells = [{ x: 1, y: 2, color: "#ff0000" }];

test("overlay keeps its art revision; unstamped = original art (1)", () => {
  assert.equal(chars.sanitizeOverlay({ cols: 40, rows: 40, cells }).art, 1);
  assert.equal(chars.sanitizeOverlay({ cols: 40, rows: 40, cells, art: 2 }).art, 2);
  assert.equal(chars.sanitizeOverlay({ cols: 40, rows: 40, cells, art: "2" }).art, 1);
});

test("overlay drops out-of-grid, duplicate and badly coloured cells", () => {
  const o = chars.sanitizeOverlay({
    cols: 10, rows: 10,
    cells: [
      { x: 1, y: 1, color: "#00ff00" },
      { x: 1, y: 1, color: "#0000ff" },
      { x: 10, y: 0, color: "#fff" },
      { x: 2, y: 2, color: "red; background:url(x)" },
    ],
  });
  assert.deepEqual(o.cells, [{ x: 1, y: 1, color: "#00ff00" }, { x: 2, y: 2, color: "#000000" }]);
});

test("overlay grid bounds are enforced", () => {
  assert.equal(chars.sanitizeOverlay({ cols: 2, rows: 40, cells }), null);
  assert.equal(chars.sanitizeOverlay({ cols: 40, rows: 999, cells }), null);
  assert.equal(chars.sanitizeOverlay({ cols: 40, rows: 40, cells: [] }), null);
});

test("pose-set states include the new happy pose", () => {
  assert.ok(chars.POSESET_STATES.includes("happy"));
});

test("retired classic / sprite / unknown kinds migrate to kiri, keeping identity", () => {
  for (const kind of ["classic", "sprite", undefined, "weird"]) {
    const c = chars.sanitize({
      id: "c1", name: "Mochi", persona: "calm", kind,
      pattern: { head: [] }, sprite: { ears: "cat" },
      position: { x: 10, y: 20 }, size: 150,
    }, 0);
    assert.equal(c.kind, "poseset");
    assert.equal(c.set, "kiri");
    assert.equal(c.name, "Mochi");
    assert.equal(c.persona, "calm");
    assert.deepEqual(c.position, { x: 10, y: 20 });
    assert.equal(c.size, 150);
    assert.equal("pattern" in c || "sprite" in c, false);
  }
});

test("petdex pets without a sheet are dropped; tori stays tori", () => {
  assert.equal(chars.sanitize({ kind: "petdex", pet: {} }, 0), null);
  assert.equal(chars.sanitize({ kind: "poseset", set: "tori" }, 0).set, "tori");
});
