"use strict";

// The product was renamed Kiri → Kiiri. Electron derives the userData folder
// from productName, so the rename alone would point existing installs at an
// empty "Kiiri" folder and lose their settings, characters, memory and chats.
// Existing installs keep using their legacy "Kiri" folder (no move: nothing to
// lose if the app is killed mid-way); fresh installs get "Kiiri".
// Must run before anything calls app.getPath("userData") — including the
// single-instance lock — so main.js requires this first.

const path = require("path");
const fs = require("fs");

const LEGACY_DIR_NAME = "Kiri";
const CURRENT_DIR_NAME = "Kiiri";

// Settings files only an existing install has; a bare Chromium cache doesn't count.
const MARKER_FILES = ["settings.json", "characters.json", "ai-config.json"];

function hasInstallData(dir, existsSync = fs.existsSync) {
  return MARKER_FILES.some((file) => existsSync(path.join(dir, file)));
}

// Picks the userData folder for this machine. Pure apart from existsSync, so tests can fake it.
function resolveUserDataDir(appDataDir, existsSync = fs.existsSync) {
  const current = path.join(appDataDir, CURRENT_DIR_NAME);
  const legacy = path.join(appDataDir, LEGACY_DIR_NAME);
  if (hasInstallData(current, existsSync)) return current;
  if (hasInstallData(legacy, existsSync)) return legacy;
  return current;
}

// Also keeps saved secrets readable. safeStorage encrypts with a Keychain entry
// named after the app ("Kiri Safe Storage"), captured from the name set before
// "ready": an install that still lives in the legacy folder must start under
// the legacy name, or every saved API key / token fails to decrypt. main.js sets
// the display name to "Kiiri" after ready, which leaves the key entry alone.
function applyUserDataPath(app) {
  try {
    const dir = resolveUserDataDir(app.getPath("appData"));
    if (path.basename(dir) === LEGACY_DIR_NAME) app.setName(LEGACY_DIR_NAME);
    app.setPath("userData", dir);
  } catch {
    // Fall back to Electron's default rather than refusing to start.
  }
}

module.exports = { resolveUserDataDir, applyUserDataPath, LEGACY_DIR_NAME, CURRENT_DIR_NAME };
