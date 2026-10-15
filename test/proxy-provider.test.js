"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron, fresh } = require("./helpers");

fakeElectron();
const config = fresh("../ai/config");
const { checkProxy } = require("../ai/providers/proxy-check");

test("proxy URL: https anywhere, http only on localhost, /v1 and trailing slash dropped", () => {
  const u = config.sanitizeProxyUrl;
  assert.equal(u("https://kiiri-proxy.me.workers.dev/"), "https://kiiri-proxy.me.workers.dev");
  assert.equal(u("https://kiiri-proxy.me.workers.dev/v1"), "https://kiiri-proxy.me.workers.dev");
  assert.equal(u("https://example.com/ai/v1/"), "https://example.com/ai");
  assert.equal(u("http://localhost:8787"), "http://localhost:8787");
  assert.equal(u("http://127.0.0.1:8787/v1"), "http://127.0.0.1:8787");
  assert.equal(u("http://my-proxy.example.com"), "", "plain http to a remote host would leak the token");
  assert.equal(u("https://user:pw@example.com"), "");
  assert.equal(u("not a url"), "");
  assert.equal(u(""), "");
});

test("proxy provider needs both an address and a token", () => {
  config.saveConfig({ provider: "proxy", proxyBaseUrl: "https://p.example.com/v1", proxyModel: "" });
  assert.equal(config.loadConfig().proxyModel, "kiiri-smart", "empty model falls back to the default alias");
  assert.equal(config.providerReady(), false);
  config.setProxyToken("tok-123");
  assert.equal(config.providerReady(), true);
  assert.deepEqual(config.resolveProvider(), { id: "proxy", model: "kiiri-smart", apiKey: "tok-123", baseUrl: "https://p.example.com/v1" });
  config.saveConfig({ proxyBaseUrl: "http://evil.example.com" });
  assert.equal(config.providerReady(), false);
  config.saveConfig({ proxyBaseUrl: "https://p.example.com" });
});

test("audio follows the proxy when it's the provider, else needs an OpenAI key", () => {
  config.saveConfig({ provider: "proxy", voiceEnabled: true, pttEnabled: true, ttsEnabled: true });
  assert.equal(config.audioVia(), "proxy");
  assert.deepEqual(config.audioRoute(), { via: "proxy", baseUrl: "https://p.example.com/v1", apiKey: "tok-123" });
  assert.equal(config.voiceUsable(), true);
  assert.equal(config.pttUsable(), true);

  config.saveConfig({ provider: "anthropic" });
  assert.equal(config.audioVia(), null, "proxy token alone doesn't route audio when another provider is active");
  assert.equal(config.voiceUsable(), false);
  config.setOpenAiKey("sk-openai");
  assert.deepEqual(config.audioRoute(), { via: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-openai" });

  config.clearProxyToken();
  config.saveConfig({ provider: "proxy" });
  assert.equal(config.audioVia(), "openai", "falls back to the OpenAI key if the proxy isn't ready");
  config.clearOpenAiKey();
});

test("redacted config never exposes the token", () => {
  config.setProxyToken("super-secret-token");
  const red = config.redactedConfig();
  assert.equal(red.hasProxyToken, true);
  assert.ok(!JSON.stringify(red).includes("super-secret-token"));
  assert.ok(red.supportedProviders.includes("proxy"));
});

test("checkProxy maps responses to reasons", async () => {
  const f = (status, body) => async (url, init) => {
    assert.equal(url, "https://p.example.com/v1/models");
    assert.equal(init.headers.Authorization, "Bearer t");
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  };
  assert.deepEqual(await checkProxy("https://p.example.com", "t", { fetchImpl: f(200, { data: [{ id: "kiiri-smart" }, { id: "kiiri-fast" }] }) }), { ok: true, models: ["kiiri-smart", "kiiri-fast"] });
  assert.deepEqual(await checkProxy("https://p.example.com", "t", { fetchImpl: f(401) }), { ok: false, reason: "auth" });
  assert.deepEqual(await checkProxy("https://p.example.com", "t", { fetchImpl: f(503) }), { ok: false, reason: "not_configured" });
  assert.deepEqual(await checkProxy("https://p.example.com", "t", { fetchImpl: f(500) }), { ok: false, reason: "status", status: 500 });
  assert.deepEqual(await checkProxy("https://p.example.com", "t", { fetchImpl: async () => { throw new TypeError("fetch failed"); } }), { ok: false, reason: "unreachable" });
  assert.deepEqual(await checkProxy("", "t"), { ok: false, reason: "not_configured" });
});
