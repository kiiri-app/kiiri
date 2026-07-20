"use strict";

// Scheduled automations: run a prompt on a schedule (interval or daily time).
// Two kinds:
//   - "screen": ask the vision model about the screen with `prompt` → speech
//     bubble + paw + optional spoken answer (the OpenClicky automations parity).
//   - "note":   just have the pet say `prompt` (a smart, interval-capable
//     reminder — distinct from time-of-day reminders).
// Stored as JSON in {userData}/automations.json. The scheduler + firing live in
// main.js; this module only owns validation, persistence, and due-check logic.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const MAX_AUTOMATIONS = 40;
const KINDS = ["screen", "note"];
// Interval choices (minutes) surfaced in the UI; any positive int is accepted.
const INTERVAL_CHOICES = [15, 30, 60, 120, 240, 480];

function filePath() {
  return path.join(app.getPath("userData"), "automations.json");
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map((d) => Math.round(Number(d))).filter((d) => d >= 0 && d <= 6))].sort();
}

function normalizeSchedule(schedule) {
  const s = schedule || {};
  if (s.type === "daily") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s.time || ""));
    const hh = m ? Number(m[1]) : -1;
    const mm = m ? Number(m[2]) : -1;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return {
      type: "daily",
      time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      days: normalizeDays(s.days),
    };
  }
  // Default: interval.
  return { type: "interval", everyMin: clampInt(s.everyMin, 5, 24 * 60, 60) };
}

function sanitize(raw, existing) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 60);
  const prompt = String(raw.prompt || "").trim().slice(0, 500);
  if (!prompt) return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : "screen";
  const schedule = normalizeSchedule(raw.schedule);
  if (!schedule) return null;
  return {
    id: (existing && existing.id) || (typeof raw.id === "string" && raw.id) || `auto-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name || (kind === "note" ? "Note" : "Screen check"),
    kind,
    prompt,
    schedule,
    enabled: raw.enabled !== false,
    lastRunAt: (existing && existing.lastRunAt) || (typeof raw.lastRunAt === "string" ? raw.lastRunAt : ""),
    createdAt: (existing && existing.createdAt) || (typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString()),
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const data = JSON.parse(fs.readFileSync(filePath(), "utf8"));
    cache = Array.isArray(data) ? data.map((a) => sanitize(a, a)).filter(Boolean) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  try {
    fs.writeFileSync(filePath(), JSON.stringify(cache || [], null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][automations] save failed:", err && err.message);
  }
}

function list() {
  return load().map((a) => ({ ...a }));
}

function add(payload) {
  const items = load();
  if (items.length >= MAX_AUTOMATIONS) return { ok: false, reason: "limit" };
  const item = sanitize({ ...payload, id: undefined, createdAt: new Date().toISOString(), lastRunAt: "" }, null);
  if (!item) return { ok: false, reason: "invalid" };
  items.push(item);
  cache = items;
  persist();
  return { ok: true, item, items: list() };
}

function update(id, payload) {
  const items = load();
  const i = items.findIndex((a) => a.id === id);
  if (i < 0) return { ok: false, reason: "not-found" };
  const item = sanitize({ ...items[i], ...payload }, items[i]);
  if (!item) return { ok: false, reason: "invalid" };
  items[i] = item;
  cache = items;
  persist();
  return { ok: true, item, items: list() };
}

function setEnabled(id, enabled) {
  const items = load();
  const item = items.find((a) => a.id === id);
  if (!item) return { ok: false, reason: "not-found" };
  item.enabled = !!enabled;
  persist();
  return { ok: true, items: list() };
}

function remove(id) {
  const items = load().filter((a) => a.id !== id);
  cache = items;
  persist();
  return { ok: true, items: list() };
}

// Mark an automation as just-run (throttles interval + de-dups daily per day).
function markRan(id, when = new Date()) {
  const item = load().find((a) => a.id === id);
  if (!item) return;
  item.lastRunAt = when.toISOString();
  persist();
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Which enabled automations are due right now? Interval: at least `everyMin`
// since the last run (first run one interval after creation). Daily: matches
// HH:MM + weekday and hasn't run yet today.
function dueNow(now = new Date()) {
  const due = [];
  for (const a of load()) {
    if (!a.enabled) continue;
    const s = a.schedule;
    if (s.type === "interval") {
      const base = a.lastRunAt || a.createdAt;
      const baseMs = base ? Date.parse(base) : 0;
      if (!baseMs || now.getTime() - baseMs >= s.everyMin * 60 * 1000) due.push(a);
    } else if (s.type === "daily") {
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (`${hh}:${mm}` !== s.time) continue;
      if (s.days.length && !s.days.includes(now.getDay())) continue;
      const lastYmd = a.lastRunAt ? ymd(new Date(a.lastRunAt)) : "";
      if (lastYmd !== ymd(now)) due.push(a);
    }
  }
  return due;
}

module.exports = {
  KINDS,
  INTERVAL_CHOICES,
  MAX_AUTOMATIONS,
  list,
  add,
  update,
  setEnabled,
  remove,
  markRan,
  dueNow,
};
