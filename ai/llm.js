"use strict";

// Provider dispatcher. Callers (assistant, planner, skill author) use this single
// interface; it routes vision + tool-use calls to the active provider resolved
// from config: Anthropic (own SDK) or OpenAI/Gemini/Ollama (OpenAI-compatible).
// Keys/models/base URLs come from config — callers no longer pass them.

const config = require("./config");
const anthropic = require("./claude");
const openaiCompat = require("./providers/openai-compat");

function callVision(opts) {
  const p = config.resolveProvider();
  if (p.id === "anthropic") {
    return anthropic.callVision({ ...opts, apiKey: p.apiKey, model: p.model });
  }
  return openaiCompat.callVision({ ...opts, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model });
}

function callVisionStream(opts, onDelta) {
  const p = config.resolveProvider();
  if (p.id === "anthropic") {
    return anthropic.callVisionStream({ ...opts, apiKey: p.apiKey, model: p.model }, onDelta);
  }
  return openaiCompat.callVisionStream({ ...opts, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model }, onDelta);
}

function callChatStream(opts, onDelta) {
  const p = config.resolveProvider();
  if (p.id === "anthropic") {
    return anthropic.callChatStream({ ...opts, apiKey: p.apiKey, model: p.model }, onDelta);
  }
  return openaiCompat.callChatStream({ ...opts, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model }, onDelta);
}

function callWithTools(opts) {
  const p = config.resolveProvider();
  if (p.id === "anthropic") {
    return anthropic.callWithTools({ ...opts, apiKey: p.apiKey, model: p.model });
  }
  // Kiiri Cloud: tool-use goes through its Anthropic-native endpoint so plan
  // features (web search on Plus) work; the server picks the model per plan.
  if (p.id === "cloud") {
    return anthropic.callWithTools({ ...opts, baseURL: p.rootUrl, authToken: p.apiKey, model: "claude-opus-5" });
  }
  return openaiCompat.callWithTools({ ...opts, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model });
}

// Reuse Anthropic's error mapper — it also handles HTTP status codes (which the
// openai-compat provider throws with `.status`) and network/Ollama failures.
const classifyError = anthropic.classifyError;

module.exports = { callVision, callVisionStream, callChatStream, callWithTools, classifyError };
