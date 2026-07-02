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

function classifyError(err) {
  const status = err && (err.status || err.statusCode);
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

// Tool-use (planning) call. Returns the assistant's text plus any tool calls it
// wants to make. We do NOT auto-execute — the caller previews + gets approval,
// then runs the executors. Optional image lets a command also see the screen.
async function callWithTools({ apiKey, model, system, userText, tools, imageBase64, mediaType, maxTokens, think, signal }) {
  const SDK = loadSDK();
  const client = new SDK({ apiKey, maxRetries: 1 });
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } });
  }
  content.push({ type: "text", text: userText });

  const params = {
    model,
    max_tokens: maxTokens || 4096,
    system,
    tools: tools || [],
    messages: [{ role: "user", content }],
  };
  if (think && supportsAdaptiveThinking(model)) {
    params.thinking = { type: "adaptive" };
  }
  const message = await client.messages.create(params, { signal, timeout: 120000 });
  const blocks = message.content || [];
  const text = blocks.filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
  const toolUses = blocks
    .filter((b) => b && b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));
  return { text, toolUses, stopReason: message.stop_reason, model: message.model };
}

module.exports = { callVision, callVisionStream, callWithTools, classifyError, supportsAdaptiveThinking };
