"use strict";
// Live end-to-end check of computer use with the user's own provider settings.
// Dev-only: `node_modules/.bin/electron scripts/computer-live-test.js "<task>"`.
// Uses the same session, control strip and IPC as main.js. The plan is
// auto-approved (that's the point of the test); risky-step confirmations still
// go to the strip and wait for a human. Nothing is written to settings.
const { app, ipcMain } = require("electron");
const path = require("path");
require("../userdata-path").applyUserDataPath(app);

const task = process.argv.slice(2).filter((a) => !a.startsWith("-")).pop() || "Open TextEdit, create a new document and type: merhaba";
const maxSteps = Number((process.argv.find((a) => a.startsWith("--steps=")) || "--steps=15").split("=")[1]);

app.whenReady().then(async () => {
  const config = require("../ai/config");
  const c = config.loadConfig();
  // In-memory only (the cached object), so the user's ai-config.json is untouched.
  Object.assign(c, { enabled: true, computerUseEnabled: true, computerUseMaxSteps: maxSteps });
  console.log(`[live] provider=${config.resolveProvider().id} model=${config.resolveProvider().model} ready=${config.providerReady()} steps=${maxSteps}`);
  if (!config.providerReady()) { console.log("[live] no provider key/token — enter it in Kiiri settings first"); app.quit(); return; }

  const { createComputerSession } = require("../ai/computer/session");
  const session = createComputerSession({
    catName: () => "Kiri",
    keepOnTop: (win) => { try { win.setAlwaysOnTop(true, "screen-saver"); } catch {} },
    petWindows: () => [],
    setWorking: (on, ok) => console.log(`[live] working=${on}${on ? "" : ` success=${!!ok}`}`),
    onConfirmShown: () => console.log("[live] ⚠ risky step — waiting for your answer on the strip"),
    hideCommand: () => {},
    showCommand: () => {},
    remember: () => {},
  });
  ipcMain.handle("language-get", () => "tr");
  ipcMain.on("cu-pause", (evt, on) => { if (session.isStripSender(evt.sender)) session.setPaused(!!on); });
  ipcMain.on("cu-stop", () => session.stop());
  ipcMain.on("cu-confirm-answer", (evt, p) => { if (session.isStripSender(evt.sender) && p) session.answerConfirm(p.id, !!p.allowed); });
  ipcMain.on("cu-strip-hover", (evt, over) => { if (session.isStripSender(evt.sender)) session.stripHover(!!over); });

  console.log(`[live] task: ${task}`);
  const t0 = Date.now();
  const plan = await session.prepare(task);
  console.log(`[live] plan (${((Date.now() - t0) / 1000).toFixed(1)}s):`, JSON.stringify(plan).slice(0, 1200));
  if (!plan || plan.type !== "computer-plan") { app.quit(); return; }
  const out = await session.start(plan.runId);
  console.log(`[live] result (${((Date.now() - t0) / 1000).toFixed(1)}s): status=${out.status} steps=${out.steps} ok=${out.ok}`);
  if (out.text) console.log(`[live] text: ${out.text}`);
  if (out.message) console.log(`[live] error: ${out.error} ${out.message}`);
  for (const l of out.log || []) console.log("  ·", JSON.stringify(l).slice(0, 220));
  app.quit();
});
