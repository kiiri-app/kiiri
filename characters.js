"use strict";

// Character registry. Each character is an independent cat: own name, persona,
// appearance (pattern), position and size. Skills/AI config stay global (shared
// pool). Persisted as JSON in userData. Migration from the old single-cat state
// happens in main.js (it owns the legacy globals).

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function charactersPath() {
  return path.join(app.getPath("userData"), "characters.json");
}

const EARS = ["cat", "round", "totoro"];
const ACCESSORY = ["none", "bow", "leaf"];
const FACE = ["grin", "calm"];
const HEX = /^#[0-9a-fA-F]{3,8}$/;

// Pose-set characters: flat illustrated PNG-per-state art (kiri / tori).
// Each set ships 4 state images: <set>_noeye (idle/look), _move (drag),
// _listening (click), _working (AI active). New, more efficient than the
// old rigged-SVG sprite path — just an <img> swap + lean-follow + pixel overlay.
const POSESET_SETS = ["kiri", "tori"];
const POSESET_STATES = ["noeye", "move", "listening", "working"];
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
  return { cols, rows, cells: out };
}

function sanitizeSprite(s) {
  const sp = s && typeof s === "object" ? s : {};
  return {
    ears: EARS.includes(sp.ears) ? sp.ears : "cat",
    accessory: ACCESSORY.includes(sp.accessory) ? sp.accessory : "none",
    face: FACE.includes(sp.face) ? sp.face : "grin",
    marks: !!sp.marks,
    whiskers: sp.whiskers === undefined ? true : !!sp.whiskers,
    body: hex(sp.body, "#8aa0b8"),
    belly: hex(sp.belly, "#efe6d2"),
    eye: hex(sp.eye, "#1e1e1e"),
    accent: hex(sp.accent, "#d94a3a"),
    mouth: hex(sp.mouth, "#6b3b2a"),
  };
}

// Built-in Ghibli-resembling presets (original, not copies).
const SPRITE_PRESETS = {
  kedibus: { label: "Kedibüs", sprite: { ears: "cat", accessory: "none", face: "grin", marks: false, whiskers: true, body: "#d99a5b", belly: "#f0dcc0", eye: "#1e1e1e", accent: "#b56a2e", mouth: "#7a4a2a" } },
  jiji:    { label: "Papyonlu Kedi", sprite: { ears: "cat", accessory: "bow", face: "calm", marks: false, whiskers: true, body: "#26262b", belly: "#3a3a42", eye: "#1a1a1a", accent: "#d23b2e", mouth: "#222222" } },
  totoro:  { label: "Orman Ruhu", sprite: { ears: "totoro", accessory: "leaf", face: "calm", marks: true, whiskers: true, body: "#7e93ab", belly: "#efe6d2", eye: "#1e1e1e", accent: "#3a3a3a", mouth: "#5a4636" } },
};

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
  const pattern = c.pattern && typeof c.pattern === "object" ? c.pattern : null;
  let position = null;
  if (c.position && typeof c.position === "object") {
    const x = Math.round(Number(c.position.x));
    const y = Math.round(Number(c.position.y));
    if (Number.isFinite(x) && Number.isFinite(y)) position = { x, y };
  }
  const size = Number(c.size) || 0;
  const kind = c.kind === "sprite" ? "sprite"
    : c.kind === "poseset" ? "poseset"
    : c.kind === "petdex" ? "petdex"
    : "classic";
  const pet = kind === "petdex" ? sanitizePet(c.pet) : null;
  if (kind === "petdex" && !pet) return null; // unusable without its sheet
  const sprite = kind === "sprite" ? sanitizeSprite(c.sprite) : (c.sprite ? sanitizeSprite(c.sprite) : null);
  const set = POSESET_SETS.includes(c.set) ? c.set : (kind === "poseset" ? "kiri" : null);
  const overlay = c.overlay ? sanitizeOverlay(c.overlay) : null;
  return { id, name, persona, pattern, position, size: size > 0 ? size : 0, kind, sprite, set, overlay, pet };
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
  load, save, sanitize, sanitizeSprite, sanitizeOverlay, sanitizePet, charactersPath,
  SPRITE_PRESETS, POSESET_SETS, POSESET_STATES,
};
