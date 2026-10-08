"use strict";

// Character registry. Each character is an independent pet: own name, persona,
// look (kiri/tori + painted overlay, or a community petdex sheet), position and
// size. Skills/AI config stay global (shared pool). Persisted as JSON in userData.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function charactersPath() {
  return path.join(app.getPath("userData"), "characters.json");
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

// Pose-set characters: flat illustrated PNG-per-state art (kiri / tori).
// Each set ships svg/<set>_noeye.png (idle; pupils are drawn by the renderer)
// plus one sprite strip per state: _move (drag), _listening (click / voice),
// _working (AI active), _happy (task done). Built from art/src/ by
// scripts/build-pose-sheets.py, which also writes renderer/pose-manifest.js.
const POSESET_SETS = ["kiri", "tori"];
const POSESET_STATES = ["noeye", "move", "listening", "working", "happy"];
const MAX_OVERLAY_CELLS = 8000;

function hex(v, fallback) {
  return HEX.test(String(v || "")) ? String(v) : fallback;
}

// User-painted pixel layer composited over a pose-set character's idle art.
// Grid coords are normalized cell indices (0..cols-1, 0..rows-1); the renderer
// maps them across the displayed image box.
function sanitizeOverlay(o) {
  if (!o || typeof o !== "object") return null;
  const cols = Math.round(Number(o.cols));
  const rows = Math.round(Number(o.rows));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
  if (cols < 4 || cols > 128 || rows < 4 || rows > 192) return null;
  const cells = Array.isArray(o.cells) ? o.cells : [];
  const out = [];
  const seen = new Set();
  for (const c of cells) {
    if (!c || typeof c !== "object") continue;
    const x = Math.round(Number(c.x));
    const y = Math.round(Number(c.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const key = x + "," + y;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, y, color: hex(c.color, "#000000") });
    if (out.length >= MAX_OVERLAY_CELLS) break;
  }
  if (!out.length) return null;
  // Art revision the design was painted on (see ART_REV in
  // scripts/build-pose-sheets.py); unstamped = the original 2026-06 art.
  const art = Number.isInteger(o.art) && o.art > 0 ? o.art : 1;
  return { cols, rows, cells: out, art };
}

// An installed petdex/agentpets pet: we store the resolved sheet geometry with
// the character so a pet that is later uninstalled still renders (or fails
// gracefully) without re-scanning the pet folders on every launch.
function sanitizePet(p) {
  if (!p || typeof p !== "object") return null;
  const sheet = String(p.sheet || "").trim();
  if (!sheet) return null;
  const num = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    id: String(p.id || "").trim() || `petdex:${Date.now()}`,
    slug: String(p.slug || "").trim(),
    sheet,
    columns: num(p.columns, 1, 64, 8),
    rows: num(p.rows, 1, 64, 9),
    frameWidth: num(p.frameWidth, 8, 4096, 192),
    frameHeight: num(p.frameHeight, 8, 4096, 208),
    frames: num(p.frames, 1, 64, 8),
    fps: num(p.fps, 1, 24, 8),
  };
}

function sanitize(c, index) {
  if (!c || typeof c !== "object") return null;
  const id = String(c.id || "").trim() || `char-${Date.now()}-${index || 0}`;
  const name = String(c.name || "Kiri").trim().slice(0, 24) || "Kiri";
  const persona = String(c.persona || "").trim().slice(0, 500);
  let position = null;
  if (c.position && typeof c.position === "object") {
    const x = Math.round(Number(c.position.x));
    const y = Math.round(Number(c.position.y));
    if (Number.isFinite(x) && Number.isFinite(y)) position = { x, y };
  }
  const size = Number(c.size) || 0;
  // Only two kinds exist now. Saves from the retired "classic" pixel cat and
  // "sprite" presets (and anything unknown) become kiri — name, persona,
  // position and size carry over; the old pattern/sprite looks are dropped.
  const kind = c.kind === "petdex" ? "petdex" : "poseset";
  const pet = kind === "petdex" ? sanitizePet(c.pet) : null;
  if (kind === "petdex" && !pet) return null; // unusable without its sheet
  const set = kind === "poseset" ? (POSESET_SETS.includes(c.set) ? c.set : "kiri") : null;
  const overlay = kind === "poseset" && c.overlay ? sanitizeOverlay(c.overlay) : null;
  return { id, name, persona, position, size: size > 0 ? size : 0, kind, set, overlay, pet };
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(charactersPath(), "utf8"));
    return Array.isArray(data) ? data.map(sanitize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    fs.writeFileSync(charactersPath(), JSON.stringify(list || [], null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri] failed to save characters:", err && err.message);
  }
}

module.exports = {
  load, save, sanitize, sanitizeOverlay, sanitizePet, charactersPath,
  POSESET_SETS, POSESET_STATES,
};
