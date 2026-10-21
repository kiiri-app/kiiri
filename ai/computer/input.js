"use strict";

// Synthetic mouse + keyboard for computer use, behind one small interface so
// the agent loop never knows the platform and tests can pass a fake:
//
//   move(pt) · click(pt|null, { button, count, mods }) · mouseDown/mouseUp(pt|null, button)
//   drag(from, to, { mods }) · scroll(pt|null, { direction, amount, mods })
//   type(text) · key(combo, { repeat }) · holdKey(combo, seconds)
//   cursorPosition() → {x, y} · context() → { app, windowTitle, secureInput } · dispose()
//
// Points are global Electron DIP coordinates (scaling.shotToScreen output).
//
// Driver choice — zero-dependency OS scripting, not @nut-tree-fork/nut-js:
// nut-js (Apache-2.0) would add a native libnut .node per platform that has to
// be asar-unpacked, signed + notarized inside the mac bundle, and kept in step
// with Electron; the fork's last release was March 2025 and it pulls jimp in
// for image matching we don't use. Every OS already ships a way to post input:
//   macOS   — osascript JXA → CoreGraphics CGEventPost (one short process per
//             action, ~0.2–0.3 s; needs the Accessibility permission Kiiri asks
//             for, which TCC attributes to Kiiri as the responsible process).
//   Windows — one long-lived PowerShell process with a tiny Add-Type'd C#
//             class over user32 SendInput / SetCursorPos (compiled once per
//             run, then line-delimited JSON over stdin/stdout).
//   Linux   — xdotool if installed (X11 best effort; Wayland can't do this).
// Nothing new to package, and uiohook-napi (push-to-talk) is untouched.

const { execFile, spawn } = require("child_process");
const { parseCombo, MAC_KEYCODES, WIN_VK, WIN_EXTENDED, x11Combo } = require("./keys");

const MAX_TYPE_CHARS = 4000;
const SCROLL_LINES_PER_NOTCH = 3;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function comboOrThrow(text) {
  const c = parseCombo(text);
  if (!c || !c.key) throw new Error(`unknown key combo: ${text}`);
  return c;
}

function modsFrom(text) {
  if (!text) return [];
  const c = parseCombo(text);
  if (!c) return [];
  // modifier-only text ("shift", "ctrl+shift"): key is the last modifier
  return [...c.mods, ...(["cmd", "ctrl", "alt", "shift"].includes(c.key) ? [c.key] : [])];
}

// ───────────────────────────── macOS (JXA → CGEvent) ─────────────────────────────

const MAC_FLAGS = { cmd: 1048576, shift: 131072, alt: 524288, ctrl: 262144 };
const MAC_JXA = `
ObjC.import('CoreGraphics'); ObjC.import('AppKit'); ObjC.import('Carbon'); ObjC.import('ApplicationServices');
function P(x, y) { return $.CGPointMake(x, y); }
function post(e) { $.CGEventPost($.kCGHIDEventTap, e); }
function cur() { return $.CGEventGetLocation($.CGEventCreate(null)); }
var BTN = { left: [1, 2, 0, 6], right: [3, 4, 1, 7], middle: [25, 26, 2, 27] };
function mouse(type, pt, button, flags, clicks) {
  var e = $.CGEventCreateMouseEvent(null, type, pt, button);
  if (clicks) $.CGEventSetIntegerValueField(e, $.kCGMouseEventClickState, clicks);
  if (flags) $.CGEventSetFlags(e, flags);
  post(e);
}
function key(code, down, flags) {
  var e = $.CGEventCreateKeyboardEvent(null, code, down);
  $.CGEventSetFlags(e, flags || 0);
  post(e);
}
function uni(code) {
  var r = Ref('S'); r[0] = code;
  [true, false].forEach(function (down) {
    var e = $.CGEventCreateKeyboardEvent(null, 0, down);
    $.CGEventKeyboardSetUnicodeString(e, 1, r);
    post(e);
  });
}
function paste(s) {
  var pb = $.NSPasteboard.generalPasteboard;
  var prev = pb.stringForType($.NSPasteboardTypeString);
  pb.clearContents; pb.setStringForType($(s), $.NSPasteboardTypeString);
  key(9, true, 1048576); key(9, false, 1048576); delay(0.25);
  pb.clearContents; if (prev && prev.js !== undefined) pb.setStringForType(prev, $.NSPasteboardTypeString);
}
function run(argv) {
  var c = JSON.parse(argv[0]);
  if (c.op === 'context') {
    var app = $.NSWorkspace.sharedWorkspace.frontmostApplication;
    return JSON.stringify({ app: app ? app.localizedName.js : '', secureInput: !!$.IsSecureEventInputEnabled() });
  }
  if (c.op === 'cursor') { var l = cur(); return JSON.stringify({ x: l.x, y: l.y }); }
  if (!$.AXIsProcessTrusted()) throw new Error('accessibility permission missing');
  var b = BTN[c.button || 'left'] || BTN.left, flags = c.flags || 0;
  var here = (c.x === undefined) ? cur() : P(c.x, c.y);
  switch (c.op) {
    case 'move': mouse(c.held ? 6 : 5, here, 0, flags, 0); break;
    case 'click':
      mouse(5, here, b[2], flags, 0); delay(0.03);
      for (var i = 1; i <= (c.count || 1); i++) { mouse(b[0], here, b[2], flags, i); delay(0.02); mouse(b[1], here, b[2], flags, i); delay(0.05); }
      break;
    case 'down': mouse(b[0], here, b[2], flags, 1); break;
    case 'up': mouse(b[1], here, b[2], flags, 1); break;
    case 'drag':
      mouse(5, P(c.x0, c.y0), 0, flags, 0); delay(0.05);
      mouse(1, P(c.x0, c.y0), 0, flags, 1); delay(0.08);
      for (var s = 1; s <= 12; s++) { mouse(6, P(c.x0 + (c.x - c.x0) * s / 12, c.y0 + (c.y - c.y0) * s / 12), 0, flags, 1); delay(0.02); }
      delay(0.05); mouse(2, here, 0, flags, 1); break;
    case 'scroll':
      if (c.x !== undefined) { mouse(5, here, 0, 0, 0); delay(0.03); }
      for (var n = 0; n < c.notches; n++) {
        var w = $.CGEventCreateScrollWheelEvent2(null, $.kCGScrollEventUnitLine, 2, c.dy, c.dx, 0);
        if (flags) $.CGEventSetFlags(w, flags);
        post(w); delay(0.03);
      }
      break;
    case 'key':
      for (var k = 0; k < (c.repeat || 1); k++) { key(c.code, true, flags); delay(0.01); key(c.code, false, flags); delay(0.03); }
      break;
    case 'hold': key(c.code, true, flags); delay(c.seconds); key(c.code, false, flags); break;
    case 'type':
      var str = c.text, astral = '';
      for (var j = 0; j < str.length; j++) {
        var ch = str.charCodeAt(j);
        if (ch >= 0xD800 && ch <= 0xDBFF) { astral += str[j] + (str[j + 1] || ''); j++; continue; }
        if (astral) { paste(astral); astral = ''; }
        if (ch === 10 || ch === 13) { key(36, true, 0); key(36, false, 0); }
        else if (ch === 9) { key(48, true, 0); key(48, false, 0); }
        else uni(ch);
        delay(0.008);
      }
      if (astral) paste(astral);
      break;
    default: throw new Error('unknown op ' + c.op);
  }
  return 'OK';
}
`;

function macFlags(mods) {
  return (mods || []).reduce((f, m) => f | (MAC_FLAGS[m] || 0), 0);
}

function createMacDriver({ exec = execFile, getCursor } = {}) {
  let held = false;
  function call(cmd, timeout = 20000) {
    return new Promise((resolve, reject) => {
      exec("/usr/bin/osascript", ["-l", "JavaScript", "-e", MAC_JXA, JSON.stringify(cmd)], { timeout }, (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || err.message || "").replace(/^.*execution error: /s, "").trim();
          return reject(new Error(msg || "input failed"));
        }
        resolve(String(stdout || "").trim());
      });
    });
  }
  const pt = (p) => (p ? { x: p.x, y: p.y } : {});
  function keyCode(c) {
    const code = MAC_KEYCODES[c.key];
    if (code === undefined) throw new Error(`key not supported on macOS: ${c.key}`);
    return code;
  }
  return {
    platform: "darwin",
    move: (p) => call({ op: "move", ...pt(p), held }),
    click: (p, { button = "left", count = 1, mods = [] } = {}) => call({ op: "click", ...pt(p), button, count, flags: macFlags(mods) }),
    mouseDown: async (p, button = "left") => { await call({ op: "down", ...pt(p), button }); held = button === "left"; },
    mouseUp: async (p, button = "left") => { held = false; await call({ op: "up", ...pt(p), button }); },
    drag: (from, to, { mods = [] } = {}) => call({ op: "drag", x0: from.x, y0: from.y, x: to.x, y: to.y, flags: macFlags(mods) }),
    scroll: (p, { direction = "down", amount = 3, mods = [] } = {}) => {
      const n = Math.max(1, Math.min(30, Math.round(amount) || 1));
      const dy = direction === "up" ? SCROLL_LINES_PER_NOTCH : direction === "down" ? -SCROLL_LINES_PER_NOTCH : 0;
      const dx = direction === "left" ? SCROLL_LINES_PER_NOTCH : direction === "right" ? -SCROLL_LINES_PER_NOTCH : 0;
      return call({ op: "scroll", ...pt(p), notches: n, dy, dx, flags: macFlags(mods) });
    },
    type: (text) => call({ op: "type", text: String(text).slice(0, MAX_TYPE_CHARS) }, 60000),
    key: (combo, { repeat = 1 } = {}) => {
      const c = comboOrThrow(combo);
      return call({ op: "key", code: keyCode(c), flags: macFlags(c.mods), repeat: Math.max(1, Math.min(100, repeat | 0 || 1)) });
    },
    holdKey: (combo, seconds) => {
      const c = comboOrThrow(combo);
      const s = Math.max(0, Math.min(10, Number(seconds) || 0));
      return call({ op: "hold", code: keyCode(c), flags: macFlags(c.mods), seconds: s }, (s + 10) * 1000);
    },
    cursorPosition: async () => (getCursor ? getCursor() : JSON.parse(await call({ op: "cursor" }))),
    context: async () => {
      try { const r = JSON.parse(await call({ op: "context" }, 5000)); return { app: r.app || "", windowTitle: "", secureInput: !!r.secureInput }; }
      catch { return { app: "", windowTitle: "", secureInput: false }; }
    },
    dispose: () => {},
  };
}

// ───────────────────────── Windows (PowerShell + SendInput) ─────────────────────────

const WIN_PS = String.raw`
$ErrorActionPreference = 'Stop'
try { Add-Type -AssemblyName UIAutomationClient } catch {}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class KiiriInput {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION u; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static void Dpi() { try { if (SetProcessDpiAwarenessContext(new IntPtr(-4)) == IntPtr.Zero) SetProcessDPIAware(); } catch { try { SetProcessDPIAware(); } catch {} } }
  static void Send(INPUT[] a) {
    uint r = SendInput((uint)a.Length, a, Marshal.SizeOf(typeof(INPUT)));
    if (r != a.Length) throw new Exception("SendInput was blocked (error " + Marshal.GetLastWin32Error() + ")");
  }
  static INPUT M(uint flags, uint data) { var i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; i.u.mi.mouseData = data; return i; }
  static INPUT K(ushort vk, ushort scan, uint flags) { var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i; }
  public static void Move(int x, int y) { if (!SetCursorPos(x, y)) throw new Exception("SetCursorPos failed"); }
  public static void Button(string b, bool down) {
    uint f = b == "right" ? (down ? 0x8u : 0x10u) : b == "middle" ? (down ? 0x20u : 0x40u) : (down ? 0x2u : 0x4u);
    Send(new[] { M(f, 0) });
  }
  public static void Wheel(int notches, bool horizontal) { Send(new[] { M(horizontal ? 0x1000u : 0x800u, unchecked((uint)(notches * 120))) }); }
  public static void Vk(ushort vk, bool down, bool ext) { Send(new[] { K(vk, 0, (down ? 0u : 0x2u) | (ext ? 0x1u : 0u)) }); }
  public static void Unicode(string s) { foreach (char ch in s) { Send(new[] { K(0, ch, 0x4u), K(0, ch, 0x6u) }); Thread.Sleep(3); } }
  public static string Foreground() {
    IntPtr h = GetForegroundWindow(); var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
    uint pid; GetWindowThreadProcessId(h, out pid); return pid + "\n" + sb.ToString();
  }
}
'@
[KiiriInput]::Dpi()
[Console]::Out.WriteLine('{"ready":true}'); [Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $res = @{ id = 0; ok = $true; result = 'OK' }
  try {
    $c = ConvertFrom-Json $line
    $res.id = $c.id
    switch ($c.op) {
      'move' { [KiiriInput]::Move([int]$c.x, [int]$c.y) }
      'button' { [KiiriInput]::Button([string]$c.button, [bool]$c.down) }
      'wheel' { [KiiriInput]::Wheel([int]$c.notches, [bool]$c.horizontal) }
      'vk' { [KiiriInput]::Vk([uint16]$c.vk, [bool]$c.down, [bool]$c.ext) }
      'unicode' { [KiiriInput]::Unicode([string]$c.text) }
      'sleep' { Start-Sleep -Milliseconds ([int]$c.ms) }
      'cursor' { $p = New-Object KiiriInput+POINT; [void][KiiriInput]::GetCursorPos([ref]$p); $res.result = @{ x = $p.X; y = $p.Y } }
      'context' {
        $fg = [KiiriInput]::Foreground() -split "\n", 2
        $name = ''; try { $name = (Get-Process -Id ([int]$fg[0])).ProcessName } catch {}
        $secure = $false; try { $el = [System.Windows.Automation.AutomationElement]::FocusedElement; if ($el) { $secure = [bool]$el.Current.IsPassword } } catch {}
        $res.result = @{ app = $name; title = $fg[1]; secure = $secure }
      }
      default { throw ('unknown op ' + $c.op) }
    }
  } catch { $res.ok = $false; $res.error = $_.Exception.Message }
  [Console]::Out.WriteLine(($res | ConvertTo-Json -Compress -Depth 4)); [Console]::Out.Flush()
}
`;

function createWindowsDriver({ spawnFn = spawn, toNative = (p) => p, getCursor } = {}) {
  let child = null;
  let ready = null;
  let seq = 0;
  let buf = "";
  const waiting = new Map();

  function start() {
    if (ready) return ready;
    const encoded = Buffer.from(WIN_PS, "utf16le").toString("base64");
    child = spawnFn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true });
    ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("input helper did not start")), 20000);
      child.stdout.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.ready) { clearTimeout(timer); resolve(); continue; }
          const w = waiting.get(msg.id);
          if (!w) continue;
          waiting.delete(msg.id);
          if (msg.ok) w.resolve(msg.result); else w.reject(new Error(msg.error || "input failed"));
        }
      });
      child.on("exit", () => {
        clearTimeout(timer);
        for (const w of waiting.values()) w.reject(new Error("input helper exited"));
        waiting.clear();
        child = null; ready = null;
        reject(new Error("input helper exited"));
      });
      child.on("error", (err) => { clearTimeout(timer); reject(err); });
    });
    return ready;
  }

  async function op(cmd, timeout = 20000) {
    await start();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error("input helper timed out")); }, timeout);
      waiting.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      child.stdin.write(JSON.stringify({ id, ...cmd }) + "\n");
    });
  }
  const moveTo = (p) => { const n = toNative(p); return op({ op: "move", x: Math.round(n.x), y: Math.round(n.y) }); };
  const vk = (name, down) => {
    const code = WIN_VK[name];
    if (code === undefined) throw new Error(`key not supported on Windows: ${name}`);
    return op({ op: "vk", vk: code, down, ext: WIN_EXTENDED.has(code) });
  };
  async function withMods(mods, fn) {
    for (const m of mods) await vk(m, true);
    try { return await fn(); } finally { for (const m of [...mods].reverse()) await vk(m, false); }
  }

  return {
    platform: "win32",
    move: (p) => moveTo(p),
    click: async (p, { button = "left", count = 1, mods = [] } = {}) => {
      if (p) await moveTo(p);
      await withMods(mods, async () => {
        for (let i = 0; i < count; i++) {
          await op({ op: "button", button, down: true });
          await op({ op: "button", button, down: false });
          if (i < count - 1) await sleep(40);
        }
      });
    },
    mouseDown: async (p, button = "left") => { if (p) await moveTo(p); await op({ op: "button", button, down: true }); },
    mouseUp: async (p, button = "left") => { if (p) await moveTo(p); await op({ op: "button", button, down: false }); },
    drag: async (from, to, { mods = [] } = {}) => withMods(mods, async () => {
      await moveTo(from);
      await op({ op: "button", button: "left", down: true });
      for (let s = 1; s <= 12; s++) {
        await moveTo({ x: from.x + ((to.x - from.x) * s) / 12, y: from.y + ((to.y - from.y) * s) / 12 });
        await sleep(15);
      }
      await op({ op: "button", button: "left", down: false });
    }),
    scroll: async (p, { direction = "down", amount = 3, mods = [] } = {}) => {
      if (p) await moveTo(p);
      const n = Math.max(1, Math.min(30, Math.round(amount) || 1));
      const horizontal = direction === "left" || direction === "right";
      const sign = direction === "up" || direction === "right" ? 1 : -1;
      await withMods(mods, () => op({ op: "wheel", notches: sign * n, horizontal }));
    },
    type: async (text) => {
      // Newlines/tabs as real keys (a unicode "\n" isn't Enter in most apps).
      for (const part of String(text).slice(0, MAX_TYPE_CHARS).split(/(\r?\n|\t)/)) {
        if (!part) continue;
        if (part === "\t") { await vk("tab", true); await vk("tab", false); }
        else if (/^\r?\n$/.test(part)) { await vk("return", true); await vk("return", false); }
        else await op({ op: "unicode", text: part }, 60000);
      }
    },
    key: async (combo, { repeat = 1 } = {}) => {
      const c = comboOrThrow(combo);
      const times = Math.max(1, Math.min(100, repeat | 0 || 1));
      await withMods(c.mods, async () => {
        for (let i = 0; i < times; i++) { await vk(c.key, true); await vk(c.key, false); }
      });
    },
    holdKey: async (combo, seconds) => {
      const c = comboOrThrow(combo);
      const ms = Math.max(0, Math.min(10, Number(seconds) || 0)) * 1000;
      await withMods(c.mods, async () => { await vk(c.key, true); await op({ op: "sleep", ms }, ms + 10000); await vk(c.key, false); });
    },
    cursorPosition: async () => (getCursor ? getCursor() : op({ op: "cursor" })),
    context: async () => {
      try { const r = await op({ op: "context" }, 8000); return { app: r.app || "", windowTitle: r.title || "", secureInput: !!r.secure }; }
      catch { return { app: "", windowTitle: "", secureInput: false }; }
    },
    dispose: () => { if (child) { try { child.stdin.end(); child.kill(); } catch {} } child = null; ready = null; },
  };
}

// ───────────────────────────── Linux (xdotool) ─────────────────────────────

function createLinuxDriver({ exec = execFile, toNative = (p) => p, getCursor } = {}) {
  const x = (args, timeout = 20000) => new Promise((resolve, reject) => {
    exec("xdotool", args, { timeout }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === "ENOENT") return reject(new Error("xdotool is not installed (sudo apt install xdotool)"));
        return reject(new Error(String(stderr || err.message).trim()));
      }
      resolve(String(stdout || ""));
    });
  });
  const BTN = { left: "1", middle: "2", right: "3" };
  const at = (p) => { const n = toNative(p); return ["mousemove", "--sync", String(Math.round(n.x)), String(Math.round(n.y))]; };
  const withMods = async (mods, fn) => {
    const names = mods.map((m) => x11Combo({ mods: [], key: m }));
    if (names.length) await x(["keydown", ...names]);
    try { return await fn(); } finally { if (names.length) await x(["keyup", ...names.reverse()]); }
  };
  return {
    platform: "linux",
    move: (p) => x(at(p)),
    click: async (p, { button = "left", count = 1, mods = [] } = {}) => {
      if (p) await x(at(p));
      await withMods(mods, () => x(["click", "--repeat", String(count), "--delay", "60", BTN[button] || "1"]));
    },
    mouseDown: async (p, button = "left") => { if (p) await x(at(p)); await x(["mousedown", BTN[button] || "1"]); },
    mouseUp: async (p, button = "left") => { if (p) await x(at(p)); await x(["mouseup", BTN[button] || "1"]); },
    drag: (from, to, { mods = [] } = {}) => withMods(mods, async () => {
      await x(at(from)); await x(["mousedown", "1"]); await sleep(60); await x(at(to)); await sleep(60); await x(["mouseup", "1"]);
    }),
    scroll: async (p, { direction = "down", amount = 3, mods = [] } = {}) => {
      if (p) await x(at(p));
      const btn = { up: "4", down: "5", left: "6", right: "7" }[direction] || "5";
      const n = Math.max(1, Math.min(30, Math.round(amount) || 1));
      await withMods(mods, () => x(["click", "--repeat", String(n), "--delay", "30", btn]));
    },
    type: (text) => x(["type", "--delay", "8", "--", String(text).slice(0, MAX_TYPE_CHARS)], 60000),
    key: (combo, { repeat = 1 } = {}) => x(["key", "--repeat", String(Math.max(1, Math.min(100, repeat | 0 || 1))), "--", x11Combo(comboOrThrow(combo))]),
    holdKey: async (combo, seconds) => {
      const k = x11Combo(comboOrThrow(combo));
      await x(["keydown", k]); await sleep(Math.max(0, Math.min(10, Number(seconds) || 0)) * 1000); await x(["keyup", k]);
    },
    cursorPosition: async () => {
      if (getCursor) return getCursor();
      const out = await x(["getmouselocation", "--shell"]);
      return { x: Number((out.match(/X=(\d+)/) || [])[1] || 0), y: Number((out.match(/Y=(\d+)/) || [])[1] || 0) };
    },
    context: async () => {
      try {
        const title = (await x(["getactivewindow", "getwindowname"], 4000)).trim();
        let app = "";
        try {
          const pid = (await x(["getactivewindow", "getwindowpid"], 4000)).trim();
          app = require("fs").readFileSync(`/proc/${pid}/comm`, "utf8").trim();
        } catch {}
        return { app, windowTitle: title, secureInput: false };
      } catch { return { app: "", windowTitle: "", secureInput: false }; }
    },
    dispose: () => {},
  };
}

// opts: { platform, toNative(dipPoint) → native point, getCursor() → dip point, exec, spawnFn }
function createInput(opts = {}) {
  const platform = opts.platform || process.platform;
  if (platform === "darwin") return createMacDriver(opts);
  if (platform === "win32") return createWindowsDriver(opts);
  if (platform === "linux") return createLinuxDriver(opts);
  throw new Error(`computer use is not supported on ${platform}`);
}

module.exports = { createInput, modsFrom, macFlags, MAC_JXA, WIN_PS };
