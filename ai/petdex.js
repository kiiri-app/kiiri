"use strict";

// Petdex / agentpets sprite-sheet reader.
//
// petdex.dev and agentpets.dev both publish community pets in the same simple
// shape: a folder holding `pet.json` plus one spritesheet laid out as a grid of
// equal frames — 8 columns × 9 rows by default, one row per animation state.
// Their CLIs install into ~/.codex/pets/<slug>/, so a user who already ran
// `npx petdex install <slug>` gets those pets in Kiri for free.
//
// The format itself is not anyone's IP, and the artwork stays where the user
// installed it — Kiri never bundles or redistributes it. (Gallery pets are
// user-submitted fan art; Kiri ships only its own original characters.)

const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_COLUMNS = 8;
const DEFAULT_ROWS = 9;
const SHEET_NAMES = ["spritesheet.webp", "spritesheet.png", "sprite.png", "sheet.png"];

// Row order of the petdex v1 atlas. Kiri maps its own states onto these.
const ROW_STATES = [
  "idle", "running-right", "running-left", "waving",
  "jumping", "failed", "waiting", "running", "review",
];

// Kiri state → petdex row name, with fallbacks when a sheet has fewer rows.
const STATE_ROW_NAME = {
  idle: "idle",
  listening: "waving",
  working: "running",
  move: "jumping",
  complete: "waving",
  error: "failed",
  thinking: "waiting",
};

function petDirs() {
  const home = os.homedir();
  return [
    path.join(home, ".codex", "pets"),      // petdex CLI (also used by agentpets)
    path.join(home, ".agentpets", "pets"),
    path.join(home, ".kiri", "pets"),       // hand-dropped pets
  ];
}

// ── Image dimensions without a decoder ──────────────────────────────────────
// The frame size is sheetWidth/columns, so we need the pixel size of a PNG or
// WebP. Both keep it in a fixed header, so a few bytes are enough — no native
// image dependency in the main process.
function imageSize(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(64);
    fs.readSync(fd, head, 0, 64, 0);
    if (head.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }
    if (head.slice(0, 4).toString("ascii") === "RIFF" && head.slice(8, 12).toString("ascii") === "WEBP") {
      const fourcc = head.slice(12, 16).toString("ascii");
      if (fourcc === "VP8X") {
        // 24-bit little-endian (value - 1) at offsets 24 / 27.
        const w = head[24] | (head[25] << 8) | (head[26] << 16);
        const h = head[27] | (head[28] << 8) | (head[29] << 16);
        return { width: w + 1, height: h + 1 };
      }
      if (fourcc === "VP8L") {
        const bits = head.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (fourcc === "VP8 ") {
        return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function findSheet(dir) {
  for (const name of SHEET_NAMES) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return file;
  }
  // Fall back to any image in the folder (some pets ship <slug>.png).
  try {
    const hit = fs.readdirSync(dir).find((f) => /\.(png|webp)$/i.test(f));
    return hit ? path.join(dir, hit) : null;
  } catch {
    return null;
  }
}

// One installed pet → everything the renderer needs to animate it.
function readPet(dir) {
  const meta = readJson(path.join(dir, "pet.json")) || {};
  const sheet = findSheet(dir);
  if (!sheet) return null;
  const size = imageSize(sheet);
  if (!size || !size.width || !size.height) return null;

  const columns = Math.max(1, Math.round(Number(meta.columns || meta.cols || DEFAULT_COLUMNS)));
  const rows = Math.max(1, Math.round(Number(meta.rows || DEFAULT_ROWS)));
  const frameWidth = Math.round(Number(meta.frameWidth) || size.width / columns);
  const frameHeight = Math.round(Number(meta.frameHeight) || size.height / rows);
  if (frameWidth < 8 || frameHeight < 8) return null;

  const slug = String(meta.slug || meta.id || path.basename(dir)).trim();
  return {
    id: `petdex:${slug}`,
    slug,
    name: String(meta.name || meta.title || slug).trim().slice(0, 24) || slug,
    author: String(meta.author || meta.creator || "").trim() || null,
    dir,
    sheet,
    columns,
    rows,
    frameWidth,
    frameHeight,
    // Frames-per-row can be shorter than the grid for hand-made pets.
    frames: Math.max(1, Math.min(columns, Math.round(Number(meta.frames) || columns))),
    fps: Math.max(1, Math.min(24, Math.round(Number(meta.fps) || 8))),
  };
}

function listPets() {
  const pets = [];
  const seen = new Set();
  for (const base of petDirs()) {
    let entries;
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pet = readPet(path.join(base, entry.name));
      if (!pet || seen.has(pet.id)) continue;
      seen.add(pet.id);
      pets.push(pet);
    }
  }
  return pets.sort((a, b) => a.name.localeCompare(b.name));
}

function findPet(id) {
  return listPets().find((p) => p.id === id) || null;
}

// Which sheet row plays for a Kiri state, resolved against the rows this
// particular sheet actually has (short sheets fall back to idle = row 0).
function rowForState(pet, state) {
  const wanted = STATE_ROW_NAME[state] || "idle";
  const index = ROW_STATES.indexOf(wanted);
  if (index < 0 || index >= (pet ? pet.rows : 0)) return 0;
  return index;
}

module.exports = {
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  ROW_STATES,
  STATE_ROW_NAME,
  petDirs,
  imageSize,
  readPet,
  listPets,
  findPet,
  rowForState,
};
