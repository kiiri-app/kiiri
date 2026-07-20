"use strict";

// App-awareness: what app is the user in right now? Fed to the vision model as
// context so screen answers are sharper ("you're in VS Code → likely a code
// question"). macOS-only for now.
//
// Uses `path to frontmost application` (a StandardAdditions command), which
// resolves the frontmost GUI app WITHOUT triggering an Automation/Accessibility
// consent prompt — unlike scripting System Events. App name only (no window
// title, which would need Accessibility). Degrades to null on any failure, so
// callers treat app-context as purely additive.

const { execFile } = require("child_process");

const CACHE_TTL_MS = 3000;
let cached = { name: null, at: 0 };

function queryFrontmostApp() {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") return resolve(null);
    execFile(
      "/usr/bin/osascript",
      ["-e", "return name of (info for (path to frontmost application))"],
      { timeout: 1500 },
      (err, stdout) => {
        if (err) return resolve(null);
        let name = String(stdout || "").trim();
        if (name.toLowerCase().endsWith(".app")) name = name.slice(0, -4);
        resolve(name || null);
      }
    );
  });
}

// Returns the frontmost app name (cached ~3s), or null. Never throws.
async function frontmostApp() {
  const now = Date.now();
  if (cached.name !== null && now - cached.at < CACHE_TTL_MS) return cached.name;
  try {
    const name = await queryFrontmostApp();
    cached = { name, at: now };
    return name;
  } catch {
    return null;
  }
}

module.exports = { frontmostApp };
