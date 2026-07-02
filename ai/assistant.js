"use strict";

// Orchestrates the "drop the cat → understand the region → run a task" flow.
// Capture happens once per drop and is cached in memory so re-running a
// different task on the same drop doesn't re-screenshot or re-classify.

const config = require("./config");
const { captureRegion } = require("./capture");
const llm = require("./llm");
const { classifyError } = llm;
const { localizedTasks, resolveTask } = require("./tasks");
const { systemPrompt, classifyUserText, taskUserText } = require("./prompts");

const CAPTURE_TTL_MS = 5 * 60 * 1000;
const pendingCaptures = new Map(); // id -> { base64, mediaType, rect, ts }
let captureSeq = 0;
let activeController = null;

function prune() {
  const now = Date.now();
  for (const [id, cap] of pendingCaptures) {
    if (now - cap.ts > CAPTURE_TTL_MS) pendingCaptures.delete(id);
  }
}

function newController() {
  if (activeController) {
    try { activeController.abort(); } catch {}
  }
  activeController = new AbortController();
  return activeController;
}

function cancel() {
  if (activeController) {
    try { activeController.abort(); } catch {}
    activeController = null;
  }
}

function parseClassify(text) {
  if (!text) return null;
  // Tolerate code fences / stray prose around the JSON.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Step 1: capture under the cat + (optionally) classify to recommend a task.
async function analyzeDrop(petWin, { catName, persona } = {}) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled" };
  if (!config.providerReady()) return { error: "no_key", message: "Önce ayarlardan sağlayıcı anahtarını gir (Ollama için gerekmez)." };

  let capture;
  try {
    capture = await captureRegion(petWin, {
      captureWidth: cfg.captureWidth,
      captureHeight: cfg.captureHeight,
    });
  } catch (err) {
    return { error: "capture", message: (err && err.message) || "Ekran yakalanamadı." };
  }

  prune();
  const captureId = `cap-${Date.now()}-${captureSeq++}`;
  pendingCaptures.set(captureId, { ...capture, ts: Date.now() });

  const tasks = localizedTasks(cfg.responseLanguage, cfg.customTasks);
  const base = {
    ok: true,
    captureId,
    rect: capture.rect,
    tasks,
    catName: catName || "Kiri",
    contentType: "unknown",
    brief: "",
    recommendedTaskId: "summarize",
  };

  if (!cfg.autoDetect) return base;

  const controller = newController();
  try {
    const { text } = await llm.callVision({
      system: systemPrompt(cfg.responseLanguage, catName, persona),
      userText: classifyUserText(cfg.responseLanguage),
      imageBase64: capture.base64,
      mediaType: capture.mediaType,
      maxTokens: 300,
      think: false,
      signal: controller.signal,
    });
    const parsed = parseClassify(text);
    if (parsed) {
      base.contentType = String(parsed.contentType || "unknown");
      base.brief = String(parsed.brief || "").slice(0, 160);
      const rec = String(parsed.recommendedTask || "");
      if (tasks.some((t) => t.id === rec)) base.recommendedTaskId = rec;
    }
  } catch (err) {
    const info = classifyError(err);
    if (info.code === "aborted") return { error: "aborted" };
    // Classification is best-effort — still show the menu without a hint, but
    // surface auth/SDK errors so the user can fix them.
    if (info.code === "auth" || info.code === "missing_sdk" || info.code === "permission") {
      pendingCaptures.delete(captureId);
      return { error: info.code, message: info.message };
    }
  } finally {
    if (activeController === controller) activeController = null;
  }
  return base;
}

// Step 2: run a chosen task against the cached capture.
async function runTask({ captureId, taskId, catName, persona } = {}) {
  const cfg = config.loadConfig();
  if (!config.providerReady()) return { error: "no_key", message: "Önce ayarlardan sağlayıcı anahtarını gir (Ollama için gerekmez)." };

  const capture = pendingCaptures.get(captureId);
  if (!capture) return { error: "expired", message: "Görüntü süresi doldu, kediyi tekrar bırak." };

  const task = resolveTask(taskId, cfg.customTasks);
  if (!task) return { error: "bad_task", message: "Görev bulunamadı." };

  const controller = newController();
  try {
    const { text } = await llm.callVision({
      system: systemPrompt(cfg.responseLanguage, catName, persona),
      userText: taskUserText(task, cfg.responseLanguage),
      imageBase64: capture.base64,
      mediaType: capture.mediaType,
      maxTokens: 2048,
      think: task.think,
      signal: controller.signal,
    });
    return { ok: true, text: text || "(boş yanıt)", taskId };
  } catch (err) {
    const info = classifyError(err);
    return { error: info.code, message: info.message };
  } finally {
    if (activeController === controller) activeController = null;
  }
}

function dropCapture(captureId) {
  pendingCaptures.delete(captureId);
}

module.exports = { analyzeDrop, runTask, cancel, dropCapture };
