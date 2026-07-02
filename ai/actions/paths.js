"use strict";

// Output sandbox. Every file an executor writes lives under
// ~/Documents/Kiri/<folder>/. Path traversal outside this root is blocked —
// this is a load-bearing safety boundary (ported from Mentat's red line).

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function outputRoot() {
  return path.join(app.getPath("documents"), "Kiri");
}

// snake-case, ascii-safe, no separators or traversal.
function sanitizeBaseName(name, fallback) {
  let base = String(name || "").trim().toLowerCase();
  base = base
    .replace(/[ı]/g, "i").replace(/[ş]/g, "s").replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u").replace(/[ö]/g, "o").replace(/[ç]/g, "c");
  base = base.normalize("NFD").replace(/[̀-ͯ]/g, ""); // strip accents
  base = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  base = base.slice(0, 60);
  return base || fallback || "kiri";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Resolves a guaranteed-unique absolute path under the sandbox, or throws if the
// computed path would escape the root.
function resolveOutputPath(folder, baseName, ext) {
  const root = outputRoot();
  const dir = path.join(root, sanitizeBaseName(folder, "dosyalar"));
  ensureDir(dir);
  const safeExt = String(ext || "").replace(/[^a-z0-9]/gi, "").toLowerCase() || "txt";
  let base = sanitizeBaseName(baseName, "kiri");
  let candidate = path.join(dir, `${base}.${safeExt}`);

  // Reject anything that escaped the root.
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("path traversal blocked");
  }

  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}-${i}.${safeExt}`);
    i += 1;
  }
  return candidate;
}

module.exports = { outputRoot, sanitizeBaseName, ensureDir, resolveOutputPath };
