"use strict";

// Append-only action ledger (JSON). Records every executed action so it can be
// shown in history and undone. Mirrors Mentat's ActionLedger.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function ledgerPath() {
  return path.join(app.getPath("userData"), "ai-action-ledger.json");
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(ledgerPath(), "utf8")) || [];
  } catch {
    return [];
  }
}

function save(entries) {
  try {
    fs.writeFileSync(ledgerPath(), JSON.stringify(entries.slice(0, 200), null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][ai] ledger save failed:", err && err.message);
  }
}

let seq = 0;
function record(action, result) {
  const entries = load();
  const entry = {
    id: `act-${Date.now()}-${seq++}`,
    ts: Date.now(),
    type: action.type,
    summary: action.summary || "",
    path: (result && result.path) || null,
    status: "executed",
  };
  entries.unshift(entry);
  save(entries);
  return entry;
}

function markReverted(id) {
  const entries = load();
  const e = entries.find((x) => x.id === id);
  if (e) {
    e.status = "reverted";
    save(entries);
  }
}

function recent(limit = 20) {
  return load().slice(0, limit);
}

function find(id) {
  if (!id) return null;
  return load().find((x) => x.id === id) || null;
}

module.exports = { record, markReverted, recent, find };
