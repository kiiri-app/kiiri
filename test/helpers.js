"use strict";

// Shared test helpers. `fakeElectron()` must run before requiring a module that
// does `require("electron")` at load: in plain Node that require only returns
// the binary path, so we swap in a tiny stand-in with a temp userData dir.
const fs = require("fs");
const os = require("os");
const path = require("path");

function tempDir(prefix = "kiri-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeElectron(userData = tempDir()) {
  const id = require.resolve("electron");
  require.cache[id] = {
    id, filename: id, loaded: true,
    exports: {
      app: { getPath: () => userData, isPackaged: false, getVersion: () => "0.0.0-test" },
      safeStorage: null,
    },
  };
  return userData;
}

// Load a module fresh (drops it from the require cache first) — modules like
// ai/automations.js keep an in-memory cache we don't want shared across tests.
function fresh(modulePath) {
  const id = require.resolve(modulePath);
  delete require.cache[id];
  return require(id);
}

module.exports = { tempDir, fakeElectron, fresh };
