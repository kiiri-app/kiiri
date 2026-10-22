"use strict";

// Key-combo parsing for the computer toolset's `key` / `hold_key` / modifier
// `text` inputs. The model writes xdotool-style names ("Return", "ctrl+s",
// "cmd+shift+t", "Page_Down", "KP_Enter"); we normalize them once here so the
// risk gate and every platform driver agree on what a combo means.

const MOD_ORDER = ["cmd", "ctrl", "alt", "shift"];
const MOD_ALIASES = {
  cmd: "cmd", command: "cmd", super: "cmd", meta: "cmd", win: "cmd", windows: "cmd", "⌘": "cmd",
  ctrl: "ctrl", control: "ctrl", ctl: "ctrl", "⌃": "ctrl",
  alt: "alt", option: "alt", opt: "alt", altgr: "alt", "⌥": "alt",
  shift: "shift", "⇧": "shift",
};

const KEY_ALIASES = {
  enter: "return", return: "return", ret: "return", kp_enter: "kp_enter",
  esc: "escape", escape: "escape",
  backspace: "backspace", back_space: "backspace", bksp: "backspace",
  del: "delete", delete: "delete", forwarddelete: "delete",
  tab: "tab", space: "space", spacebar: "space", " ": "space",
  up: "up", arrowup: "up", down: "down", arrowdown: "down", left: "left", arrowleft: "left", right: "right", arrowright: "right",
  pageup: "page_up", page_up: "page_up", prior: "page_up", pagedown: "page_down", page_down: "page_down", next: "page_down",
  home: "home", end: "end", insert: "insert", ins: "insert", help: "insert",
  capslock: "caps_lock", caps_lock: "caps_lock",
  minus: "-", plus: "=", equal: "=", comma: ",", period: ".", slash: "/", semicolon: ";",
  apostrophe: "'", quoteright: "'", bracketleft: "[", bracketright: "]", backslash: "\\", grave: "`",
};

// Returns { mods: [...canonical order], key } or null for an empty combo.
// A bare modifier ("shift") yields { mods: [], key: "shift" }.
function parseCombo(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return null;
  // "ctrl++" → ["ctrl", "+"]; a single "+" is the plus key.
  const parts = raw === "+" ? ["+"] : raw.split(/\+(?!$)/).map((p) => p.trim()).filter((p) => p !== "");
  const mods = new Set();
  let key = null;
  parts.forEach((p, i) => {
    const lower = p.toLowerCase();
    const isLast = i === parts.length - 1;
    if (MOD_ALIASES[lower] && !isLast) { mods.add(MOD_ALIASES[lower]); return; }
    if (MOD_ALIASES[lower] && isLast && parts.length === 1) { key = MOD_ALIASES[lower]; return; }
    if (MOD_ALIASES[lower] && isLast) { mods.add(MOD_ALIASES[lower]); return; }
    key = normalizeKey(p);
  });
  if (!key) {
    // "ctrl+shift" — hold the modifiers; treat the last one as the key.
    const list = MOD_ORDER.filter((m) => mods.has(m));
    key = list.pop() || null;
    mods.clear();
    list.forEach((m) => mods.add(m));
  }
  return { mods: MOD_ORDER.filter((m) => mods.has(m)), key };
}

function normalizeKey(p) {
  const lower = String(p).toLowerCase();
  if (KEY_ALIASES[lower] !== undefined) return KEY_ALIASES[lower];
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) return lower;
  if ([...p].length === 1) return p.length === 1 && /[A-Z]/.test(p) ? lower : p;
  return lower;
}

// macOS virtual key codes at ANSI (US) positions. Named keys (Return, arrows,
// F-keys…) are the same on every layout; for characters this table is only the
// fallback — macLayoutKeyCode() first asks the user's current keyboard layout
// which key types that character (Turkish Q puts "i" on the US "'" key, Dvorak
// puts "x" on the US "b" key, AZERTY swaps a/q and z/w).
const MAC_KEYCODES = {
  a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14, r: 15,
  y: 16, t: 17, 1: 18, 2: 19, 3: 20, 4: 21, 6: 22, 5: 23, "=": 24, 9: 25, 7: 26, "-": 27, 8: 28,
  0: 29, "]": 30, o: 31, u: 32, "[": 33, i: 34, p: 35, return: 36, l: 37, j: 38, "'": 39, k: 40,
  ";": 41, "\\": 42, ",": 43, "/": 44, n: 45, m: 46, ".": 47, tab: 48, space: 49, "`": 50,
  backspace: 51, escape: 53, caps_lock: 57, kp_enter: 76,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103,
  f12: 111, f13: 105, f14: 107, f15: 113, f16: 106, f17: 64, f18: 79, f19: 80, f20: 90,
  insert: 114, home: 115, page_up: 116, delete: 117, end: 119, page_down: 121,
  left: 123, right: 124, down: 125, up: 126,
  cmd: 55, shift: 56, alt: 58, ctrl: 59,
};

// Windows virtual-key codes. `ext` = needs KEYEVENTF_EXTENDEDKEY.
const WIN_VK = {
  backspace: 0x08, tab: 0x09, return: 0x0d, kp_enter: 0x0d, shift: 0x10, ctrl: 0x11, alt: 0x12,
  caps_lock: 0x14, escape: 0x1b, space: 0x20, page_up: 0x21, page_down: 0x22, end: 0x23, home: 0x24,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28, insert: 0x2d, delete: 0x2e, cmd: 0x5b,
  ";": 0xba, "=": 0xbb, ",": 0xbc, "-": 0xbd, ".": 0xbe, "/": 0xbf, "`": 0xc0, "[": 0xdb, "\\": 0xdc,
  "]": 0xdd, "'": 0xde,
};
for (let i = 0; i < 26; i++) WIN_VK[String.fromCharCode(97 + i)] = 0x41 + i;
for (let i = 0; i < 10; i++) WIN_VK[String(i)] = 0x30 + i;
for (let i = 1; i <= 24; i++) WIN_VK[`f${i}`] = 0x6f + i;
const WIN_EXTENDED = new Set([0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2d, 0x2e, 0x5b]);

// Own-property lookup: "constructor" must not resolve to Object.prototype.
function own(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

// A key that is a single typed character ("c", "ş", "-") rather than a named
// key ("return", "f5") — the ones whose position depends on the layout.
function isCharKey(key) {
  return typeof key === "string" && [...key].length === 1 && key !== " ";
}

// layout: { plain: { char: keyCode }, cmd: { char: keyCode } } from the macOS
// JXA "layout" op (UCKeyTranslate over the current keyboard layout, without and
// with ⌘ held — "Dvorak – QWERTY ⌘" layouts change under ⌘). Falls back to the
// ANSI code when the layout doesn't type the character (Russian, Greek… — macOS
// itself then matches ⌘-shortcuts by US position) or no table could be built.
function macLayoutKeyCode(key, mods, layout) {
  if (layout && isCharKey(key)) {
    const tables = (mods || []).includes("cmd") ? [layout.cmd, layout.plain] : [layout.plain, layout.cmd];
    for (const t of tables) {
      const code = t ? own(t, key) : undefined;
      if (Number.isInteger(code) && code >= 0 && code < 128) return code;
    }
  }
  return own(MAC_KEYCODES, key);
}

// VkKeyScanEx() result → virtual-key code, or null. Low byte = VK (0xFF/-1 = the
// layout can't type it), high byte = shift state needed (1 shift, 2 ctrl, 4 alt).
// Shift is ignored (ctrl+"+" means ctrl + the "+" key); characters that need
// ctrl/alt (AltGr) are rejected — pressing that VK would type something else.
function winVkFromScan(scan) {
  const n = Number(scan);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
  const vk = n & 0xff;
  const state = (n >> 8) & 0xff;
  if (vk === 0xff || vk === 0 || state & 6) return null;
  return vk;
}

// { vk, ext } for a named / ANSI key on Windows. Numpad Enter is VK_RETURN with
// the extended flag (that is how Windows tells it from the main Enter).
function winKey(name) {
  const vk = own(WIN_VK, name);
  if (vk === undefined) return null;
  return { vk, ext: name === "kp_enter" || WIN_EXTENDED.has(vk) };
}

// xdotool keysyms for Linux.
const X11_KEYSYM = {
  return: "Return", kp_enter: "KP_Enter", escape: "Escape", backspace: "BackSpace", delete: "Delete",
  tab: "Tab", space: "space", up: "Up", down: "Down", left: "Left", right: "Right",
  page_up: "Prior", page_down: "Next", home: "Home", end: "End", insert: "Insert", caps_lock: "Caps_Lock",
  cmd: "super", ctrl: "ctrl", alt: "alt", shift: "shift",
  "-": "minus", "=": "equal", ",": "comma", ".": "period", "/": "slash", ";": "semicolon", "'": "apostrophe",
  "[": "bracketleft", "]": "bracketright", "\\": "backslash", "`": "grave",
  // xdotool splits combos on "+", so "ctrl++" must name the key; the other
  // shifted ASCII symbols aren't valid keysym names as bare characters either.
  "+": "plus", "!": "exclam", "@": "at", "#": "numbersign", $: "dollar", "%": "percent",
  "^": "asciicircum", "&": "ampersand", "*": "asterisk", "(": "parenleft", ")": "parenright",
  _: "underscore", "{": "braceleft", "}": "braceright", "|": "bar", ":": "colon", "\"": "quotedbl",
  "<": "less", ">": "greater", "?": "question", "~": "asciitilde",
};

function x11Key(key) {
  if (own(X11_KEYSYM, key)) return X11_KEYSYM[key];
  if (/^f\d+$/.test(key)) return key.toUpperCase();
  // Non-ASCII characters ("ş", "é") as Unicode keysyms ("U015F"), which
  // xdotool resolves through XStringToKeysym.
  if (isCharKey(key) && key.codePointAt(0) > 0x7e) return "U" + key.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
  return key;
}

function x11Combo(combo) {
  return [...combo.mods.map((m) => X11_KEYSYM[m]), x11Key(combo.key)].join("+");
}

module.exports = {
  parseCombo, MAC_KEYCODES, WIN_VK, WIN_EXTENDED, x11Combo, x11Key, MOD_ORDER,
  isCharKey, macLayoutKeyCode, winVkFromScan, winKey,
};
