"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { fakeElectron, fresh } = require("./helpers");

const userData = fakeElectron();
// Kiiri Cloud is "coming soon" in release builds; these tests cover the live path.
process.env.KIIRI_CLOUD = "1";

function load() {
  for (const f of ["ai-config.json", "cloud-token.bin", "ai-key.bin", "stt-key.bin"]) {
    try { fs.unlinkSync(path.join(userData, f)); } catch {}
  }
  const config = fresh("../ai/config");
  const cloud = fresh("../ai/cloud");
  return { config, cloud };
}

// Minimal fetch fake: route table keyed by "METHOD path".
function fakeFetch(routes, log = []) {
  return async (url, opts = {}) => {
    const u = new URL(url);
    const key = `${opts.method || "GET"} ${u.pathname}`;
    log.push({ key, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null });
    const r = routes[key];
    const { status, body } = typeof r === "function" ? r() : (r || { status: 404, body: {} });
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
}

// Timers we drive by hand.
function manualTimers() {
  const q = [];
  return {
    setTimer: (fn) => { q.push(fn); return q.length; },
    clearTimer: () => { q.length = 0; },
    async step() { const fn = q.shift(); if (fn) await fn(); },
    get size() { return q.length; },
  };
}

test("fresh install starts on Kiiri Cloud; an existing key keeps Anthropic", () => {
  let { config } = load();
  assert.equal(config.loadConfig().provider, "cloud");
  ({ config } = load());
  fs.writeFileSync(path.join(userData, "ai-key.bin"), "PLAIN:sk-ant-x");
  config = fresh("../ai/config");
  assert.equal(config.loadConfig().provider, "anthropic");
});

test("cloud provider resolves to the cloud endpoint with the device token", () => {
  const { config } = load();
  config.saveConfig({ provider: "cloud" });
  assert.equal(config.providerReady(), false);
  config.setCloudToken("kc_abc");
  const p = config.resolveProvider();
  assert.equal(p.id, "cloud");
  assert.equal(p.baseUrl, "https://cloud.kiiri.app/v1");
  assert.equal(p.rootUrl, "https://cloud.kiiri.app");
  assert.equal(p.apiKey, "kc_abc");
  assert.equal(config.providerReady(), true);
  assert.equal(config.audioRoute().via, "cloud");
});

test("web search on cloud follows the plan", () => {
  const { config } = load();
  config.saveConfig({ provider: "cloud", cloudPlan: "free" });
  config.setCloudToken("kc_abc");
  assert.equal(config.webSearchUsable(), false);
  config.saveConfig({ cloudPlan: "plus" });
  assert.equal(config.webSearchUsable(), true);
});

test("custom speech server: local http allowed, key optional, voice usable without OpenAI", () => {
  const { config } = load();
  config.saveConfig({ provider: "ollama", voiceEnabled: true });
  assert.equal(config.voiceUsable(), false);
  config.saveConfig({ sttMode: "custom", sttBaseUrl: "http://localhost:8000/v1/", sttModel: "Systran/faster-whisper-small" });
  const r = config.sttRoute();
  assert.deepEqual(r, { via: "custom", baseUrl: "http://localhost:8000/v1", apiKey: "", model: "Systran/faster-whisper-small" });
  assert.equal(config.voiceUsable(), true);
  config.saveConfig({ sttBaseUrl: "http://example.com" }); // plain http only for localhost
  assert.equal(config.sttRoute(), null);
});

test("sign-in: start → pending polls → token saved, account cached", async () => {
  const { config, cloud } = load();
  let polls = 0;
  const log = [];
  const fetchImpl = fakeFetch({
    "POST /auth/start": { status: 200, body: { ok: true, request_id: "r1", poll_interval: 3, expires_in: 900 } },
    "POST /auth/poll": () => (++polls < 3 ? { status: 202, body: { status: "pending" } } : { status: 200, body: { status: "ok", token: "kc_new", user: { email: "a@b.co", plan: "free" } } }),
  }, log);
  const timers = manualTimers();
  let done = null;
  const r = await cloud.startSignIn("  A@B.co ", (res) => { done = res; }, { fetchImpl, ...timers });
  assert.equal(r.ok, true);
  assert.equal(log[0].body.email, "a@b.co");
  assert.ok(log[0].body.device_name);
  while (!done && timers.size) await timers.step();
  assert.deepEqual(done, { ok: true, email: "a@b.co", plan: "free" });
  assert.equal(config.getCloudToken(), "kc_new");
  assert.equal(config.loadConfig().cloudEmail, "a@b.co");
  assert.equal(cloud.isSigningIn(), false);
});

test("sign-in: bad email, rate limit, expiry and cancel", async () => {
  const { config, cloud } = load();
  assert.equal((await cloud.startSignIn("nope", () => {})).error, "email");
  const limited = fakeFetch({ "POST /auth/start": { status: 429, body: {} } });
  assert.equal((await cloud.startSignIn("a@b.co", () => {}, { fetchImpl: limited })).error, "rate_limit");

  const fetchImpl = fakeFetch({
    "POST /auth/start": { status: 200, body: { request_id: "r2" } },
    "POST /auth/poll": { status: 410, body: { status: "expired" } },
  });
  const timers = manualTimers();
  let done = null;
  await cloud.startSignIn("a@b.co", (res) => { done = res; }, { fetchImpl, ...timers });
  await timers.step();
  assert.equal(done.error, "expired");
  assert.equal(config.hasCloudToken(), false);

  const t2 = manualTimers();
  let fired = false;
  await cloud.startSignIn("a@b.co", () => { fired = true; }, { fetchImpl: fakeFetch({ "POST /auth/start": { status: 200, body: { request_id: "r3" } } }), ...t2 });
  assert.equal(cloud.cancelSignIn({ clearTimer: t2.clearTimer }), true);
  await t2.step();
  assert.equal(fired, false);
});

test("/v1/me refreshes the plan; 401 signs the device out", async () => {
  const { config, cloud } = load();
  config.setCloudToken("kc_abc");
  const me = { email: "a@b.co", plan: "plus", quota: { used: 3, limit: 600, resets_at: "2026-11-01T00:00:00Z" }, features: { web_search: true } };
  const ok = await cloud.fetchMe({ fetchImpl: fakeFetch({ "GET /v1/me": { status: 200, body: me } }) });
  assert.equal(ok.plan, "plus");
  assert.equal(config.loadConfig().cloudPlan, "plus");
  assert.equal(cloud.status().quota.used, 3);
  const out = await cloud.fetchMe({ fetchImpl: fakeFetch({ "GET /v1/me": { status: 401, body: {} } }) });
  assert.equal(out.error, "signed_out");
  assert.equal(config.hasCloudToken(), false);
  assert.equal(cloud.status().signedIn, false);
});

test("quota and plan errors from Kiiri Cloud get friendly codes", () => {
  const { classifyError } = fresh("../ai/claude");
  const sdkStyle = Object.assign(new Error("429"), { status: 429, error: { error: { type: "quota_exceeded" } } });
  assert.equal(classifyError(sdkStyle).code, "quota");
  const compat = Object.assign(new Error('provider 403: {"error":{"type":"plan_required","message":"x"}}'), { status: 403 });
  assert.equal(classifyError(compat).code, "plan");
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 429 })).code, "rate_limit");
});

test("before launch, cloud is coming soon: not the fresh default, saved choice falls back", () => {
  delete process.env.KIIRI_CLOUD;
  try {
    const { config } = load();
    assert.equal(config.loadConfig().provider, "anthropic");
    config.saveConfig({ provider: "cloud" });
    assert.equal(config.loadConfig().provider, "anthropic");
    config.setCloudToken("dev_x");
    assert.equal(config.cloudReady(), false);
    assert.equal(config.redactedConfig().cloudAvailable, false);
  } finally {
    process.env.KIIRI_CLOUD = "1";
  }
});
