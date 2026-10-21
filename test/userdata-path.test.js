"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { resolveUserDataDir, applyUserDataPath } = require("../userdata-path");

const APP_DATA = path.join("/home", "u", "AppData");
const LEGACY = path.join(APP_DATA, "Kiri");
const CURRENT = path.join(APP_DATA, "Kiiri");

function fakeFs(files) {
  const set = new Set(files);
  return (p) => set.has(p);
}

test("fresh install gets the new Kiiri folder", () => {
  assert.equal(resolveUserDataDir(APP_DATA, fakeFs([])), CURRENT);
});

test("pre-rename install keeps its legacy Kiri folder", () => {
  assert.equal(resolveUserDataDir(APP_DATA, fakeFs([path.join(LEGACY, "settings.json")])), LEGACY);
  assert.equal(resolveUserDataDir(APP_DATA, fakeFs([path.join(LEGACY, "characters.json")])), LEGACY);
});

test("Kiiri wins once it has data, even if a legacy folder is still around", () => {
  const exists = fakeFs([path.join(LEGACY, "settings.json"), path.join(CURRENT, "settings.json")]);
  assert.equal(resolveUserDataDir(APP_DATA, exists), CURRENT);
});

test("a legacy folder with only caches does not count as an install", () => {
  assert.equal(resolveUserDataDir(APP_DATA, fakeFs([path.join(LEGACY, "Cache")])), CURRENT);
});

test("applyUserDataPath never throws, even if Electron refuses", () => {
  const app = { getPath: () => { throw new Error("not ready"); }, setPath: () => {} };
  assert.doesNotThrow(() => applyUserDataPath(app));
});
