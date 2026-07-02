"use strict";

// Knowledge Journal — flashcards the cat saved (questions it solved, concepts it
// explained, or manual cards). Scheduled with SM-2. Persisted as JSON in userData.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const sm2 = require("./sm2");

const DAY_MS = 24 * 60 * 60 * 1000;

function journalPath() {
  return path.join(app.getPath("userData"), "ai-journal.json");
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(journalPath(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persist(cards) {
  try {
    fs.writeFileSync(journalPath(), JSON.stringify(cards, null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][journal] save failed:", err && err.message);
  }
}

let seq = 0;
function add({ question, answer, source } = {}) {
  const q = String(question || "").trim().slice(0, 500);
  const a = String(answer || "").trim().slice(0, 4000);
  if (!q || !a) return null;
  const now = Date.now();
  const card = {
    id: `card-${now}-${seq++}`,
    question: q,
    answer: a,
    source: String(source || "manual").slice(0, 24),
    createdAt: now,
    // SM-2 state — new cards are due immediately.
    ease: sm2.DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now,
    lastReviewedAt: null,
    reviewCount: 0,
  };
  const cards = load();
  cards.push(card);
  persist(cards);
  return card;
}

function list() {
  return load().sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
}

function dueCards(now = Date.now()) {
  return load()
    .filter((c) => (c.dueAt || 0) <= now)
    .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
}

function dueCount(now = Date.now()) {
  return load().reduce((n, c) => n + ((c.dueAt || 0) <= now ? 1 : 0), 0);
}

function review(id, quality) {
  const cards = load();
  const card = cards.find((c) => c.id === id);
  if (!card) return null;
  const next = sm2.review(card, quality);
  card.ease = next.ease;
  card.intervalDays = next.intervalDays;
  card.repetitions = next.repetitions;
  card.dueAt = Date.now() + next.intervalDays * DAY_MS;
  card.lastReviewedAt = Date.now();
  card.reviewCount = (card.reviewCount || 0) + 1;
  persist(cards);
  return card;
}

function remove(id) {
  persist(load().filter((c) => c.id !== String(id)));
  return list();
}

function stats(now = Date.now()) {
  const cards = load();
  return { total: cards.length, due: cards.filter((c) => (c.dueAt || 0) <= now).length };
}

module.exports = { add, list, dueCards, dueCount, review, remove, stats };
