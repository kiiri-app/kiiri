"use strict";

// Free-form chat: a multi-turn text conversation with the pet. Distinct from the
// screen-question flow (no screenshot) and the command agent (no tools). Holds
// one in-memory conversation per character id; the running history is sent on
// each turn so the model keeps context. History is capped to keep tokens sane.

const config = require("./config");
const llm = require("./llm");
const { classifyError } = llm;
const { chatSystem } = require("./prompts");

const MAX_TURNS = 24;           // keep the last N messages (user+assistant)
const sessions = new Map();     // charId -> [{ role, text, ts }]
let controller = null;

function history(charId) {
  return sessions.get(charId || "_") || [];
}

function reset(charId) {
  sessions.delete(charId || "_");
  return { ok: true };
}

function pushTurn(charId, role, text) {
  const key = charId || "_";
  const arr = sessions.get(key) || [];
  arr.push({ role, text: String(text || ""), ts: Date.now() });
  // Trim oldest but never start on an assistant turn (keeps role alternation sane).
  while (arr.length > MAX_TURNS) arr.shift();
  sessions.set(key, arr);
  return arr;
}

// Send one user message; streams the reply via onDelta(textSoFar). Resolves
// { ok, text } or { error, message }. `opts`: { charId, catName, persona,
// memory, appContext }.
async function send(userText, opts = {}, onDelta) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled", message: "AI kapalı." };
  if (!config.providerReady()) {
    return { error: "no_key", message: "Önce ayarlardan sağlayıcı anahtarını gir (Ollama için gerekmez)." };
  }
  const text = String(userText || "").trim();
  if (!text) return { error: "empty" };

  const charId = opts.charId || "_";
  pushTurn(charId, "user", text);

  controller = new AbortController();
  const callOpts = {
    system: chatSystem(cfg.responseLanguage, opts.catName, opts.persona, opts.memory, opts.appContext),
    messages: history(charId).map((m) => ({ role: m.role, text: m.text })),
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
    if (arr && arr.length && arr[arr.length - 1].role === "user") arr.pop();
    return { error: info.code, message: info.message };
  } finally {
    controller = null;
  }
}

function cancel() {
  if (controller) { try { controller.abort(); } catch {} controller = null; }
}

module.exports = { send, cancel, reset, history };
