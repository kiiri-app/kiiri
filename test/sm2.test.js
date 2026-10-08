"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { review, MIN_EASE } = require("../ai/journal/sm2");

test("good recalls grow the interval 1 → 6 → ×ease", () => {
  let c = review({}, 4);
  assert.equal(c.intervalDays, 1);
  c = review(c, 4);
  assert.equal(c.intervalDays, 6);
  c = review(c, 4);
  assert.ok(c.intervalDays > 6);
});

test("a lapse resets to tomorrow and ease never drops below the floor", () => {
  let c = { ease: 1.3, intervalDays: 30, repetitions: 5 };
  c = review(c, 0);
  assert.equal(c.intervalDays, 1);
  assert.equal(c.repetitions, 0);
  assert.ok(c.ease >= MIN_EASE);
});
