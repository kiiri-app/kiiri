"use strict";

// Thin wrapper around the official Anthropic SDK for vision calls. Runs only in
// the main process so the API key never reaches the renderer. Defaults to
// claude-opus-4-8; adaptive thinking is used for reasoning-heavy tasks and
// skipped for models that don't support it (Haiku).

let Anthropic = null;
function loadSDK() {
  if (Anthropic) return Anthropic;
  // Lazy require so the app still boots (with AI disabled) if the dependency
  // hasn't been installed yet. Handle both `module.exports = Anthropic` and
  // `{ default: Anthropic }` shapes across SDK versions.
  const mod = require("@anthropic-ai/sdk");
  Anthropic = mod && mod.default ? mod.default : mod;
  return Anthropic;
}

function supportsAdaptiveThinking(model) {
  // Opus 4.x, Sonnet 4.6 and Fable 5 support adaptive thinking; Haiku does not.
  return !/haiku/i.test(model || "");
}

// Kiiri Cloud error type: from the Anthropic SDK's parsed body, or from the
// openai-compat provider's "provider <status>: <body>" message.
function cloudErrorType(err) {
  const t = err && err.error && err.error.error && err.error.error.type;
  if (t) return t;
  const m = /"type"\s*:\s*"(quota_exceeded|plan_required)"/.exec((err && err.message) || "");
  return m ? m[1] : "";
}

function classifyError(err) {
  const status = err && (err.status || err.statusCode);
  const cloudType = cloudErrorType(err);
  if (cloudType === "quota_exceeded") return { code: "quota", message: "Bu ayki ücretsiz soruların bitti. Ayın başında yenilenir ya da Kiiri Plus'a geçebilirsin." };
  if (cloudType === "plan_required") return { code: "plan", message: "Bu özellik Kiiri Plus'ta var." };
  if (status === 401) return { code: "auth", message: "API anahtarı geçersiz veya eksik." };
  if (status === 403) return { code: "permission", message: "API anahtarının bu modele erişimi yok." };
  if (status === 404) return { code: "model", message: "Model bulunamadı. Modeli ayarlardan değiştir." };
  if (status === 429) return { code: "rate_limit", message: "Çok fazla istek — biraz sonra dene." };
  if (status === 413) return { code: "too_large", message: "Görüntü çok büyük." };
  if (status >= 500) return { code: "server", message: "Anthropic servisi şu an yanıt vermiyor." };
  const msg = (err && err.message) || "Bilinmeyen hata";
  if (/abort/i.test(msg)) return { code: "aborted", message: "İptal edildi." };
  if (/Cannot find module|MODULE_NOT_FOUND/i.test(msg)) {
    return { code: "missing_sdk", message: "@anthropic-ai/sdk kurulu değil — `npm install` çalıştır." };
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|network|socket hang up/i.test(msg)) {
    return { code: "network", message: "Sağlayıcıya bağlanılamadı (Ollama çalışıyor mu? Model indirildi mi?)." };
  }
  return { code: "unknown", message: msg };
}

// Sends one image + one text instruction; returns the concatenated text.
async function callVision({ apiKey, model, system, userText, imageBase64, mediaType, maxTokens, think, signal }) {
  const SDK = loadSDK();
  const client = new SDK({ apiKey, maxRetries: 1 });
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } });
  }
  content.push({ type: "text", text: userText });
  const params = {
    model,
    max_tokens: maxTokens || 1024,
    system,
    messages: [{ role: "user", content }],
  };
  if (think && supportsAdaptiveThinking(model)) {
    params.thinking = { type: "adaptive" };
  }
  const message = await client.messages.create(params, { signal, timeout: 90000 });
  const text = (message.content || [])
    .filter((b) => b && b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, model: message.model, usage: message.usage };
}

// Streaming vision call: same as callVision but emits text deltas via onDelta as
// they arrive, and resolves with the full concatenated text. Thinking deltas are
// not surfaced (only final text). Falls back cleanly if the stream errors.
async function callVisionStream({ apiKey, model, system, userText, imageBase64, mediaType, maxTokens, think, signal }, onDelta) {
  const SDK = loadSDK();
  const client = new SDK({ apiKey, maxRetries: 1 });
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } });
  }
  content.push({ type: "text", text: userText });
  const params = {
    model,
    max_tokens: maxTokens || 1024,
    system,
    messages: [{ role: "user", content }],
  };
  if (think && supportsAdaptiveThinking(model)) {
    params.thinking = { type: "adaptive" };
  }
  const stream = client.messages.stream(params, { signal });
  if (typeof onDelta === "function") {
    stream.on("text", (delta) => {
      if (delta) onDelta(delta);
    });
  }
  const message = await stream.finalMessage();
  const text = (message.content || [])
    .filter((b) => b && b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, model: message.model, usage: message.usage };
}

// Streaming multi-turn chat: takes a full `messages` history ([{role, text}])
// instead of a single user turn, so the conversation window can carry context.
// Emits text deltas via onDelta and resolves with the full text.
async function callChatStream({ apiKey, model, system, messages, maxTokens, think, signal }, onDelta) {
  const SDK = loadSDK();
  const client = new SDK({ apiKey, maxRetries: 1 });
  const apiMessages = (messages || [])
    .filter((m) => m && m.text != null && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: [{ type: "text", text: String(m.text) }] }));
  const params = {
    model,
    max_tokens: maxTokens || 1024,
    system,
    messages: apiMessages,
  };
  if (think && supportsAdaptiveThinking(model)) {
    params.thinking = { type: "adaptive" };
  }
  const stream = client.messages.stream(params, { signal });
  if (typeof onDelta === "function") {
    stream.on("text", (delta) => { if (delta) onDelta(delta); });
  }
  const message = await stream.finalMessage();
  const text = (message.content || [])
    .filter((b) => b && b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, model: message.model, usage: message.usage };
}

// Tool-use (planning) call. Returns the assistant's text plus any tool calls it
// wants to make. We do NOT auto-execute — the caller previews + gets approval,
// then runs the executors. Optional image lets a command also see the screen.
// Anthropic's server-side web search. The dynamic-filtering variant needs Opus
// 4.6+ / Sonnet 4.6+; anything else (Haiku, Fable, older) gets the basic one.
function webSearchTool(model) {
  const dynamic = /claude-(opus-(5|4-8|4-7|4-6)|sonnet-(5|4-6))/.test(String(model || ""));
  return { type: dynamic ? "web_search_20260209" : "web_search_20250305", name: "web_search", max_uses: 5 };
}

// Pages the model actually got back from web_search, deduped, in order.
function collectSources(blocks) {
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    if (!b || b.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue; // error = object
    for (const r of b.content) {
      if (!r || r.type !== "web_search_result" || !r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ title: String(r.title || r.url), url: String(r.url) });
    }
  }
  return out.slice(0, 12);
}

const MAX_CONTINUATIONS = 4;

// Kiiri Cloud speaks the Anthropic Messages API too (POST /v1/messages), with the
// device token as a bearer instead of an API key. taskId makes a multi-call turn
// (pause_turn resumes) count as ONE ask on the server.
function clientFor(SDK, { apiKey, baseURL, authToken, taskId }) {
  if (!baseURL) return new SDK({ apiKey, maxRetries: 1 });
  return new SDK({
    apiKey: null, authToken, baseURL, maxRetries: 1,
    defaultHeaders: taskId ? { "X-Kiiri-Task": String(taskId).slice(0, 64) } : undefined,
  });
}

async function callWithTools({ apiKey, baseURL, authToken, taskId, model, system, userText, tools, imageBase64, mediaType, maxTokens, think, webSearch, signal }) {
  const SDK = loadSDK();
  const client = clientFor(SDK, { apiKey, baseURL, authToken, taskId });
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } });
  }
  content.push({ type: "text", text: userText });

  const messages = [{ role: "user", content }];
  const params = {
    model,
    max_tokens: maxTokens || 4096,
    system,
    tools: [...(tools || []), ...(webSearch ? [webSearchTool(model)] : [])],
  };
  if (think && supportsAdaptiveThinking(model)) {
    params.thinking = { type: "adaptive" };
  }
  // A long server-side search loop can stop with pause_turn: send the paused
  // turn back as-is (no extra "continue" message) and the server resumes.
  const blocks = [];
  let message;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    message = await client.messages.create({ ...params, messages }, { signal, timeout: webSearch ? 240000 : 120000 });
    blocks.push(...(message.content || []));
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  const text = blocks.filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
  const toolUses = blocks
    .filter((b) => b && b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));
  return { text, toolUses, sources: collectSources(blocks), stopReason: message.stop_reason, model: message.model };
}

module.exports = { callVision, callVisionStream, callChatStream, callWithTools, classifyError, supportsAdaptiveThinking, webSearchTool, collectSources, clientFor };
