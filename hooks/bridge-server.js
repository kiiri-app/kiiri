"use strict";

// Local control bridge HTTP server (127.0.0.1 only). Agent hooks report their
// state here and the MCP server (kiri-mcp-server.js) drives the pet through it.
// Kept free of Electron so the transport rules — POST-only, token header,
// body cap, JSON parsing, error mapping — are unit-testable (test/bridge-server.test.js).
// main.js supplies the route handlers.

const http = require("http");
const crypto = require("crypto");

const DEFAULT_MAX_BODY = 8192;

function tokenMatches(given, expected) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(String(expected || ""));
  // Length check first: timingSafeEqual throws on unequal lengths.
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  if (res.headersSent) return;
  if (body !== null && typeof body === "object") {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  } else {
    res.writeHead(status);
    res.end(body == null ? "" : String(body));
  }
}

// routes: { "/path": async (data) => ({ status?, body? }) | undefined }
// A handler that throws answers 400 (bad input); a missing return value is 200 "ok".
function createBridgeServer({ token, routes, maxBody = DEFAULT_MAX_BODY, onError }) {
  return http.createServer((req, res) => {
    const handler = req.method === "POST" && Object.prototype.hasOwnProperty.call(routes, req.url)
      ? routes[req.url]
      : null;
    if (!handler) return send(res, 404, "not found");
    if (!tokenMatches(req.headers["x-kiri-token"], token)) return send(res, 403, "forbidden");

    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= maxBody) chunks.push(chunk);
    });
    req.on("end", async () => {
      if (size > maxBody) return send(res, 413, "too large");
      let data;
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        data = JSON.parse(raw || "{}");
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
      } catch {
        return send(res, 400, "bad json");
      }
      try {
        const out = await handler(data);
        if (!out) return send(res, 200, "ok");
        send(res, out.status || 200, out.body === undefined ? "ok" : out.body);
      } catch (err) {
        if (onError) onError(err, req.url);
        send(res, 400, (err && err.message) || "bad request");
      }
    });
  });
}

module.exports = { createBridgeServer, tokenMatches };
