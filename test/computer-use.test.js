"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron } = require("./helpers");

fakeElectron();
const { assessRisk, looksLikeCardNumber, blockedApp } = require("../ai/computer/risk");
const { parseCombo } = require("../ai/computer/keys");
const { createGeometry, shotToScreen, screenToShot, zoomCrop, fitScale } = require("../ai/computer/scaling");
const { detectComputerIntent } = require("../ai/computer/intent");
const { performAction, summarizeAction } = require("../ai/computer/actions");
const { runComputerTask, planTask, computerModel, withCacheBreakpoint, TOOLSET, NOT_EXECUTED } = require("../ai/computer/loop");
const { createTransport, cloudTransport } = require("../ai/computer/transport");
const config = require("../ai/config");

// ───────────────────────────── risk gate ─────────────────────────────

test("assessRisk: passive actions are never risky, even in a blocked app", () => {
  for (const name of ["screenshot", "zoom", "cursor_position", "wait", "mouse_move", "scroll"]) {
    assert.equal(assessRisk({ name, input: {} }, { app: "Terminal", intent: "delete everything" }).risky, false, name);
  }
});

test("assessRisk matrix", () => {
  const cases = [
    // [action, context, risky, category]
    [{ name: "left_click", input: { coordinate: [10, 10] } }, { app: "Safari", intent: "Clicking the search field" }, false],
    [{ name: "left_click", input: { coordinate: [10, 10] } }, { app: "Mail", intent: "Clicking the Send button" }, true, "irreversible_intent"],
    [{ name: "left_click", input: {} }, { app: "Safari", intent: "Gönder düğmesine tıklıyorum" }, true, "irreversible_intent"],
    [{ name: "left_click", input: {} }, { app: "Chrome", intent: "결제 버튼을 누릅니다" }, true, "irreversible_intent"],
    [{ name: "left_click", input: {} }, { app: "Chrome", intent: "購入ボタンをクリック" }, true, "irreversible_intent"],
    [{ name: "left_click", input: {} }, { app: "Finder", intent: "Dosyayı sil" }, true, "irreversible_intent"],
    [{ name: "left_click", input: {} }, { app: "Safari", intent: "Opening the poster gallery" }, false], // "post" ≠ "poster"
    [{ name: "left_click", input: {} }, { app: "Safari", intent: "" , task: "send the email to Ali" }, false], // task alone doesn't gate clicks
    [{ name: "key", input: { text: "Return" } }, { app: "Mail", intent: "", task: "send the email to Ali" }, true, "irreversible_intent"],
    [{ name: "key", input: { text: "Return" } }, { app: "Safari", intent: "Searching for the weather" }, false],
    [{ name: "key", input: { text: "cmd+q" } }, { app: "Safari" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "Command+Q" } }, { app: "Safari" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "super+backspace" } }, { app: "Finder" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "shift+Delete" } }, { app: "Explorer" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "ctrl+alt+Delete" } }, { app: "Explorer" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "alt+F4" } }, { app: "Notepad" }, true, "dangerous_shortcut"],
    [{ name: "key", input: { text: "cmd+l" } }, { app: "Safari" }, false],
    [{ name: "key", input: { text: "ctrl+c" } }, { app: "Notepad" }, false],
    [{ name: "type", input: { text: "hunter2" } }, { app: "Safari", secureInput: true }, true, "secret_field"],
    [{ name: "type", input: { text: "hunter2" } }, { app: "Safari", intent: "Typing the password" }, true, "secret_field"],
    [{ name: "type", input: { text: "abc" } }, { app: "Safari", intent: "Şifre alanına yazıyorum" }, true, "secret_field"],
    [{ name: "type", input: { text: "4111 1111 1111 1111" } }, { app: "Safari" }, true, "secret_field"],
    [{ name: "type", input: { text: "weather tomorrow" } }, { app: "Safari", intent: "Typing the query" }, false],
    [{ name: "type", input: { text: "ls" } }, { app: "Terminal" }, true, "blocked_app"],
    [{ name: "left_click", input: {} }, { app: "iTerm2" }, true, "blocked_app"],
    [{ name: "left_click", input: {} }, { app: "Keychain Access" }, true, "blocked_app"],
    [{ name: "left_click", input: {} }, { app: "1Password 7" }, true, "blocked_app"],
    [{ name: "type", input: { text: "dir" } }, { app: "WindowsTerminal" }, true, "blocked_app"],
    [{ name: "type", input: { text: "dir" } }, { app: "powershell" }, true, "blocked_app"],
    [{ name: "left_click", input: {} }, { app: "System Settings", windowTitle: "Privacy & Security" }, true, "blocked_app"],
    [{ name: "left_click", input: {} }, { app: "System Settings", windowTitle: "Displays", intent: "Opening Displays" }, false],
    [{ name: "left_click", input: {} }, { app: "Google Chrome", windowTitle: "Garanti BBVA İnternet Şubesi" }, true, "banking"],
    [{ name: "left_click", input: {} }, { app: "Safari", task: "check my bank balance" }, true, "banking"],
  ];
  for (const [action, ctx, risky, category] of cases) {
    const r = assessRisk(action, ctx);
    const label = `${action.name} ${JSON.stringify(action.input)} @ ${JSON.stringify(ctx)}`;
    assert.equal(r.risky, risky, label);
    if (risky) {
      assert.equal(r.category, category, label);
      assert.ok(r.reason, label);
    }
  }
});

test("card numbers need a valid Luhn checksum; blocked app list is editable data", () => {
  assert.equal(looksLikeCardNumber("4111-1111-1111-1111"), true);
  assert.equal(looksLikeCardNumber("4111 1111 1111 1112"), false);
  assert.equal(looksLikeCardNumber("12345"), false);
  assert.equal(blockedApp("Bitwarden"), "password manager");
  assert.equal(blockedApp("Safari"), null);
});

test("parseCombo normalizes xdotool-style names", () => {
  assert.deepEqual(parseCombo("Return"), { mods: [], key: "return" });
  assert.deepEqual(parseCombo("ctrl+shift+T"), { mods: ["ctrl", "shift"], key: "t" });
  assert.deepEqual(parseCombo("shift+cmd+t"), { mods: ["cmd", "shift"], key: "t" });
  assert.deepEqual(parseCombo("super+space"), { mods: ["cmd"], key: "space" });
  assert.deepEqual(parseCombo("Page_Down"), { mods: [], key: "page_down" });
  assert.deepEqual(parseCombo("ctrl++"), { mods: ["ctrl"], key: "+" });
  assert.deepEqual(parseCombo("shift"), { mods: [], key: "shift" });
  assert.equal(parseCombo(""), null);
});

// ───────────────────────────── coordinates ─────────────────────────────

test("geometry: Retina display is captured at 2× and fit to the image limits", () => {
  const g = createGeometry({ id: 1, bounds: { x: 0, y: 0, width: 1512, height: 982 }, scaleFactor: 2 });
  assert.equal(g.physWidth, 3024);
  assert.equal(g.physHeight, 1964);
  assert.ok(g.shotWidth <= 1568 && g.shotWidth * g.shotHeight <= 1150000);
  assert.ok(Math.abs(g.shotWidth / g.shotHeight - 3024 / 1964) < 0.01);
  // centre and corners map back onto the logical display
  const c = shotToScreen(g, [g.shotWidth / 2, g.shotHeight / 2]);
  assert.ok(Math.abs(c.x - 756) < 0.6 && Math.abs(c.y - 491) < 0.6);
  assert.deepEqual(shotToScreen(g, [0, 0]), { x: 0, y: 0 });
  const br = shotToScreen(g, [g.shotWidth, g.shotHeight]);
  assert.ok(br.x < 1512 && br.y < 982 && br.x > 1511 && br.y > 981);
});

test("geometry: 1080p 1× display fits the pixel budget, round-trips the cursor", () => {
  const g = createGeometry({ id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 });
  assert.ok(g.shotWidth * g.shotHeight <= 1150000);
  const p = shotToScreen(g, [700, 300]);
  assert.deepEqual(screenToShot(g, p), [700, 300]);
});

test("geometry: secondary display with a negative / offset origin", () => {
  const left = createGeometry({ id: 3, bounds: { x: -2560, y: -200, width: 2560, height: 1440 }, scaleFactor: 1 });
  const k = 2560 / left.shotWidth;
  const p = shotToScreen(left, [100, 50]);
  assert.ok(Math.abs(p.x - (-2560 + 100 * k)) < 0.01);
  assert.ok(Math.abs(p.y - (-200 + 50 * (1440 / left.shotHeight))) < 0.01);
  assert.deepEqual(screenToShot(left, p), [100, 50]);
  // a Retina display to the right of the main one
  const right = createGeometry({ id: 4, bounds: { x: 1512, y: 0, width: 1728, height: 1117 }, scaleFactor: 2 });
  const q = shotToScreen(right, [0, 0]);
  assert.deepEqual(q, { x: 1512, y: 0 });
  // cursor on another display clamps to this one's edge
  assert.deepEqual(screenToShot(right, { x: 100, y: 100 })[0], 0);
});

test("geometry: out-of-screenshot and malformed coordinates are errors", () => {
  const g = createGeometry({ id: 1, bounds: { x: 0, y: 0, width: 1280, height: 800 }, scaleFactor: 1 });
  assert.throws(() => shotToScreen(g, [g.shotWidth + 5, 10]), /outside the screenshot/);
  assert.throws(() => shotToScreen(g, [-1, 10]), /outside/);
  assert.throws(() => shotToScreen(g, "10,10"), /coordinate/);
});

test("zoom crops at physical resolution", () => {
  const g = createGeometry({ id: 1, bounds: { x: 0, y: 0, width: 1512, height: 982 }, scaleFactor: 2 });
  const k = g.physWidth / g.shotWidth;
  const { crop, outWidth, outHeight } = zoomCrop(g, [100, 100, 300, 200]);
  assert.equal(crop.x, Math.floor(100 * k));
  assert.ok(Math.abs(crop.width - 200 * k) <= 2);
  assert.ok(outWidth <= 1568 && outWidth * outHeight <= 1150000);
  assert.throws(() => zoomCrop(g, [1, 2, 3]), /region/);
  assert.equal(fitScale(800, 600), 1);
});

// ───────────────────────────── routing ─────────────────────────────

test("intent: explicit computer tasks route to computer use, file asks don't", () => {
  const yes = [
    "open Safari and find tomorrow's weather",
    "/pc rename these files",
    "Safari'yi aç ve yarının havasını bul",
    "bilgisayarımda indirilenler klasörünü düzenle",
    "fill this form with my details",
    "on my computer, make a slides folder",
    "설정에서 다크 모드 클릭해줘",
  ];
  const no = [
    "make a 5-slide deck about AI",
    "yapay zeka hakkında 5 slaytlık sunum yap",
    "Türkiye'de e-ticaret pazarını araştır, PDF rapor yap",
    "summarize my notes",
    "",
  ];
  for (const t of yes) assert.equal(detectComputerIntent(t).computer, true, t);
  for (const t of no) assert.equal(detectComputerIntent(t).computer, false, t);
  assert.equal(detectComputerIntent("/pc  open Notes").text, "open Notes");
});

// ───────────────────────────── actions → driver ─────────────────────────────

function fakeDriver() {
  const calls = [];
  const rec = (name) => async (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    move: rec("move"), click: rec("click"), mouseDown: rec("mouseDown"), mouseUp: rec("mouseUp"),
    drag: rec("drag"), scroll: rec("scroll"), type: rec("type"), key: rec("key"), holdKey: rec("holdKey"),
    cursorPosition: async () => ({ x: 756, y: 491 }),
    context: async () => ({ app: "Safari", windowTitle: "", secureInput: false }),
    dispose() {},
  };
}

test("performAction maps screenshot pixels to screen points (Retina)", async () => {
  const g = createGeometry({ id: 1, bounds: { x: 0, y: 0, width: 1512, height: 982 }, scaleFactor: 2 });
  const d = fakeDriver();
  await performAction(d, g, "double_click", { coordinate: [g.shotWidth / 2, g.shotHeight / 2], text: "shift" });
  const [name, pt, opts] = d.calls[0];
  assert.equal(name, "click");
  assert.ok(Math.abs(pt.x - 756) < 0.6);
  assert.deepEqual(opts, { button: "left", count: 2, mods: ["shift"] });
  await performAction(d, g, "scroll", { scroll_direction: "down", scroll_amount: 5 });
  assert.deepEqual(d.calls[1], ["scroll", null, { direction: "down", amount: 5, mods: [] }]);
  await performAction(d, g, "key", { text: "cmd+l", repeat: 2 });
  assert.deepEqual(d.calls[2], ["key", "cmd+l", { repeat: 2 }]);
  const pos = await performAction(d, g, "cursor_position", {});
  assert.equal(pos, `X=${Math.round(g.shotWidth / 2)}, Y=${Math.round(g.shotHeight / 2)}`);
  await assert.rejects(performAction(d, g, "scroll", { scroll_direction: "sideways" }), /scroll_direction/);
  assert.match(summarizeAction("type", { text: "secret" }, { secret: true }), /••/);
});

// ───────────────────────────── agent loop ─────────────────────────────

const GEOM = createGeometry({ id: 1, bounds: { x: 0, y: 0, width: 1280, height: 800 }, scaleFactor: 1 });
const SHOT = { base64: "AAAA", mediaType: "image/jpeg" };

function scriptedTransport(replies) {
  const calls = [];
  return {
    calls,
    async createMessage(params, opts) {
      calls.push({ params: JSON.parse(JSON.stringify(params)), opts: { taskId: opts && opts.taskId } });
      const r = replies[calls.length - 1];
      if (!r) throw new Error("no more scripted replies");
      return typeof r === "function" ? r(params, opts) : r;
    },
  };
}
const tu = (id, name, input = {}) => ({ type: "tool_use", id, name, toolset_name: "computer", input });

function env(driver = fakeDriver(), extra = {}) {
  return {
    driver,
    screenshot: async () => SHOT,
    zoom: async () => SHOT,
    context: () => driver.context(),
    perform: (name, input, o) => performAction(driver, GEOM, name, input, o),
    ...extra,
  };
}

function baseOpts(transport, e, more = {}) {
  return {
    transport, model: "claude-opus-5", lang: "en", platform: "darwin", task: "find tomorrow's weather",
    plan: "1. Open Safari", geom: GEOM, firstShot: SHOT, env: e, confirm: async () => true, taskId: "cu-1", ...more,
  };
}

test("loop: screenshot → left_click → type → done, toolset_name echoed on every result", async () => {
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [{ type: "text", text: "Looking first." }, tu("a", "screenshot")] },
    { stop_reason: "tool_use", content: [{ type: "text", text: "Clicking the address bar." }, tu("b", "left_click", { coordinate: [640, 40] }), tu("c", "type", { text: "weather tomorrow\n" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "It will be sunny tomorrow." }] },
  ]);
  const e = env();
  const out = await runComputerTask(baseOpts(t, e));
  assert.equal(out.status, "done");
  assert.equal(out.text, "It will be sunny tomorrow.");
  assert.equal(out.steps, 2); // the screenshot is a look, not an action
  assert.deepEqual(out.log.map((l) => [l.name, l.ok]), [["screenshot", true], ["left_click", true], ["type", true]]);

  // request shape: toolset entry with no name / display size, plus our confirm tool
  const first = t.calls[0].params;
  assert.deepEqual(first.tools[0], TOOLSET);
  assert.equal(first.tools[0].name, undefined);
  assert.equal(first.tools[1].name, "confirm_with_user");
  assert.equal(first.messages[0].content[1].type, "image");
  // every call carries the same task id (one run = one ask on Kiiri Cloud)
  assert.deepEqual(t.calls.map((c) => c.opts.taskId), ["cu-1", "cu-1", "cu-1"]);

  // results: one per tool_use, in order, all echoing toolset_name
  const r1 = t.calls[1].params.messages.at(-1);
  assert.equal(r1.role, "user");
  assert.equal(r1.content[0].toolset_name, "computer");
  assert.equal(r1.content[0].tool_use_id, "a");
  assert.equal(r1.content[0].content[0].type, "image");
  const r2 = t.calls[2].params.messages.at(-1).content;
  assert.deepEqual(r2.map((r) => [r.tool_use_id, r.toolset_name, r.content[0].text]), [["b", "computer", "OK"], ["c", "computer", "OK"]]);
  // the click landed on the mapped screen point, then the text was typed
  assert.equal(e.driver.calls[0][0], "click");
  assert.deepEqual(e.driver.calls[1], ["type", "weather tomorrow\n"]);
  // one moving cache breakpoint on the newest block only
  assert.ok(r2.at(-1).cache_control);
  assert.equal(t.calls[2].params.messages.filter((m) => m.role === "user").flatMap((m) => m.content).filter((b) => b.cache_control).length, 1);
});

test("loop: pause_turn is resumed by re-sending the assistant turn", async () => {
  const t = scriptedTransport([
    { stop_reason: "pause_turn", content: [{ type: "text", text: "…" }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "done" }] },
  ]);
  const out = await runComputerTask(baseOpts(t, env()));
  assert.equal(out.status, "done");
  assert.deepEqual(t.calls[1].params.messages.map((m) => m.role), ["user", "assistant"]);
});

test("loop: step cap stops the run", async () => {
  const reply = { stop_reason: "tool_use", content: [tu("x", "mouse_move", { coordinate: [10, 10] }), tu("y", "mouse_move", { coordinate: [20, 20] })] };
  const t = scriptedTransport(Array(10).fill(reply));
  const out = await runComputerTask(baseOpts(t, env(), { limits: { maxSteps: 3 } }));
  assert.equal(out.status, "step_limit");
  assert.equal(out.steps, 3);
});

test("loop: screenshots and waits don't use up the action limit", async () => {
  const look = { stop_reason: "tool_use", content: [tu("s", "screenshot", {}), tu("w", "wait", { duration: 0 })] };
  const act = { stop_reason: "tool_use", content: [tu("c", "left_click", { coordinate: [10, 10] })] };
  const t = scriptedTransport([look, act, look, act, { stop_reason: "end_turn", content: [{ type: "text", text: "done" }] }]);
  const out = await runComputerTask(baseOpts(t, env(), { limits: { maxSteps: 2 } }));
  assert.equal(out.status, "done");
  assert.equal(out.steps, 2);
});

test("loop: a look-only loop still ends at the overall cap", async () => {
  const look = { stop_reason: "tool_use", content: [tu("s", "screenshot", {})] };
  const t = scriptedTransport(Array(20).fill(look));
  const out = await runComputerTask(baseOpts(t, env(), { limits: { maxSteps: 2 } }));
  assert.equal(out.status, "step_limit");
  assert.equal(out.steps, 0);
});

test("loop: 3 consecutive errors stop the run; a failed batch reports the rest as not executed", async () => {
  const bad = { stop_reason: "tool_use", content: [tu("e1", "left_click", { coordinate: [99999, 1] }), tu("e2", "type", { text: "x" })] };
  const t = scriptedTransport([bad, bad, bad, bad]);
  const out = await runComputerTask(baseOpts(t, env()));
  assert.equal(out.status, "errors");
  assert.equal(t.calls.length, 3);
  const results = t.calls[1].params.messages.at(-1).content;
  assert.equal(results[0].is_error, true);
  assert.match(results[0].content, /outside the screenshot/);
  assert.equal(results[0].toolset_name, "computer");
  assert.equal(results[1].content, NOT_EXECUTED);
  assert.equal(results[1].toolset_name, "computer");
});

test("loop: abort signal stops mid-run", async () => {
  const ctl = new AbortController();
  const driver = fakeDriver();
  driver.type = async () => { ctl.abort(); };
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [tu("a", "type", { text: "hi" }), tu("b", "key", { text: "Return" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "never" }] },
  ]);
  const out = await runComputerTask(baseOpts(t, env(driver), { signal: ctl.signal }));
  assert.equal(out.status, "stopped");
  assert.equal(t.calls.length, 1);
  assert.equal(driver.calls.find((c) => c[0] === "key"), undefined);
});

test("loop: time limit stops a hanging request", async () => {
  const t = { createMessage: (_p, { signal }) => new Promise((_r, rej) => signal.addEventListener("abort", () => rej(new Error("aborted")))) };
  const out = await runComputerTask(baseOpts(t, env(), { limits: { maxMs: 30 } }));
  assert.equal(out.status, "time_limit");
});

test("loop: time spent paused or waiting on a confirmation doesn't count toward the limit", async () => {
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [{ type: "text", text: "Clicking Send." }, tu("s", "left_click", { coordinate: [10, 10] })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "sent" }] },
  ]);
  const slow = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
  const out = await runComputerTask(baseOpts(t, env(), {
    limits: { maxMs: 40 },
    waitIfPaused: () => slow(60),
    confirm: () => slow(60, true),
  }));
  assert.equal(out.status, "done");
});

test("loop: a risky action pauses for confirmation and a deny ends the run", async () => {
  const asked = [];
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [{ type: "text", text: "Clicking the Send button." }, tu("s", "left_click", { coordinate: [100, 100] })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "never" }] },
  ]);
  const e = env();
  const out = await runComputerTask(baseOpts(t, e, { confirm: async (info) => { asked.push(info); return false; } }));
  assert.equal(out.status, "denied");
  assert.equal(asked.length, 1);
  assert.equal(asked[0].category, "irreversible_intent");
  assert.equal(e.driver.calls.length, 0, "the click never happened");
  assert.equal(t.calls.length, 1);
  assert.equal(out.log[0].confirmed, false);
});

test("loop: allowed risky action runs; model's confirm_with_user covers the next send click", async () => {
  const asked = [];
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "q", name: "confirm_with_user", input: { question: "Send the email to Ali?" } }] },
    { stop_reason: "tool_use", content: [{ type: "text", text: "Clicking Send." }, tu("s", "left_click", { coordinate: [100, 100] })] },
    { stop_reason: "tool_use", content: [{ type: "text", text: "Pressing cmd+q to quit." }, tu("k", "key", { text: "cmd+q" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Sent." }] },
  ]);
  const e = env();
  const out = await runComputerTask(baseOpts(t, e, { confirm: async (info) => { asked.push(info.kind + ":" + (info.category || "")); return true; } }));
  assert.equal(out.status, "done");
  // asked once for the model's question, NOT again for the send click, but again for cmd+q
  assert.deepEqual(asked, ["model:", "risk:dangerous_shortcut"]);
  const confirmResult = t.calls[1].params.messages.at(-1).content[0];
  assert.equal(confirmResult.content, "approved");
  assert.equal(confirmResult.toolset_name, undefined, "custom tool results don't carry toolset_name");
  assert.equal(e.driver.calls.filter((c) => c[0] === "click").length, 1);
});

test("loop: a tool_use without toolset_name is not run as a computer action", async () => {
  const t = scriptedTransport([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "z", name: "left_click", input: { coordinate: [1, 1] } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] },
  ]);
  const e = env();
  await runComputerTask(baseOpts(t, e));
  assert.equal(e.driver.calls.length, 0);
  assert.equal(t.calls[1].params.messages.at(-1).content[0].is_error, true);
});

test("plan: text plan or NO: refusal, no tools sent", async () => {
  const t = scriptedTransport([
    { stop_reason: "end_turn", content: [{ type: "text", text: "1. Open Safari\n2. Search the weather" }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "NO: needs your bank password" }] },
  ]);
  const ok = await planTask({ transport: t, model: "claude-opus-5", lang: "en", platform: "darwin", task: "weather", shot: SHOT, taskId: "cu-9" });
  assert.equal(ok.ok, true);
  assert.equal(t.calls[0].params.tools, undefined);
  assert.equal(t.calls[0].opts.taskId, "cu-9");
  const no = await planTask({ transport: t, model: "claude-opus-5", lang: "en", platform: "darwin", task: "pay rent", shot: SHOT });
  assert.deepEqual(no, { ok: false, refused: true, text: "needs your bank password" });
});

test("computerModel keeps toolset-capable models and falls back otherwise", () => {
  assert.equal(computerModel("claude-opus-5"), "claude-opus-5");
  assert.equal(computerModel("claude-opus-4-8"), "claude-opus-4-8");
  assert.equal(computerModel("claude-sonnet-4-6", "claude-opus-4-8"), "claude-opus-4-8");
  assert.equal(computerModel("claude-haiku-4-5", "nope"), "claude-opus-4-8");
  assert.equal(withCacheBreakpoint([]).length, 0);
});

// ───────────────────────────── transport ─────────────────────────────

test("cloud transport: Anthropic-native body, bearer token, X-Kiiri-Task", async () => {
  let seen;
  const fetchFn = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "hi" }], stop_reason: "end_turn" }) };
  };
  const tr = createTransport({ id: "cloud", baseUrl: "https://cloud.kiiri.app/", token: "dev-tok" }, { fetchFn });
  const body = { model: "kiiri-smart", max_tokens: 10, tools: [TOOLSET], messages: [{ role: "user", content: "x" }] };
  const msg = await tr.createMessage(body, { taskId: "cu-abc" });
  assert.equal(msg.content[0].text, "hi");
  assert.equal(seen.url, "https://cloud.kiiri.app/v1/messages");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, "Bearer dev-tok");
  assert.equal(seen.init.headers["X-Kiiri-Task"], "cu-abc");
  assert.deepEqual(JSON.parse(seen.init.body), body);
});

test("cloud transport: 403 plan_required maps to code plan_required", async () => {
  const fetchFn = async () => ({ ok: false, status: 403, json: async () => ({ error: { type: "plan_required", message: "Upgrade" } }) });
  const tr = cloudTransport({ baseUrl: "https://cloud.kiiri.app", token: "t", fetchFn });
  await assert.rejects(tr.createMessage({}, { taskId: "cu-1" }), (err) => err.code === "plan_required" && err.status === 403);
  const other = cloudTransport({ baseUrl: "https://cloud.kiiri.app", token: "t", fetchFn: async () => ({ ok: false, status: 403, json: async () => ({ error: { type: "forbidden" } }) }) });
  await assert.rejects(other.createMessage({}, {}), (err) => err.code !== "plan_required" && err.status === 403);
});

test("anthropic transport uses the SDK; other providers are unavailable", async () => {
  let created;
  class FakeSDK { constructor(o) { this.o = o; this.messages = { create: async (p, opts) => { created = { p, opts, key: o.apiKey }; return { content: [] }; } }; } }
  const tr = createTransport({ id: "anthropic", apiKey: "sk-test" }, { SDK: FakeSDK });
  const ctl = new AbortController();
  await tr.createMessage({ model: "m" }, { signal: ctl.signal, taskId: "ignored" });
  assert.equal(created.key, "sk-test");
  assert.equal(created.opts.signal, ctl.signal);
  for (const id of ["openai", "gemini", "ollama", "proxy"]) {
    assert.throws(() => createTransport({ id }), (err) => err.code === "unsupported_provider", id);
  }
});

test("config: computer-use defaults and step clamp", () => {
  const c = config.sanitizeConfig({});
  assert.equal(c.computerUseEnabled, true);
  assert.equal(c.computerUseMaxSteps, 30);
  assert.equal(config.sanitizeConfig({ computerUseMaxSteps: 500 }).computerUseMaxSteps, 60);
  assert.equal(config.sanitizeConfig({ computerUseMaxSteps: 2 }).computerUseMaxSteps, 10);
  assert.equal(config.sanitizeConfig({ computerUseEnabled: false }).computerUseEnabled, false);
});
