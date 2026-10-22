"use strict";

// NL → skill draft. Sends the user's description to Claude and parses the
// returned JSON skill definition.

const config = require("../config");
const { msg } = require("../i18n");
const llm = require("../llm"); // text-only use (no image)
const { skillAuthorSystem, skillAuthorUser } = require("../prompts");
const { sanitize } = require("./store");

function parseJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// Returns { ok, skill } (draft, not yet saved) or { error }.
async function authorSkill(description) {
  const cfg = config.loadConfig();
  if (!config.providerReady()) return { error: "no_key", message: msg("ai.noKey") };
  const desc = String(description || "").trim();
  if (!desc) return { error: "empty", message: msg("skill.empty") };

  try {
    // Text-only (no screenshot) — works across all providers.
    const { text } = await llm.callVision({
      system: skillAuthorSystem(cfg.responseLanguage),
      userText: skillAuthorUser(desc, cfg.responseLanguage),
      maxTokens: 800,
      think: false,
    });
    const parsed = parseJson(text);
    const skill = sanitize(parsed, 0);
    if (!skill) return { error: "parse", message: msg("skill.parse") };
    return { ok: true, skill };
  } catch (err) {
    return { error: "claude", message: (err && err.message) || "Hata" };
  }
}

module.exports = { authorSkill };
