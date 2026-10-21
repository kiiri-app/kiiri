"use strict";

// Executes one computer-toolset member call (other than screenshot / zoom,
// which the capture side handles) on an input driver, translating screenshot
// coordinates to real screen points through the run's geometry.

const { shotToScreen, screenToShot } = require("./scaling");
const { modsFrom } = require("./input");

const MAX_WAIT_S = 30;
const POINTER_ACTIONS = new Set([
  "left_click", "right_click", "middle_click", "double_click", "triple_click",
  "left_click_drag", "mouse_move", "left_mouse_down", "left_mouse_up", "scroll",
]);

const CLICKS = {
  left_click: { button: "left", count: 1 },
  right_click: { button: "right", count: 1 },
  middle_click: { button: "middle", count: 1 },
  double_click: { button: "left", count: 2 },
  triple_click: { button: "left", count: 3 },
};

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(done, ms);
    function done() { if (signal) signal.removeEventListener("abort", onAbort); resolve(); }
    function onAbort() { clearTimeout(t); reject(new Error("aborted")); }
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Returns the text for the tool_result ("OK", or the cursor position).
async function performAction(driver, geom, name, input = {}, { signal } = {}) {
  const pt = (c) => (c === undefined || c === null ? null : shotToScreen(geom, c));
  if (CLICKS[name]) {
    const { button, count } = CLICKS[name];
    await driver.click(pt(input.coordinate), { button, count, mods: modsFrom(input.text) });
    return "OK";
  }
  switch (name) {
    case "left_click_drag": {
      if (!input.start_coordinate || !input.coordinate) throw new Error("left_click_drag needs start_coordinate and coordinate");
      await driver.drag(pt(input.start_coordinate), pt(input.coordinate), { mods: modsFrom(input.text) });
      return "OK";
    }
    case "mouse_move":
      if (!input.coordinate) throw new Error("mouse_move needs coordinate");
      await driver.move(pt(input.coordinate));
      return "OK";
    case "left_mouse_down":
      await driver.mouseDown(pt(input.coordinate), "left");
      return "OK";
    case "left_mouse_up":
      await driver.mouseUp(pt(input.coordinate), "left");
      return "OK";
    case "scroll": {
      const direction = ["up", "down", "left", "right"].includes(input.scroll_direction) ? input.scroll_direction : null;
      if (!direction) throw new Error("scroll_direction must be up, down, left or right");
      await driver.scroll(pt(input.coordinate), { direction, amount: Number(input.scroll_amount) || 3, mods: modsFrom(input.text) });
      return "OK";
    }
    case "type":
      if (typeof input.text !== "string" || !input.text) throw new Error("type needs text");
      await driver.type(input.text);
      return "OK";
    case "key":
      if (!input.text) throw new Error("key needs text");
      await driver.key(String(input.text), { repeat: Number(input.repeat) || 1 });
      return "OK";
    case "hold_key":
      if (!input.text) throw new Error("hold_key needs text");
      await driver.holdKey(String(input.text), Number(input.duration) || 1);
      return "OK";
    case "wait":
      await abortableSleep(Math.max(0, Math.min(MAX_WAIT_S, Number(input.duration) || 1)) * 1000, signal);
      return "OK";
    case "cursor_position": {
      const p = await driver.cursorPosition();
      const [x, y] = screenToShot(geom, p);
      return `X=${x}, Y=${y}`;
    }
    default:
      throw new Error(`unsupported action: ${name}`);
  }
}

function fmtPoint(c) {
  return Array.isArray(c) && c.length === 2 ? `(${Math.round(c[0])}, ${Math.round(c[1])})` : "";
}

function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// Short, human-readable line for the per-action log. `secret` masks typed text.
function summarizeAction(name, input = {}, { secret = false } = {}) {
  const mods = input.text && name !== "type" && name !== "key" && name !== "hold_key" ? ` +${input.text}` : "";
  switch (name) {
    case "screenshot": return "📸 screenshot";
    case "zoom": return `🔎 zoom ${Array.isArray(input.region) ? `[${input.region.map((v) => Math.round(v)).join(", ")}]` : ""}`;
    case "left_click": return `🖱 click ${fmtPoint(input.coordinate)}${mods}`.trim();
    case "right_click": return `🖱 right-click ${fmtPoint(input.coordinate)}${mods}`.trim();
    case "middle_click": return `🖱 middle-click ${fmtPoint(input.coordinate)}${mods}`.trim();
    case "double_click": return `🖱 double-click ${fmtPoint(input.coordinate)}${mods}`.trim();
    case "triple_click": return `🖱 triple-click ${fmtPoint(input.coordinate)}${mods}`.trim();
    case "left_click_drag": return `🖱 drag ${fmtPoint(input.start_coordinate)} → ${fmtPoint(input.coordinate)}`;
    case "mouse_move": return `🖱 move ${fmtPoint(input.coordinate)}`;
    case "left_mouse_down": return "🖱 mouse down";
    case "left_mouse_up": return "🖱 mouse up";
    case "scroll": return `🖱 scroll ${input.scroll_direction || ""} ×${input.scroll_amount || 3} ${fmtPoint(input.coordinate)}`.trim();
    case "type": return `⌨️ type “${secret ? "••••••" : clip(input.text, 48)}”`;
    case "key": return `⌨️ key ${clip(input.text, 30)}${Number(input.repeat) > 1 ? ` ×${input.repeat}` : ""}`;
    case "hold_key": return `⌨️ hold ${clip(input.text, 30)} ${input.duration || 1}s`;
    case "wait": return `⏳ wait ${input.duration || 1}s`;
    case "cursor_position": return "🖱 cursor position";
    case "confirm_with_user": return `❓ ${clip(input.question, 80)}`;
    default: return name;
  }
}

module.exports = { performAction, summarizeAction, abortableSleep, POINTER_ACTIONS };
