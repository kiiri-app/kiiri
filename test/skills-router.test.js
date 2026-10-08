"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { matchSkill } = require("../ai/skills/router");

const skills = [
  { id: "table", triggers: ["tablo", "table"] },
  { id: "csv", triggers: ["csv tablo"] },
];

test("longest matching trigger wins, case/diacritic-insensitive", () => {
  assert.equal(matchSkill("Bir CSV TABLO hazırla", skills).id, "csv");
  assert.equal(matchSkill("make a Table please", skills).id, "table");
  assert.equal(matchSkill("nothing here", skills), null);
});
