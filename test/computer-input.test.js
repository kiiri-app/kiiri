"use strict";

// Platform input drivers (ai/computer/input.js) against fake osascript /
// PowerShell / xdotool processes — nothing here posts real input.

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const {
  parseCombo, MAC_KEYCODES, macLayoutKeyCode, winVkFromScan, winKey, x11Combo, x11Key, isCharKey,
} = require("../ai/computer/keys");
const { createInput, MAC_JXA, WIN_PS, winRequestLine, winEncodedCommand } = require("../ai/computer/input");
const { nativePoint } = require("../ai/computer/scaling");

// ───────────────────────────── layout tables ─────────────────────────────

// What the macOS "layout" op returns, trimmed to the keys these tests use.
// Turkish Q: "ı" sits on the US "i" key (34) and "i" on the US "'" key (39).
const TR_Q = {
  id: "com.apple.keylayout.Turkish-QWERTY-PC",
  plain: { a: 0, c: 8, v: 9, x: 7, i: 39, "ı": 34, "-": 24, "*": 27, "ş": 41, 1: 18 },
  cmd: { a: 0, c: 8, v: 9, x: 7, i: 39, "ı": 34, "-": 24, "*": 27, "ş": 41, 1: 18 },
};
// Dvorak: "x" is on the US "b" key (11), "v" on the US "." key (47), "c" on "i" (34).
const DVORAK = { id: "com.apple.keylayout.Dvorak", plain: { x: 11, v: 47, c: 34, a: 0, s: 41 }, cmd: { x: 11, v: 47, c: 34, a: 0, s: 41 } };
// "Dvorak – QWERTY ⌘": Dvorak while typing, QWERTY positions while ⌘ is held.
const DVORAK_QWERTY_CMD = { id: "com.apple.keylayout.DVORAK-QWERTYCMD", plain: { x: 11, v: 47, c: 34 }, cmd: { x: 7, v: 9, c: 8 } };
// AZERTY: a/q and z/w swapped; the number row types symbols unshifted.
const AZERTY = { id: "com.apple.keylayout.French", plain: { a: 12, q: 0, z: 13, w: 6, "&": 18 }, cmd: { a: 12, q: 0, z: 13, w: 6, "&": 18 } };
// Russian: no Latin letters at all.
const RUSSIAN = { id: "com.apple.keylayout.Russian", plain: { "ф": 0, "с": 8 }, cmd: { "ф": 0, "с": 8 } };

test("macLayoutKeyCode: shortcut letters follow the current layout", () => {
  assert.equal(macLayoutKeyCode("i", ["cmd"], TR_Q), 39);
  assert.equal(macLayoutKeyCode("ı", [], TR_Q), 34);
  assert.equal(macLayoutKeyCode("ş", ["cmd"], TR_Q), 41); // not in the ANSI table at all
  assert.equal(macLayoutKeyCode("x", ["cmd"], DVORAK), 11);
  assert.equal(macLayoutKeyCode("v", ["cmd"], DVORAK), 47);
  assert.equal(macLayoutKeyCode("a", ["cmd"], AZERTY), 12);
  assert.equal(macLayoutKeyCode("z", ["cmd"], AZERTY), 13);
  // ⌘ table wins when ⌘ is held, the plain one otherwise
  assert.equal(macLayoutKeyCode("x", ["cmd"], DVORAK_QWERTY_CMD), 7);
  assert.equal(macLayoutKeyCode("x", [], DVORAK_QWERTY_CMD), 11);
  assert.equal(macLayoutKeyCode("x", ["ctrl"], DVORAK_QWERTY_CMD), 11);
});

test("macLayoutKeyCode: ANSI fallback for named keys, missing chars and no table", () => {
  for (const layout of [TR_Q, DVORAK, AZERTY, RUSSIAN, null]) {
    assert.equal(macLayoutKeyCode("return", [], layout), 36);
    assert.equal(macLayoutKeyCode("f5", ["cmd"], layout), 96);
    assert.equal(macLayoutKeyCode("left", ["shift"], layout), 123);
    assert.equal(macLayoutKeyCode("space", [], layout), 49);
  }
  assert.equal(macLayoutKeyCode("c", ["cmd"], RUSSIAN), MAC_KEYCODES.c); // macOS matches ⌘C by US position
  assert.equal(macLayoutKeyCode("1", ["cmd"], AZERTY), MAC_KEYCODES[1]); // number row: physical key
  assert.equal(macLayoutKeyCode("c", ["cmd"], null), 8);
  assert.equal(macLayoutKeyCode("c", ["cmd"], { plain: { c: "8" }, cmd: { c: -1 } }), 8); // junk ignored
  assert.equal(macLayoutKeyCode("toString", [], { plain: {}, cmd: {} }), undefined);
  assert.equal(macLayoutKeyCode("constructor", ["cmd"], null), undefined);
  assert.equal(winKey("constructor"), null);
  assert.equal(macLayoutKeyCode("ş", [], null), undefined);
});

test("isCharKey separates typed characters from named keys", () => {
  for (const k of ["a", "ş", "-", "+", "1", "😀"]) assert.equal(isCharKey(k), true, k);
  for (const k of ["return", "f5", "page_up", "", " ", null]) assert.equal(isCharKey(k), false, String(k));
});

// ───────────────────────────── macOS driver ─────────────────────────────

function fakeOsascript(layout, { failLayout = false } = {}) {
  const calls = [];
  const exec = (file, args, opts, cb) => {
    assert.equal(file, "/usr/bin/osascript");
    const cmd = JSON.parse(args[args.length - 1]);
    calls.push(cmd);
    setImmediate(() => {
      if (cmd.op === "layout") {
        if (failLayout) return cb(Object.assign(new Error("boom"), { code: 1 }), "", "execution error: Error: boom");
        return cb(null, JSON.stringify(layout) + "\n", "");
      }
      cb(null, "OK\n", "");
    });
  };
  return { exec, calls };
}

test("mac driver: reads the layout once per run and maps shortcut keys with it", async () => {
  const { exec, calls } = fakeOsascript(TR_Q);
  const d = createInput({ platform: "darwin", exec });
  await d.key("cmd+i");
  await d.key("cmd+c");
  await d.key("Return");
  await d.holdKey("shift+i", 0);
  const keys = calls.filter((c) => c.op === "key" || c.op === "hold");
  assert.deepEqual(keys.map((c) => c.code), [39, 8, 36, 39]);
  assert.equal(keys[0].flags, 1048576);
  assert.equal(calls.filter((c) => c.op === "layout").length, 1, "layout table cached");
});

test("mac driver: ⌘V for pasting follows the layout; failure falls back to ANSI", async () => {
  const dv = fakeOsascript(DVORAK);
  await createInput({ platform: "darwin", exec: dv.exec }).type("merhaba dünya");
  assert.deepEqual(dv.calls.find((c) => c.op === "type"), { op: "type", text: "merhaba dünya", v: 47 });

  const broken = fakeOsascript(null, { failLayout: true });
  const d = createInput({ platform: "darwin", exec: broken.exec });
  await d.key("cmd+x");
  await d.type("hi");
  assert.equal(broken.calls.find((c) => c.op === "key").code, 7);
  assert.equal(broken.calls.find((c) => c.op === "type").v, 9);
  assert.equal(broken.calls.filter((c) => c.op === "layout").length, 1, "a failed read isn't retried every key");
  await assert.rejects(d.key("cmd+ş"), /not supported on macOS/);
});

test("mac JXA: clipboard snapshot covers every item and type, keeps the concealed markers", () => {
  assert.match(MAC_JXA, /function pbSnapshot\(pb\)/);
  assert.match(MAC_JXA, /pasteboardItems/);
  assert.match(MAC_JXA, /dataForType\(ty\)/);
  assert.match(MAC_JXA, /writeObjects\(objs\)/);
  assert.match(MAC_JXA, /org\.nspasteboard\.ConcealedType/);
  assert.match(MAC_JXA, /org\.nspasteboard\.TransientType/);
  assert.match(MAC_JXA, /changeCount !== c\.count/); // a newer copy by the user is left alone
  assert.match(MAC_JXA, /finally \{\s*restoreClipboard\(\);/);
  assert.doesNotMatch(MAC_JXA, /stringForType\(\$\.NSPasteboardTypeString\)/, "no text-only save any more");
  assert.match(MAC_JXA, /op === 'layout'/);
  assert.match(MAC_JXA, /UCKeyTranslate/);
});

// ───────────────────────────── Windows ─────────────────────────────

test("winVkFromScan: VkKeyScanEx results", () => {
  assert.equal(winVkFromScan(0x0043), 0x43); // "c" → VK_C
  assert.equal(winVkFromScan(0x01bb), 0xbb); // "+" on US = shift + VK_OEM_PLUS → the "+" key
  assert.equal(winVkFromScan(0x00de), 0xde); // "i" on Turkish Q (VK_OEM_7)
  assert.equal(winVkFromScan(-1), null); // layout can't type it
  assert.equal(winVkFromScan(0xffff), null);
  assert.equal(winVkFromScan(0x0651), null); // "@" via AltGr+Q: pressing Q would type q
  assert.equal(winVkFromScan(0x0251), null);
  assert.equal(winVkFromScan("x"), null);
  assert.equal(winVkFromScan(undefined), null);
});

test("winKey: named keys, numpad Enter is extended", () => {
  assert.deepEqual(winKey("return"), { vk: 0x0d, ext: false });
  assert.deepEqual(winKey("kp_enter"), { vk: 0x0d, ext: true });
  assert.deepEqual(winKey("left"), { vk: 0x25, ext: true });
  assert.deepEqual(winKey("f13"), { vk: 0x7c, ext: false });
  assert.equal(winKey("ş"), null);
});

test("winRequestLine is pure ASCII; the encoded helper fits the command line", () => {
  const line = winRequestLine({ id: 3, op: "unicode", text: "Gönder ş 한글 😀" });
  assert.match(line, /^[\x20-\x7e]*\n$/);
  assert.deepEqual(JSON.parse(line), { id: 3, op: "unicode", text: "Gönder ş 한글 😀" });
  assert.ok(winEncodedCommand().length < 30000, "powershell -EncodedCommand must stay under 32767 chars");
  assert.equal(Buffer.from(winEncodedCommand(), "base64").toString("utf16le"), WIN_PS);
  assert.match(WIN_PS, /UTF8Encoding\]::new\(\$false\)/);
  assert.match(WIN_PS, /VkKeyScanEx/);
  assert.match(WIN_PS, /SetThreadDpiAwarenessContext/);
});

// A fake powershell.exe speaking the helper's line protocol.
function fakePowershell(handler) {
  const sent = [];
  const procs = [];
  const spawnFn = (file, args) => {
    assert.equal(file, "powershell.exe");
    assert.ok(args.includes("-EncodedCommand"));
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.kill = () => {};
    proc.stdin = {
      write(line) {
        assert.match(line, /^[\x20-\x7e]*\n$/);
        const msg = JSON.parse(line);
        sent.push(msg);
        setImmediate(() => {
          let reply;
          try { reply = { id: msg.id, ok: true, result: handler(msg) ?? "OK" }; } catch (err) { reply = { id: msg.id, ok: false, error: err.message }; }
          proc.stdout.emit("data", Buffer.from(JSON.stringify(reply) + "\r\n", "utf8"));
        });
      },
      end() {},
    };
    procs.push(proc);
    setImmediate(() => proc.stdout.emit("data", Buffer.from('{"ready":true}\r\n')));
    return proc;
  };
  return { spawnFn, sent, procs };
}

test("windows driver: character keys use the foreground layout's VK, modifiers wrap them", async () => {
  // AZERTY-ish: "a" is typed by VK_Q's key on this fake layout; "ş" not typable.
  const ps = fakePowershell((m) => (m.op === "vkscan" ? ({ a: 0x51, c: 0x43, "+": 0x1bb }[m.ch] ?? -1) : undefined));
  const d = createInput({ platform: "win32", spawnFn: ps.spawnFn });
  await d.key("ctrl+a");
  const seq = ps.sent.filter((m) => m.op === "vk").map((m) => [m.vk, m.down, m.ext]);
  assert.deepEqual(seq, [[0x11, true, false], [0x51, true, false], [0x51, false, false], [0x11, false, false]]);
  assert.equal(ps.sent.filter((m) => m.op === "vkscan").length, 1, "resolved once, before the modifiers");

  ps.sent.length = 0;
  await d.key("ctrl++");
  assert.deepEqual(ps.sent.filter((m) => m.op === "vk").map((m) => m.vk), [0x11, 0xbb, 0xbb, 0x11]);

  ps.sent.length = 0;
  await d.key("ctrl+-"); // vkscan -1 → fixed table
  assert.deepEqual(ps.sent.filter((m) => m.op === "vk").map((m) => m.vk), [0x11, 0xbd, 0xbd, 0x11]);

  await assert.rejects(d.key("ctrl+ş"), /not supported on Windows/);
  d.dispose();
});

test("windows driver: modifiers are released even when the key press fails", async () => {
  let fail = false;
  const ps = fakePowershell((m) => {
    if (m.op === "vkscan") return 0x43;
    if (m.op === "vk" && m.vk === 0x43 && fail) throw new Error("SendInput was blocked");
    return undefined;
  });
  const d = createInput({ platform: "win32", spawnFn: ps.spawnFn });
  fail = true;
  await assert.rejects(d.key("ctrl+shift+c"), /SendInput was blocked/);
  const vks = ps.sent.filter((m) => m.op === "vk").map((m) => [m.vk, m.down]);
  assert.deepEqual(vks, [[0x11, true], [0x10, true], [0x43, true], [0x10, false], [0x11, false]]);
  d.dispose();
});

test("windows driver: UTF-8 replies split mid-character decode correctly; helper restarts after exit", async () => {
  const ps2 = fakePowershell((m) => (m.op === "context" ? { app: "Notepad", title: "Belge — ş ğ 한글", secure: false } : undefined));
  const d2 = createInput({ platform: "win32", spawnFn: ps2.spawnFn });
  const realEmit = EventEmitter.prototype.emit;
  await d2.move({ x: 0, y: 0 });
  const p2 = ps2.procs[0];
  // Re-route this process's replies through a byte-by-byte splitter.
  p2.stdout.emit = function (ev, chunk) {
    if (ev !== "data" || chunk.length < 2) return realEmit.call(this, ev, chunk);
    for (let i = 0; i < chunk.length; i++) realEmit.call(this, ev, chunk.subarray(i, i + 1));
    return true;
  };
  assert.deepEqual(await d2.context(), { app: "Notepad", windowTitle: "Belge — ş ğ 한글", secureInput: false });

  // the helper dies → pending calls fail, the next call spawns a fresh one
  p2.emit("exit", 1);
  await d2.move({ x: 5, y: 5 });
  assert.equal(ps2.procs.length, 2);
  d2.dispose();
});

test("windows driver: points go through toNative before SetCursorPos", async () => {
  const ps = fakePowershell(() => undefined);
  const d = createInput({ platform: "win32", spawnFn: ps.spawnFn, toNative: (p) => ({ x: p.x * 1.5, y: p.y * 1.5 }) });
  await d.click({ x: 101, y: 33 });
  assert.deepEqual(ps.sent[0], { id: ps.sent[0].id, op: "move", x: 152, y: 50 });
  d.dispose();
});

// ───────────────────────────── Linux (xdotool) ─────────────────────────────

test("x11 keysyms: '+' and other shifted symbols are named, non-ASCII as Unicode keysyms", () => {
  assert.equal(x11Combo(parseCombo("ctrl++")), "ctrl+plus");
  assert.equal(x11Combo(parseCombo("ctrl+shift+T")), "ctrl+shift+t");
  assert.equal(x11Combo(parseCombo("super+space")), "super+space");
  assert.equal(x11Combo(parseCombo("alt+F4")), "alt+F4");
  assert.equal(x11Combo(parseCombo("ctrl+ş")), "ctrl+U015F");
  assert.equal(x11Key("?"), "question");
  assert.equal(x11Key("é"), "U00E9");
  assert.equal(x11Key("constructor"), "constructor");
  assert.equal(x11Key("Return".toLowerCase()), "Return");
});

function fakeXdotool() {
  const calls = [];
  const exec = (file, args, opts, cb) => {
    assert.equal(file, "xdotool");
    calls.push(args);
    setImmediate(() => cb(null, "", ""));
  };
  return { exec, calls };
}

test("linux driver: drag moves in steps and always releases; holdKey releases", async () => {
  const xd = fakeXdotool();
  const d = createInput({ platform: "linux", exec: xd.exec, toNative: (p) => ({ x: p.x * 2, y: p.y * 2 }) });
  await d.drag({ x: 0, y: 0 }, { x: 60, y: 30 });
  const moves = xd.calls.filter((a) => a[0] === "mousemove");
  assert.ok(moves.length >= 4, "intermediate motion");
  assert.deepEqual(moves[moves.length - 1].slice(-2), ["120", "60"]);
  assert.deepEqual(xd.calls[xd.calls.length - 1], ["mouseup", "1"]);
  await d.key("ctrl++");
  assert.deepEqual(xd.calls[xd.calls.length - 1], ["key", "--repeat", "1", "--", "ctrl+plus"]);
  await d.holdKey("shift", 0);
  assert.deepEqual(xd.calls.slice(-2), [["keydown", "--", "shift"], ["keyup", "--", "shift"]]);
});

// ───────────────────────────── DIP → native ─────────────────────────────

test("nativePoint: mac unchanged, Windows via dipToScreenPoint, Linux × scaleFactor", () => {
  const p = { x: 100, y: 50 };
  assert.deepEqual(nativePoint(p, { platform: "darwin", screen: {} }), p);
  assert.deepEqual(nativePoint(p, { platform: "win32", screen: { dipToScreenPoint: (q) => ({ x: q.x * 1.25, y: q.y * 1.25 }) } }), { x: 125, y: 62.5 });
  const linuxScreen = { getDisplayNearestPoint: () => ({ scaleFactor: 2 }) };
  assert.deepEqual(nativePoint(p, { platform: "linux", screen: linuxScreen }), { x: 200, y: 100 });
  assert.deepEqual(nativePoint(p, { platform: "linux", screen: { getDisplayNearestPoint: () => ({}) } }), p);
  assert.deepEqual(nativePoint(p, { platform: "linux" }), p);
});
