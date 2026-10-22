"use strict";

// Free-form chat: a multi-turn text conversation with the pet. Distinct from the
// screen-question flow (no screenshot) and the command agent (no tools). One
// conversation per character id, persisted to {userData}/chats/<charId>.json so
// it survives restarts ("pick up where you left off"). The window shows the
// stored thread (capped at MAX_STORED); only the last MAX_TURNS go to the model.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const config = require("./config");
const { msg } = require("./i18n");
const llm = require("./llm");
const { classifyError } = llm;
const { chatSystem } = require("./prompts");

const MAX_TURNS = 24;           // last N messages (user+assistant) sent to the model
const MAX_STORED = 200;         // messages kept on disk / shown in the window
const sessions = new Map();     // charId -> [{ role, text, ts }] (lazy-loaded cache)
let controller = null;

function chatDir() {
  return path.join(app.getPath("userData"), "chats");
}

// charId is app-generated but sanitize so it can never escape the chats dir.
function chatFile(charId) {
  const base = String(charId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default";
  return path.join(chatDir(), `${base}.json`);
}

function loadSession(key) {
  if (sessions.has(key)) return sessions.get(key);
  let arr = [];
  try {
    const data = JSON.parse(fs.readFileSync(chatFile(key), "utf8"));
    if (Array.isArray(data)) {
      arr = data
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .map((m) => ({ role: m.role, text: m.text, ts: Number(m.ts) || 0 }))
        .slice(-MAX_STORED);
    }
  } catch {}
  sessions.set(key, arr);
  return arr;
}

function persist(key) {
  try {
    fs.mkdirSync(chatDir(), { recursive: true });
    fs.writeFileSync(chatFile(key), JSON.stringify(sessions.get(key) || []), "utf8");
  } catch (err) {
    console.warn("[Kiri][ai] chat save failed:", err && err.message);
  }
}

function history(charId) {
  return loadSession(charId || "_");
}

// The slice the model sees: last MAX_TURNS, never starting on an assistant turn
// (keeps role alternation sane for providers that require user-first).
function contextWindow(arr) {
  const out = arr.slice(-MAX_TURNS);
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function reset(charId) {
  const key = charId || "_";
  sessions.set(key, []);
  try { fs.unlinkSync(chatFile(key)); } catch {}
  return { ok: true };
}

// A deleted character's conversation goes with it.
function deleteChar(charId) {
  const key = charId || "_";
  sessions.delete(key);
  try { fs.unlinkSync(chatFile(key)); } catch {}
}

function pushTurn(charId, role, text) {
  const key = charId || "_";
  const arr = loadSession(key);
  arr.push({ role, text: String(text || ""), ts: Date.now() });
  while (arr.length > MAX_STORED) arr.shift();
  persist(key);
  return arr;
}

// Send one user message; streams the reply via onDelta(textSoFar). Resolves
// { ok, text } or { error, message }. `opts`: { charId, catName, persona,
// memory, appContext }.
async function send(userText, opts = {}, onDelta) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled", message: msg("ai.disabled") };
  if (!config.providerReady()) {
    return { error: "no_key", message: msg("ai.noKey") };
  }
  const text = String(userText || "").trim();
  if (!text) return { error: "empty" };

  const charId = opts.charId || "_";
  pushTurn(charId, "user", text);

  controller = new AbortController();
  const callOpts = {
    system: chatSystem(cfg.responseLanguage, opts.catName, opts.persona, opts.memory, opts.appContext),
    messages: contextWindow(history(charId)).map((m) => ({ role: m.role, text: m.text })),
    maxTokens: 1024,
    think: false,
    signal: controller.signal,
  };
  try {
    let acc = "";
    const res = await llm.callChatStream(callOpts, (piece) => {
      acc += piece;
      if (typeof onDelta === "function") onDelta(acc);
    });
    const answer = (res && res.text) || acc;
    pushTurn(charId, "assistant", answer);
    return { ok: true, text: answer || "(boş yanıt)" };
  } catch (err) {
    const info = classifyError(err);
    // Drop the user turn we optimistically pushed if the call failed, so a retry
    // doesn't duplicate it.
    const arr = sessions.get(charId);
    if (arr && arr.length && arr[arr.length - 1].role === "user") { arr.pop(); persist(charId); }
    return { error: info.code, message: info.message };
  } finally {
    controller = null;
  }
}

function cancel() {
  if (controller) { try { controller.abort(); } catch {} controller = null; }
}

module.exports = { send, cancel, reset, history, deleteChar, contextWindow };
