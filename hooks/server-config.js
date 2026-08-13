"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_AGENT_PORT = 23456;
const STATE_PATH = "/agent-state";

// This file is copied to {userData}/hooks/ at install time, so the token that
// main.js writes to {userData}/agent-state-token is one directory up.
function readAgentToken() {
  if (process.env.KIRI_AGENT_TOKEN) return process.env.KIRI_AGENT_TOKEN;
  try {
    return fs.readFileSync(path.join(__dirname, "..", "agent-state-token"), "utf8").trim();
  } catch {
    return "";
  }
}

function postAgentState(payload, callback) {
  const body = JSON.stringify(payload || {});
  const req = http.request({
    hostname: "127.0.0.1",
    port: DEFAULT_AGENT_PORT,
    path: STATE_PATH,
    method: "POST",
    timeout: 120,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "X-Kiri-Token": readAgentToken(),
    },
  }, (res) => {
    res.resume();
    res.on("end", () => callback && callback());
  });

  req.on("timeout", () => req.destroy());
  req.on("error", () => callback && callback());
  req.end(body);
}

// Generic bridge call used by the MCP server: same auth/host as the hooks but
// promise-based, with a longer timeout and the response body, because MCP tools
// must report a real result back to the calling agent (the fire-and-forget
// postAgentState above is right for hooks, wrong here).
function callBridge(route, payload, { timeout = 4000 } = {}) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload || {});
    const req = http.request({
      hostname: "127.0.0.1",
      port: DEFAULT_AGENT_PORT,
      path: route,
      method: "POST",
      timeout,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Kiri-Token": readAgentToken(),
      },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data, json });
      });
    });
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, body: "", json: null, error: "timeout" }); });
    req.on("error", (err) => resolve({ ok: false, status: 0, body: "", json: null, error: (err && err.code) || "error" }));
    req.end(body);
  });
}

module.exports = {
  DEFAULT_AGENT_PORT,
  STATE_PATH,
  postAgentState,
  callBridge,
  readAgentToken,
};
