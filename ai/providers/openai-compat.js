"use strict";

// OpenAI-compatible chat-completions provider. One implementation serves OpenAI,
// Google Gemini (via its OpenAI-compatible endpoint), and Ollama (local /v1) —
// they all accept the same request shape. Vision uses image_url data URLs; tools
// use function-calling. Uses global fetch (Electron Node 18+). Throws on error
// with `.status` so the shared classifyError maps it.

function authHeaders(apiKey) {
  const h = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

function imageContent(imageBase64, mediaType) {
  return { type: "image_url", image_url: { url: `data:${mediaType || "image/png"};base64,${imageBase64}` } };
}

async function postChat(baseUrl, apiKey, body, signal) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`provider ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Vision Q&A. Returns { text, model }.
async function callVision({ baseUrl, apiKey, model, system, userText, imageBase64, mediaType, maxTokens, signal }) {
  const content = [{ type: "text", text: userText }];
  if (imageBase64) content.push(imageContent(imageBase64, mediaType));
  const data = await postChat(baseUrl, apiKey, {
    model,
    max_tokens: maxTokens || 1024,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content },
    ],
  }, signal);
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const text = (msg && typeof msg.content === "string" ? msg.content : "").trim();
  return { text, model: (data && data.model) || model };
}

// Tool-use (planning). Returns { text, toolUses, stopReason, model }.
async function callWithTools({ baseUrl, apiKey, model, system, userText, imageBase64, mediaType, maxTokens, tools, signal }) {
  const content = [{ type: "text", text: userText }];
  if (imageBase64) content.push(imageContent(imageBase64, mediaType));
  const body = {
    model,
    max_tokens: maxTokens || 4096,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content },
    ],
  };
  if (tools && tools.length) {
    // Anthropic tool schema -> OpenAI function schema.
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    body.tool_choice = "auto";
  }
  const data = await postChat(baseUrl, apiKey, body, signal);
  const choice = data && data.choices && data.choices[0];
  const msg = (choice && choice.message) || {};
  const text = (typeof msg.content === "string" ? msg.content : "") || "";
  const toolUses = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc) => {
        let input = {};
        try { input = JSON.parse(tc.function && tc.function.arguments || "{}"); } catch {}
        return { id: tc.id, name: tc.function && tc.function.name, input };
      })
    : [];
  return { text: text.trim(), toolUses, stopReason: choice && choice.finish_reason, model: (data && data.model) || model };
}

module.exports = { callVision, callWithTools };
