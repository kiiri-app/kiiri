"use strict";

// Command agent: the text/voice-driven path. Routes a command to a saved skill
// (or a one-off plan), plans actions with Claude tool-use, and — after approval —
// executes them through the executor registry with an undoable ledger entry.

const path = require("path");
const { shell } = require("electron");
const config = require("./config");
const paths = require("./actions/paths");
const registry = require("./actions/registry");
const planner = require("./actions/planner");
const ledger = require("./actions/ledger");
const { classifyError } = require("./llm");
const { msg } = require("./i18n");
const skillStore = require("./skills/store");
const skillRouter = require("./skills/router");
const skillAuthor = require("./skills/author");
const { bundledSkills, instructionHash, LEGACY_HASHES, V1_IDS } = require("./skills/bundled");

const pendingPlans = new Map(); // planId -> { actions }
let planSeq = 0;
let activeController = null;

function newController() {
  if (activeController) { try { activeController.abort(); } catch {} }
  activeController = new AbortController();
  return activeController;
}
function cancelInflight() {
  if (activeController) { try { activeController.abort(); } catch {} activeController = null; }
}

// ---- Skills ----
function listSkills() {
  return skillStore.list();
}
// Seed the starter skills on first run; on later runs add new starters and
// upgrade unedited copies (user-edited or deleted ones are left alone).
function seedSkills(lang) {
  return skillStore.syncBundled(bundledSkills(lang), {
    instructionHash,
    legacyHashes: LEGACY_HASHES,
    legacyIds: V1_IDS,
  });
}
async function authorSkill(description) {
  return skillAuthor.authorSkill(description);
}
function saveSkill(skill) {
  return skillStore.save(skill);
}
function deleteSkill(id) {
  return skillStore.remove(id);
}

// ---- Command → plan ----
async function runCommand({ commandText, catName, persona, memory } = {}) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled", message: msg("ai.disabled") };
  if (!config.providerReady()) return { error: "no_key", message: msg("ai.noKey") };
  const text = String(commandText || "").trim();
  if (!text) return { error: "empty", message: msg("agent.emptyCommand") };

  const matched = skillRouter.matchSkill(text, skillStore.list());
  const instruction = matched
    ? matched.instruction
    : "Kullanıcının komutunu en iyi şekilde yerine getir. Dosya/sunum/belge gerekiyorsa uygun aracı kullan.";
  const allowedTypes = matched && matched.tools && matched.tools.length ? matched.tools : undefined;

  const controller = newController();
  let result;
  try {
    result = await planner.plan({
      lang: cfg.responseLanguage,
      catName,
      persona,
      memory,
      style: cfg.writingStyle,
      instruction,
      commandText: text,
      allowedTypes,
      webSearch: config.webSearchUsable(),
      signal: controller.signal,
    });
  } catch (err) {
    const info = classifyError(err);
    return { error: info.code, message: info.message };
  } finally {
    if (activeController === controller) activeController = null;
  }

  if (!result.actions.length) {
    return { type: "text", text: result.text || msg("agent.noAction") };
  }

  const planId = `plan-${Date.now()}-${planSeq++}`;
  pendingPlans.set(planId, { actions: result.actions });
  return {
    type: "plan",
    planId,
    skill: matched ? { name: matched.name, emoji: matched.emoji } : null,
    text: result.text,
    actions: result.actions.map((a) => ({ type: a.type, summary: a.summary })),
    sources: result.sources || [],
  };
}

// ---- Approve → execute ----
async function approve(planId) {
  const plan = pendingPlans.get(planId);
  if (!plan) return { error: "expired", message: msg("agent.planExpired") };
  pendingPlans.delete(planId);

  const results = [];
  for (const action of plan.actions) {
    const executor = registry.get(action.type);
    if (!executor) continue;
    try {
      const res = await executor.execute(action.input);
      const entry = ledger.record({ type: action.type, summary: action.summary }, res);
      results.push({ ok: true, type: action.type, name: res.name, path: res.path, ledgerId: entry.id });
    } catch (err) {
      results.push({ ok: false, type: action.type, message: (err && err.message) || msg("agent.actionFailed") });
    }
  }
  return { ok: true, results };
}

function cancel(planId) {
  if (planId) pendingPlans.delete(planId);
  cancelInflight();
}

// ---- Undo / open ----
async function undo({ ledgerId, filePath } = {}) {
  // The renderer-supplied path is untrusted: prefer the ledger's recorded path
  // and refuse to trash anything outside the output sandbox.
  const entry = ledgerId ? ledger.find(ledgerId) : null;
  const target = (entry && entry.path) || filePath;
  if (!target) return { ok: false };
  const resolved = path.resolve(String(target));
  const rel = path.relative(paths.outputRoot(), resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, message: msg("agent.undoOutside") };
  }
  try {
    await shell.trashItem(resolved);
    if (ledgerId) ledger.markReverted(ledgerId);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err && err.message) || msg("agent.undoFailed") };
  }
}

function openItem(filePath) {
  if (filePath) shell.showItemInFolder(filePath);
}

module.exports = {
  listSkills,
  seedSkills,
  authorSkill,
  saveSkill,
  deleteSkill,
  runCommand,
  approve,
  cancel,
  undo,
  openItem,
};
