"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBridgeServer, tokenMatches } = require("../hooks/bridge-server");

const TOKEN = "t0ken-for-tests";

async function withServer(routes, fn) {
  const server = createBridgeServer({ token: TOKEN, routes, maxBody: 64 });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (base, route, body, token = TOKEN) => fetch(base + route, {
  method: "POST",
  headers: token ? { "X-Kiri-Token": token } : {},
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("tokenMatches is exact and rejects empty tokens", () => {
  assert.equal(tokenMatches("abc", "abc"), true);
  assert.equal(tokenMatches("abd", "abc"), false);
  assert.equal(tokenMatches("abcd", "abc"), false);
  assert.equal(tokenMatches("", ""), false);
  assert.equal(tokenMatches(undefined, "abc"), false);
});

test("unknown route or non-POST → 404, before the token is checked", async () => {
  await withServer({ "/x": () => {} }, async (base) => {
    assert.equal((await fetch(base + "/x")).status, 404);
    assert.equal((await post(base, "/nope", {}, null)).status, 404);
  });
});

test("missing or wrong token → 403 and the handler never runs", async () => {
  let ran = false;
  await withServer({ "/x": () => { ran = true; } }, async (base) => {
    assert.equal((await post(base, "/x", {}, null)).status, 403);
    assert.equal((await post(base, "/x", {}, "wrong")).status, 403);
  });
  assert.equal(ran, false);
});

test("oversized body → 413; bad or non-object JSON → 400", async () => {
  await withServer({ "/x": () => {} }, async (base) => {
    assert.equal((await post(base, "/x", { text: "y".repeat(200) })).status, 413);
    assert.equal((await post(base, "/x", "{not json")).status, 400);
    assert.equal((await post(base, "/x", "[1,2]")).status, 400);
  });
});

test("handler results map to status + body", async () => {
  const routes = {
    "/ok": () => {},
    "/json": async (data) => ({ body: { echo: data.v } }),
    "/denied": () => ({ status: 403, body: { ok: false, error: "denied" } }),
    "/throws": () => { throw new Error("no text"); },
  };
  await withServer(routes, async (base) => {
    let r = await post(base, "/ok", {});
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "ok");
    r = await post(base, "/json", { v: 7 });
    assert.deepEqual(await r.json(), { echo: 7 });
    r = await post(base, "/denied", {});
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, "denied");
    r = await post(base, "/throws", {});
    assert.equal(r.status, 400);
    assert.equal(await r.text(), "no text");
  });
});
