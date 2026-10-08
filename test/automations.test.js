"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron, fresh } = require("./helpers");

fakeElectron();

test("interval automation is due one interval after creation, then after each run", () => {
  const auto = fresh("../ai/automations");
  const a = auto.add({ name: "check", prompt: "look", kind: "note", schedule: { type: "interval", everyMin: 30 } }).item;
  const created = Date.parse(a.createdAt);
  assert.equal(auto.dueNow(new Date(created + 29 * 60e3)).length, 0);
  assert.equal(auto.dueNow(new Date(created + 30 * 60e3)).length, 1);
  auto.markRan(a.id, new Date(created + 30 * 60e3));
  assert.equal(auto.dueNow(new Date(created + 45 * 60e3)).length, 0);
});

test("daily automation fires once at HH:MM on allowed weekdays", () => {
  const auto = fresh("../ai/automations");
  for (const x of auto.list()) auto.remove(x.id);
  const a = auto.add({ prompt: "standup", kind: "note", schedule: { type: "daily", time: "9:05", days: [1] } }).item;
  assert.equal(a.schedule.time, "09:05");
  const monday = new Date(2026, 9, 5, 9, 5); // Mon 5 Oct 2026
  const tuesday = new Date(2026, 9, 6, 9, 5);
  assert.equal(auto.dueNow(monday).length, 1);
  assert.equal(auto.dueNow(tuesday).length, 0);
  auto.markRan(a.id, monday);
  assert.equal(auto.dueNow(new Date(2026, 9, 5, 9, 5, 30)).length, 0);
});

test("invalid automations are rejected", () => {
  const auto = fresh("../ai/automations");
  assert.deepEqual(auto.add({ prompt: "" }), { ok: false, reason: "invalid" });
  assert.deepEqual(auto.add({ prompt: "x", schedule: { type: "daily", time: "25:00" } }), { ok: false, reason: "invalid" });
});
