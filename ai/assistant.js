"use strict";

// Orchestrates the "drop the cat → understand the region → run a task" flow.
// Capture happens once per drop and is cached in memory so re-running a
// different task on the same drop doesn't re-screenshot or re-classify.

const config = require("./config");
const { msg } = require("./i18n");
const { captureRegion, captureFullScreen, captureExactRegion } = require("./capture");
const llm = require("./llm");
const { classifyError } = llm;
const { localizedTasks, resolveTask } = require("./tasks");
const {
  systemPrompt,
  classifyUserText,
  taskUserText,
  screenQuestionSystem,
  screenQuestionUser,
  regionQuestionSystem,
} = require("./prompts");

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
async function analyzeDrop(petWin, { catName, persona, memory } = {}) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled" };
  if (!config.providerReady()) return { error: "no_key", message: msg("ai.noKey") };

  let capture;
  try {
    capture = await captureRegion(petWin, {
      captureWidth: cfg.captureWidth,
      captureHeight: cfg.captureHeight,
    });
  } catch (err) {
    return { error: "capture", message: (err && err.message) || msg("capture.failed") };
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
      system: systemPrompt(cfg.responseLanguage, catName, persona, memory),
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
async function runTask({ captureId, taskId, catName, persona, memory } = {}) {
  const cfg = config.loadConfig();
  if (!config.providerReady()) return { error: "no_key", message: msg("ai.noKey") };

  const capture = pendingCaptures.get(captureId);
  if (!capture) return { error: "expired", message: msg("capture.expired") };

  const task = resolveTask(taskId, cfg.customTasks);
  if (!task) return { error: "bad_task", message: msg("task.notFound") };

  const controller = newController();
  try {
    const { text } = await llm.callVision({
      system: systemPrompt(cfg.responseLanguage, catName, persona, memory, cfg.writingStyle),
      userText: taskUserText(task, cfg.responseLanguage),
      imageBase64: capture.base64,
      mediaType: capture.mediaType,
      maxTokens: 2048,
      think: task.think,
      signal: controller.signal,
    });
    return { ok: true, text: text || msg("ai.emptyAnswer"), taskId };
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

// Pull a trailing [POINT:x,y] (normalized 0..1) out of the answer and strip it
// from the displayed text. Returns { text, point|null }.
function extractPoint(raw) {
  const text = String(raw || "");
  const m = text.match(/\[POINT:\s*([0-9]*\.?[0-9]+)\s*,\s*([0-9]*\.?[0-9]+)\s*\]/i);
  if (!m) return { text: text.trim(), point: null };
  let x = parseFloat(m[1]);
  let y = parseFloat(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { text: text.replace(m[0], "").trim(), point: null };
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  const cleaned = text.replace(m[0], "").trim();
  return { text: cleaned, point: { x, y } };
}

// Grab the whole display the cat sits on (for the "ask about my screen" flow).
// Split out so push-to-talk can capture at the moment the user starts talking
// and reuse that same frame for the vision call.
async function captureScreen(petWin) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled" };
  if (!config.providerReady()) {
    return { error: "no_key", message: msg("ai.noKey") };
  }
  try {
    return { ok: true, capture: await captureFullScreen(petWin) };
  } catch (err) {
    return { error: "capture", message: (err && err.message) || msg("capture.failed") };
  }
}

// Displayed-text form of a partial stream: drop a trailing (possibly unclosed)
// [POINT:...] so the coordinate tag never flashes in the bubble mid-stream.
function stripPointForDisplay(text) {
  return String(text || "").replace(/\[POINT:[^\]]*\]?\s*$/i, "").trimEnd();
}

// Ask the vision model about an already-captured full screen. Returns
// { ok, text, point, display }. `point` (if any) carries absolute screen coords
// for the paw overlay plus the normalized position. When `onDelta` is given, the
// answer streams: onDelta(cleanTextSoFar) fires as tokens arrive.
async function answerScreenQuestion(capture, { question, catName, persona, memory, region, appContext } = {}, onDelta) {
  const cfg = config.loadConfig();
  if (!config.providerReady()) {
    return { error: "no_key", message: msg("ai.noKey") };
  }
  if (!capture || !capture.base64) return { error: "capture", message: msg("capture.failed") };

  const controller = newController();
  const callOpts = {
    system: region
      ? regionQuestionSystem(cfg.responseLanguage, catName, persona, memory, appContext)
      : screenQuestionSystem(cfg.responseLanguage, catName, persona, capture.cat, memory, appContext),
    userText: screenQuestionUser(question, cfg.responseLanguage),
    imageBase64: capture.base64,
    mediaType: capture.mediaType,
    maxTokens: 1024,
    think: false,
    signal: controller.signal,
  };
  try {
    let text;
    if (typeof onDelta === "function") {
      let acc = "";
      const res = await llm.callVisionStream(callOpts, (piece) => {
        acc += piece;
        onDelta(stripPointForDisplay(acc));
      });
      text = res.text;
    } else {
      const res = await llm.callVision(callOpts);
      text = res.text;
    }
    const { text: answer, point } = extractPoint(text);
    let absPoint = null;
    if (point && capture.rect) {
      // Region flow: [POINT] is normalized to the selected rectangle, so map it
      // back into that rectangle's absolute screen coords.
      const r = capture.rect;
      absPoint = {
        x: Math.round(r.x + point.x * r.width),
        y: Math.round(r.y + point.y * r.height),
        norm: point,
        displayId: capture.display && capture.display.id,
      };
    } else if (point && capture.display) {
      const b = capture.display.bounds;
      absPoint = {
        x: Math.round(b.x + point.x * b.width),
        y: Math.round(b.y + point.y * b.height),
        norm: point,
        displayId: capture.display.id,
      };
    }
    return { ok: true, text: answer || msg("ai.emptyAnswer"), point: absPoint, display: capture.display };
  } catch (err) {
    const info = classifyError(err);
    return { error: info.code, message: info.message };
  } finally {
    if (activeController === controller) activeController = null;
  }
}

// Convenience: capture + answer in one call (typed question path).
async function askAboutScreen(petWin, opts = {}, onDelta) {
  const cap = await captureScreen(petWin);
  if (!cap.ok) return cap;
  return answerScreenQuestion(cap.capture, opts, onDelta);
}

// Region-select flow: capture the exact user-drawn rectangle + answer about it.
async function askAboutRegion(petWin, rect, opts = {}, onDelta) {
  const cfg = config.loadConfig();
  if (!cfg.enabled) return { error: "disabled" };
  if (!config.providerReady()) {
    return { error: "no_key", message: msg("ai.noKey") };
  }
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return { error: "empty_region" };
  let capture;
  try {
    capture = await captureExactRegion(petWin, rect);
  } catch (err) {
    return { error: "capture", message: (err && err.message) || msg("capture.regionFailed") };
  }
  return answerScreenQuestion(capture, { ...opts, region: true }, onDelta);
}

module.exports = {
  analyzeDrop,
  runTask,
  cancel,
  dropCapture,
  captureScreen,
  answerScreenQuestion,
  askAboutScreen,
  askAboutRegion,
};
