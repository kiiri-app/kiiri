"use strict";

// Saved skills — reusable command templates the user authors once and re-runs.
// Stored as JSON in userData. Mirrors Mentat's SavedPlan/PlanStore.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const VALID_TOOLS = ["create_pptx", "create_docx", "write_file", "create_xlsx", "create_csv", "create_json"];

function storePath() {
  return path.join(app.getPath("userData"), "ai-skills.json");
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), "utf8"));
    return Array.isArray(data) ? data.map(sanitize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    fs.writeFileSync(storePath(), JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][ai] skill store save failed:", err && err.message);
  }
}

function sanitize(skill, index) {
  if (!skill || typeof skill !== "object") return null;
  const name = String(skill.name || "").trim().slice(0, 60);
  const instruction = String(skill.instruction || "").trim().slice(0, 2000);
  if (!name || !instruction) return null;
  const triggers = Array.isArray(skill.triggers)
    ? skill.triggers.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : [];
  const tools = Array.isArray(skill.tools)
    ? skill.tools.filter((t) => VALID_TOOLS.includes(t))
    : [];
  return {
    id: String(skill.id || "").trim() || `skill-${Date.now()}-${index || 0}`,
    name,
    emoji: String(skill.emoji || "✨").trim().slice(0, 4) || "✨",
    triggers,
    instruction,
    tools: tools.length ? tools : VALID_TOOLS.slice(),
  };
}

function list() {
  return load();
}

// Seed the store with starter skills on the very first run (file absent), so a
// fresh command window isn't empty. Once the file exists — even if the user
// deleted every skill — we never re-seed, so their choice sticks.
function seedIfEmpty(skills) {
  if (fs.existsSync(storePath())) return list();
  const clean = (Array.isArray(skills) ? skills : []).map(sanitize).filter(Boolean);
  if (clean.length) persist(clean);
  return clean;
}

function save(skill) {
  const clean = sanitize(skill, 0);
  if (!clean) return list();
  const all = load().filter((s) => s.id !== clean.id);
  all.push(clean);
  persist(all);
  return all;
}

function remove(id) {
  const all = load().filter((s) => s.id !== String(id));
  persist(all);
  return all;
}

module.exports = { list, save, remove, seedIfEmpty, sanitize, VALID_TOOLS };
