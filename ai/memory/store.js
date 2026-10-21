"use strict";

// Per-character memory. Each character remembers the AI work it did (summaries,
// screen answers, files it made) so it can pick up where it left off across
// restarts. Source of truth is JSON (easy for the memory window); a Markdown
// mirror is written alongside so the user can read/edit it by hand.
//
//   {userData}/memory/<charId>.json  — [{ id, ts, kind, title, detail }]
//   {userData}/memory/<charId>.md    — human-readable mirror
//
// This is distinct from the Knowledge Journal (SM-2 flashcards, a shared pool
// for the user's own study): memory is private per-character work history and is
// fed back to the model as context.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const MAX_ENTRIES = 200;          // hard cap kept on disk per character
const CONTEXT_ENTRIES = 10;       // how many recent entries feed the prompt
const CONTEXT_DETAIL_CHARS = 200; // per-entry detail truncation for context

const KIND_LABEL = {
  task: "📝 Görev",
  screen: "🔍 Ekran sorusu",
  command: "📦 Dosya",
  computer: "🖱 Bilgisayar",
  note: "🗒️ Not",
};

function memoryDir() {
  return path.join(app.getPath("userData"), "memory");
}

// charId is app-generated (`char-<ts>-<n>`) but sanitize defensively so it can
// never escape the memory dir.
function safeId(charId) {
  const base = String(charId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return base || "default";
}

function jsonPath(charId) {
  return path.join(memoryDir(), `${safeId(charId)}.json`);
}
function mdPath(charId) {
  return path.join(memoryDir(), `${safeId(charId)}.md`);
}

function ensureDir() {
  try { fs.mkdirSync(memoryDir(), { recursive: true }); } catch {}
}

function list(charId) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath(charId), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function pad2(n) { return String(n).padStart(2, "0"); }
function formatTs(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function renderMarkdown(charId, entries, charName) {
  const title = charName ? `${charName} — Hafıza` : "Kiri — Hafıza";
  const lines = [`# ${title}`, ""];
  for (const e of entries) {
    const label = KIND_LABEL[e.kind] || "🗒️ Not";
    lines.push(`## ${formatTs(e.ts)} · ${label}`);
    if (e.title) lines.push(`**${e.title}**`);
    if (e.detail) lines.push("", e.detail);
    lines.push("");
  }
  return lines.join("\n");
}

function persist(charId, entries, charName) {
  ensureDir();
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try {
    fs.writeFileSync(jsonPath(charId), JSON.stringify(trimmed, null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][memory] json save failed:", err && err.message);
  }
  try {
    fs.writeFileSync(mdPath(charId), renderMarkdown(charId, trimmed, charName), "utf8");
  } catch (err) {
    console.warn("[Kiri][memory] md save failed:", err && err.message);
  }
  return trimmed;
}

let seq = 0;
function add(charId, entry, charName) {
  if (!charId || !entry) return null;
  const clean = {
    id: `mem-${Date.now()}-${seq++}`,
    ts: Date.now(),
    kind: KIND_LABEL[entry.kind] ? entry.kind : "note",
    title: String(entry.title || "").trim().slice(0, 200),
    detail: String(entry.detail || "").trim().slice(0, 4000),
  };
  if (!clean.title && !clean.detail) return null;
  const entries = list(charId);
  entries.unshift(clean);
  persist(charId, entries, charName);
  return clean;
}

function remove(charId, id) {
  const entries = list(charId);
  const next = entries.filter((e) => e.id !== id);
  persist(charId, next);
  return { ok: next.length !== entries.length };
}

function clear(charId) {
  persist(charId, []);
  return { ok: true };
}

function deleteChar(charId) {
  try { fs.unlinkSync(jsonPath(charId)); } catch {}
  try { fs.unlinkSync(mdPath(charId)); } catch {}
}

// A compact, prompt-ready block of the most recent work, newest first. Returns
// "" when the character has no history yet.
function recentContext(charId, n = CONTEXT_ENTRIES) {
  const entries = list(charId).slice(0, n);
  if (!entries.length) return "";
  const lines = entries.map((e) => {
    const label = (KIND_LABEL[e.kind] || "Not").replace(/^[^\wçğıöşü]+/i, "").trim();
    const detail = e.detail ? ` → ${e.detail.slice(0, CONTEXT_DETAIL_CHARS)}` : "";
    return `- (${formatTs(e.ts)}) ${label}: ${e.title}${detail}`;
  });
  return lines.join("\n");
}

module.exports = { add, list, remove, clear, deleteChar, recentContext, mdPath, MAX_ENTRIES };
