#!/usr/bin/env node
// `node --check` every first-party JS file (CI + pre-commit sanity). Catches the
// syntax errors that otherwise only surface when a window happens to load.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP = new Set(["node_modules", "dist", "out", "build", ".git", "art"]);

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.name.endsWith(".js")) yield p;
  }
}

let failed = 0, count = 0;
for (const file of walk(ROOT)) {
  count++;
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failed++;
    process.stderr.write(`✖ ${path.relative(ROOT, file)}\n${err.stderr}\n`);
  }
}
console.log(`${count - failed}/${count} files OK`);
process.exit(failed ? 1 : 0);
