#!/usr/bin/env node
"use strict";

// Kiri MCP server — lets any MCP client (Claude Code, Cursor, opencode, …) drive
// the pet directly instead of only reacting to lifecycle hooks: say something,
// point at a spot on screen, set the mood, ask whether Kiri is even running.
//
// It is a thin stdio front-end for the local bridge Kiri already exposes on
// 127.0.0.1:23456 (token-authenticated) — no new attack surface, and it fails
// soft when the app is closed. Deliberately dependency-free JSON-RPC over
// stdio: this file is copied to {userData}/hooks/ and run through Kiri's own
// binary (ELECTRON_RUN_AS_NODE), where no npm tree is available.

const { callBridge } = require("./server-config");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "kiri", version: "1.0.0" };

const TOOLS = [
  {
    name: "kiri_status",
    description:
      "Check whether the Kiri desktop pet is running and what it can do right now. " +
      "Call this first if a later Kiri tool fails.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "kiri_say",
    description:
      "Make the pet say something in its speech bubble (and out loud when voice is on). " +
      "Use for short, human-friendly updates — one or two sentences, not logs or file dumps.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What the pet should say. Keep it under ~200 characters." },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "kiri_point",
    description:
      "Point at a spot on the user's screen: the pet looks at it and an arrow marks it. " +
      "Give normalized coordinates (nx, ny in 0..1 across the pet's display) unless you know exact pixels. " +
      "Use it to show WHERE something is — the button, the failing line, the panel you mean.",
    inputSchema: {
      type: "object",
      properties: {
        nx: { type: "number", description: "Horizontal position, 0 = left edge, 1 = right edge." },
        ny: { type: "number", description: "Vertical position, 0 = top edge, 1 = bottom edge." },
        x: { type: "number", description: "Absolute screen X in pixels (use instead of nx/ny when known)." },
        y: { type: "number", description: "Absolute screen Y in pixels." },
        text: { type: "string", description: "Optional short line to say while pointing." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kiri_react",
    description:
      "Set the pet's current mood/animation so the user can see the agent's state at a glance.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["thinking", "working", "idle", "complete", "notification", "error"],
          description: "thinking = reasoning, working = running tools, complete = task done, notification = needs the user.",
        },
        sessionId: { type: "string", description: "Optional id so parallel agents get separate pet sessions." },
      },
      required: ["state"],
      additionalProperties: false,
    },
  },
];

// ── stdio JSON-RPC framing (newline-delimited JSON, per MCP stdio transport) ──

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  if (id === undefined || id === null) return; // notification: nothing to answer
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function textResult(text, isError) {
  const result = { content: [{ type: "text", text }] };
  if (isError) result.isError = true;
  return result;
}

// A failed bridge call almost always means "the app is not running" — say that
// instead of surfacing a raw ECONNREFUSED to the model.
function bridgeFailureText(res) {
  if (res && res.status === 403) return "Kiri rejected the request: the local bridge token did not match. Restart Kiri and try again.";
  if (res && res.status === 404) return "This Kiri build does not support that bridge route yet — update Kiri.";
  if (res && res.status) return `Kiri returned HTTP ${res.status}.`;
  return "Kiri does not seem to be running (no local bridge on 127.0.0.1:23456). Ask the user to start the Kiri app.";
}

async function callTool(name, args) {
  const a = args && typeof args === "object" ? args : {};
  switch (name) {
    case "kiri_status": {
      const res = await callBridge("/status", {});
      if (!res.ok) return textResult(bridgeFailureText(res), true);
      const info = res.json || {};
      const bits = [
        `Kiri is running (v${info.version || "?"}).`,
        info.character ? `Active character: ${info.character}.` : null,
        info.voice ? "Voice replies are on." : "Voice replies are off.",
        `Screen size: ${info.display ? `${info.display.width}x${info.display.height}` : "unknown"}.`,
      ].filter(Boolean);
      return textResult(bits.join(" "));
    }
    case "kiri_say": {
      const text = String(a.text || "").trim();
      if (!text) return textResult("Nothing to say: `text` is required.", true);
      const res = await callBridge("/speak", { text });
      if (!res.ok) return textResult(bridgeFailureText(res), true);
      return textResult("Kiri said it.");
    }
    case "kiri_point": {
      const payload = {};
      if (Number.isFinite(a.x) && Number.isFinite(a.y)) {
        payload.x = a.x;
        payload.y = a.y;
      } else if (Number.isFinite(a.nx) && Number.isFinite(a.ny)) {
        payload.nx = a.nx;
        payload.ny = a.ny;
      } else {
        return textResult("Give either nx/ny (0..1) or absolute x/y pixels.", true);
      }
      if (a.text) payload.text = String(a.text);
      const res = await callBridge("/point", payload);
      if (!res.ok) return textResult(bridgeFailureText(res), true);
      return textResult("Kiri is looking at that spot and an arrow is marking it.");
    }
    case "kiri_react": {
      const state = String(a.state || "").trim();
      if (!state) return textResult("`state` is required.", true);
      const res = await callBridge("/agent-state", {
        agentId: "mcp",
        sessionId: String(a.sessionId || "mcp-default"),
        state,
      });
      if (!res.ok) return textResult(bridgeFailureText(res), true);
      return textResult(`Kiri is now showing "${state}".`);
    }
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}

// Requests still waiting on the bridge. A client that closes stdin (or a piped
// test session) must not cut an answer off mid-flight, so exit only once these
// have drained.
let inFlight = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && inFlight === 0) process.exit(0);
}

async function handle(message) {
  const { id, method, params } = message || {};
  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
      return;
    case "notifications/initialized":
      return;
    case "ping":
      reply(id, {});
      return;
    case "tools/list":
      reply(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params && params.name;
      if (!TOOLS.some((t) => t.name === name)) {
        replyError(id, -32602, `Unknown tool: ${name}`);
        return;
      }
      inFlight++;
      try {
        reply(id, await callTool(name, params && params.arguments));
      } catch (err) {
        reply(id, textResult(`Kiri tool failed: ${(err && err.message) || err}`, true));
      } finally {
        inFlight--;
        maybeExit();
      }
      return;
    }
    default:
      // Unknown notifications carry no id and need no answer.
      replyError(id, -32601, `Method not found: ${method}`);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    handle(message);
  }
});
process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});
