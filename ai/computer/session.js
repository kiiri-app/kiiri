"use strict";

// Computer-use session: the Electron side of a run. Owns the control strip
// window, the global Esc stop shortcut, pause/stop/confirm state, screen
// capture (with Kiiri's own windows hidden) and the wiring of the pure agent
// loop (loop.js) to the real input driver, transport and risk gate.
//
// Only the command window (typed or voice commands) can start a run; nothing
// here is reachable from the local bridge / MCP server.

const path = require("path");
const crypto = require("crypto");
const { BrowserWindow, screen, desktopCapturer, globalShortcut, systemPreferences, shell } = require("electron");
const config = require("../config");
const { classifyError } = require("../claude");
const { createInput } = require("./input");
const { createTransport } = require("./transport");
const { createGeometry, zoomCrop } = require("./scaling");
const { performAction, POINTER_ACTIONS } = require("./actions");
const { planTask, runComputerTask, computerModel } = require("./loop");
const { assessRisk } = require("./risk");
const { parseCombo } = require("./keys");

const JPEG_QUALITY = 80;
const CONFIRM_TIMEOUT_MS = 3 * 60 * 1000;
const STRIP_W = 480;
const STRIP_H = 46;
const STRIP_H_CONFIRM = 150;
const SETTLE_MS = 180; // let the UI react before the next action / screenshot

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── provider ──
// Computer use speaks the Anthropic-native API: the user's own Anthropic key,
// or Kiiri Cloud (same body, proxied). Everything else can't run it.
function resolveComputerProvider() {
  const c = config.loadConfig();
  if (c.provider === "anthropic") {
    const apiKey = config.getApiKey();
    if (!apiKey) return { error: "no_key" };
    return { id: "anthropic", apiKey, model: computerModel(c.model, config.DEFAULT_MODEL) };
  }
  if (c.provider === "cloud") {
    const token = typeof config.getCloudToken === "function" ? config.getCloudToken() : null;
    const baseUrl = c.cloudBaseUrl || "";
    if (!token || !baseUrl) return { error: "no_key" };
    const p = config.resolveProvider();
    return { id: "cloud", token, baseUrl, model: (p && p.model) || computerModel(c.model, config.DEFAULT_MODEL) };
  }
  return { error: "unsupported_provider", provider: c.provider };
}

function createComputerSession(deps) {
  // deps: { lang(), uiLang(), catName(), keepOnTop(win), petWindows(), setWorking(on), notice(msg),
  //         hideCommand(), showCommand(), remember(task, result), onConfirmShown() }
  let pending = null;   // { runId, taskId, task, plan, provider }
  let run = null;       // active run state
  let strip = null;
  let stripReady = false;
  let stripQueue = [];

  // ── checks before spending a request ──
  function preflight() {
    const c = config.loadConfig();
    if (!c.enabled) return { error: "disabled" };
    if (!c.computerUseEnabled) return { error: "cu_disabled" };
    if (!["darwin", "win32", "linux"].includes(process.platform)) return { error: "platform" };
    const provider = resolveComputerProvider();
    if (provider.error) return provider;
    if (process.platform === "darwin") {
      let trusted = false;
      try { trusted = systemPreferences.isTrustedAccessibilityClient(false); } catch {}
      if (!trusted) return { error: "accessibility" };
      try { if (systemPreferences.getMediaAccessStatus("screen") === "denied") return { error: "screen_permission" }; } catch {}
    }
    return { ok: true, provider };
  }

  function openAccessibilitySettings() {
    if (process.platform !== "darwin") return;
    try { systemPreferences.isTrustedAccessibilityClient(true); } catch {}
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility").catch(() => {});
  }

  function activeDisplay() {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  }

  // ── capture (Kiiri's own windows hidden) ──
  async function withOwnWindowsHidden(fn) {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.isVisible());
    const prev = wins.map((w) => w.getOpacity());
    wins.forEach((w) => { try { w.setOpacity(0); } catch {} });
    try {
      await delay(150);
      return await fn();
    } finally {
      wins.forEach((w, i) => { try { if (!w.isDestroyed()) w.setOpacity(prev[i] || 1); } catch {} });
    }
  }

  // The first capture right after launch can come back empty on macOS while the
  // capture service warms up (seen in the live test), so retry briefly before
  // blaming the Screen Recording permission.
  async function grabDisplay(geom) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await delay(300 * attempt);
      const sources = await withOwnWindowsHidden(() =>
        desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: geom.physWidth, height: geom.physHeight } })
      );
      const src = sources.find((s) => String(s.display_id) === String(geom.displayId)) || sources[0];
      if (src && src.thumbnail && !src.thumbnail.isEmpty()) return src.thumbnail;
    }
    throw new Error("screen capture returned no image (check the Screen Recording permission)");
  }

  async function screenshot(geom) {
    const img = await grabDisplay(geom);
    const out = img.resize({ width: geom.shotWidth, height: geom.shotHeight, quality: "good" });
    return { base64: out.toJPEG(JPEG_QUALITY).toString("base64"), mediaType: "image/jpeg" };
  }

  async function zoom(geom, region) {
    const { crop, outWidth, outHeight } = zoomCrop(geom, region);
    const img = await grabDisplay(geom);
    // The capture should be exactly physWidth × physHeight; rescale the crop if not.
    const size = img.getSize();
    const kx = size.width / geom.physWidth, ky = size.height / geom.physHeight;
    const rect = {
      x: Math.round(crop.x * kx), y: Math.round(crop.y * ky),
      width: Math.max(2, Math.min(size.width - Math.round(crop.x * kx), Math.round(crop.width * kx))),
      height: Math.max(2, Math.min(size.height - Math.round(crop.y * ky), Math.round(crop.height * ky))),
    };
    const out = img.crop(rect).resize({ width: outWidth, height: outHeight, quality: "best" });
    return { base64: out.toJPEG(JPEG_QUALITY).toString("base64"), mediaType: "image/jpeg" };
  }

  // ── control strip ──
  function stripSend(channel, payload) {
    if (!strip || strip.isDestroyed()) return;
    if (!stripReady) { stripQueue.push([channel, payload]); return; }
    strip.webContents.send(channel, payload);
  }

  function placeStrip(height) {
    if (!strip || strip.isDestroyed() || !run) return;
    const wa = run.display.workArea;
    strip.setBounds({ x: Math.round(wa.x + (wa.width - STRIP_W) / 2), y: Math.round(wa.y + 6), width: STRIP_W, height });
  }

  function openStrip() {
    stripReady = false;
    stripQueue = [];
    strip = new BrowserWindow({
      width: STRIP_W, height: STRIP_H, show: false, frame: false, transparent: true, resizable: false,
      movable: false, focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
      fullscreenable: false, minimizable: false, maximizable: false,
      webPreferences: { preload: path.join(__dirname, "..", "..", "renderer", "computer-strip-preload.js"), contextIsolation: true, nodeIntegration: false },
    });
    try { strip.setContentProtection(true); } catch {}
    deps.keepOnTop(strip);
    strip.setIgnoreMouseEvents(true, { forward: true });
    placeStrip(STRIP_H);
    strip.loadFile(path.join(__dirname, "..", "..", "renderer", "computer-strip.html"));
    strip.webContents.once("did-finish-load", () => {
      stripReady = true;
      for (const [c, p] of stripQueue) strip.webContents.send(c, p);
      stripQueue = [];
    });
    strip.on("closed", () => { strip = null; stripReady = false; });
    strip.showInactive();
  }

  function closeStrip() {
    if (strip && !strip.isDestroyed()) strip.close();
    strip = null;
  }

  function pushState(extra = {}) {
    if (!run) return;
    run.view = { ...run.view, ...extra, paused: run.paused, maxSteps: run.maxSteps };
    stripSend("cu-state", run.view);
  }

  function stripHover(over) {
    if (!strip || strip.isDestroyed() || !run || run.confirming || run.acting) return;
    if (over) strip.setIgnoreMouseEvents(false);
    else strip.setIgnoreMouseEvents(true, { forward: true });
  }

  // ── pause / stop / confirm ──
  function waitIfPaused() {
    if (!run || !run.paused) return Promise.resolve();
    return new Promise((resolve) => run.resumeWaiters.push(resolve));
  }
  function setPaused(on) {
    if (!run) return;
    run.paused = !!on;
    if (!run.paused) { const w = run.resumeWaiters; run.resumeWaiters = []; w.forEach((r) => r()); }
    pushState();
  }
  function stop() {
    if (!run) return;
    run.controller.abort();
    setPaused(false);
    if (run.confirmResolve) run.confirmResolve(false);
  }

  function confirm(info) {
    if (!run) return Promise.resolve(false);
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      let done = false;
      const finish = (allowed) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (run) { run.confirming = false; run.confirmResolve = null; }
        if (strip && !strip.isDestroyed()) { strip.setIgnoreMouseEvents(true, { forward: true }); placeStrip(STRIP_H); }
        stripSend("cu-confirm-clear", { id });
        resolve(!!allowed);
      };
      const timer = setTimeout(() => finish(false), CONFIRM_TIMEOUT_MS);
      run.confirming = true;
      run.confirmResolve = finish;
      run.confirmId = id;
      if (strip && !strip.isDestroyed()) { placeStrip(STRIP_H_CONFIRM); strip.setIgnoreMouseEvents(false); }
      stripSend("cu-confirm", { id, kind: info.kind, category: info.category || "", reason: info.reason || "", summary: info.summary || "", question: info.question || "", app: info.app || "" });
      if (deps.onConfirmShown) deps.onConfirmShown();
    });
  }
  function answerConfirm(id, allowed) {
    if (run && run.confirmResolve && run.confirmId === id) run.confirmResolve(!!allowed);
  }

  // ── Esc = stop (only while a run is active) ──
  function registerEsc() {
    try { run.escRegistered = globalShortcut.register("Escape", () => stop()); } catch { run.escRegistered = false; }
  }
  function unregisterEsc() {
    try { if (globalShortcut.isRegistered("Escape")) globalShortcut.unregister("Escape"); } catch {}
    if (run) run.escRegistered = false;
  }

  // ── the input driver, wrapped with run hygiene ──
  function makeEnv(geom, driver) {
    return {
      screenshot: () => screenshot(geom),
      zoom: (region) => zoom(geom, region),
      context: () => driver.context(),
      perform: async (name, input, { signal } = {}) => {
        const pointer = POINTER_ACTIONS.has(name);
        // Our own Esc stop shortcut would swallow a synthetic Escape.
        const combo = (name === "key" || name === "hold_key") ? parseCombo(input.text) : null;
        const escKey = combo && combo.key === "escape";
        run.acting = true;
        if (pointer && strip && !strip.isDestroyed()) strip.setIgnoreMouseEvents(true);
        if (escKey) unregisterEsc();
        try {
          const out = await performAction(driver, geom, name, input, { signal });
          if (name !== "wait" && name !== "cursor_position") await delay(SETTLE_MS);
          return out;
        } finally {
          run.acting = false;
          if (escKey && run && !run.controller.signal.aborted) registerEsc();
          if (pointer && strip && !strip.isDestroyed() && !run.confirming) strip.setIgnoreMouseEvents(true, { forward: true });
        }
      },
    };
  }

  function lockPets(on) {
    for (const w of deps.petWindows()) {
      if (!w || w.isDestroyed()) continue;
      try {
        if (on) w.setIgnoreMouseEvents(true);
        else w.setIgnoreMouseEvents(true, { forward: true });
      } catch {}
    }
  }

  function mapError(err) {
    if (err && err.code === "plan_required") return { error: "plan_required" };
    if (err && err.code === "unsupported_provider") return { error: "unsupported_provider" };
    const info = classifyError(err);
    return { error: info.code, message: info.message };
  }

  // ── public: plan → approve → run ──
  async function prepare(taskText) {
    if (run) return { error: "busy" };
    const task = String(taskText || "").trim().slice(0, 2000);
    if (!task) return { error: "empty" };
    const pre = preflight();
    if (pre.error) return pre;
    const provider = pre.provider;
    const taskId = `cu-${crypto.randomUUID()}`;
    let transport;
    try { transport = createTransport(provider); } catch (err) { return mapError(err); }
    const controller = new AbortController();
    pending = { runId: null, taskId, task, provider, controller };
    try {
      const geom = createGeometry(activeDisplay());
      const shot = await screenshot(geom);
      const res = await planTask({
        transport, model: provider.model, lang: config.loadConfig().responseLanguage, platform: process.platform,
        catName: deps.catName(), task, shot, signal: controller.signal, taskId,
      });
      if (!res.ok) { pending = null; return { type: "refused", text: res.text }; }
      const runId = `run-${Date.now()}`;
      pending = { ...pending, runId, plan: res.text };
      return { type: "computer-plan", runId, task, plan: res.text, maxSteps: config.loadConfig().computerUseMaxSteps };
    } catch (err) {
      pending = null;
      return mapError(err);
    }
  }

  function cancelPending() {
    if (pending && pending.controller) { try { pending.controller.abort(); } catch {} }
    pending = null;
  }

  async function start(runId) {
    if (run) return { error: "busy" };
    if (!pending || pending.runId !== runId) return { error: "expired" };
    const { task, plan, provider, taskId } = pending;
    pending = null;
    const pre = preflight();
    if (pre.error) return pre;
    const cfg = config.loadConfig();
    const display = activeDisplay();
    const geom = createGeometry(display);
    let driver;
    try {
      driver = createInput({
        platform: process.platform,
        getCursor: () => screen.getCursorScreenPoint(),
        toNative: (p) => (typeof screen.dipToScreenPoint === "function" && process.platform !== "darwin" ? screen.dipToScreenPoint(p) : p),
      });
    } catch (err) {
      return { error: "platform", message: err && err.message };
    }
    run = {
      display, geom, paused: false, resumeWaiters: [], controller: new AbortController(),
      confirming: false, confirmResolve: null, acting: false, maxSteps: cfg.computerUseMaxSteps, view: { step: 0, phase: "thinking", summary: "" },
    };
    deps.hideCommand();
    openStrip();
    pushState();
    registerEsc();
    lockPets(true);
    deps.setWorking(true);

    let result;
    try {
      const transport = createTransport(provider);
      const firstShot = await screenshot(geom);
      result = await runComputerTask({
        transport, model: provider.model, lang: cfg.responseLanguage, platform: process.platform, catName: deps.catName(),
        task, plan, geom, firstShot, taskId,
        env: makeEnv(geom, driver),
        assess: assessRisk,
        confirm,
        waitIfPaused,
        signal: run.controller.signal,
        limits: { maxSteps: cfg.computerUseMaxSteps, maxMs: 8 * 60 * 1000, maxErrors: 3 },
        onEvent: (evt) => {
          if (evt.type === "thinking") pushState({ phase: "thinking" });
          else if (evt.type === "step") pushState({ phase: "acting", step: evt.step, summary: evt.summary });
        },
      });
    } catch (err) {
      result = { status: "error", text: "", steps: 0, log: [], error: err };
    } finally {
      unregisterEsc();
      lockPets(false);
      try { driver.dispose(); } catch {}
      closeStrip();
      deps.setWorking(false, result && result.status === "done");
      run = null;
    }

    const out = { ok: result.status === "done", status: result.status, text: result.text || "", steps: result.steps, log: result.log, task };
    if (result.error) Object.assign(out, mapError(result.error));
    try { deps.remember(task, out); } catch {}
    deps.showCommand();
    return out;
  }

  return {
    prepare,
    start,
    cancelPending,
    stop,
    setPaused,
    answerConfirm,
    stripHover,
    openAccessibilitySettings,
    isRunning: () => !!run,
    isStripSender: (sender) => !!(sender && strip && !strip.isDestroyed() && strip.webContents.id === sender.id),
  };
}

module.exports = { createComputerSession, resolveComputerProvider };
