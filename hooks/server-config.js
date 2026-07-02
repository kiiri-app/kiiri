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

module.exports = {
  DEFAULT_AGENT_PORT,
  STATE_PATH,
  postAgentState,
};
