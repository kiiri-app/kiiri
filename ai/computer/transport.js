"use strict";

// Where computer-use Messages requests go. One interface for both routes:
//
//   createMessage(params, { signal, taskId }) → Anthropic Message
//
//   anthropic — the official SDK with the user's own key.
//   cloud     — Kiiri Cloud: the same Anthropic-native body POSTed to
//               `${cloudBaseUrl}/v1/messages` with the device token. Every
//               request of one run carries the same X-Kiiri-Task id so the
//               server counts the whole run (plan + all steps) as ONE ask.
//
// Errors are thrown with `.status` and, where we know it, `.code`
// ("plan_required" = the free plan can't use computer use).

const REQUEST_TIMEOUT_MS = 120000;

function loadSDK() {
  const mod = require("@anthropic-ai/sdk");
  return mod && mod.default ? mod.default : mod;
}

function anthropicTransport({ apiKey, SDK } = {}) {
  const Client = SDK || loadSDK();
  const client = new Client({ apiKey, maxRetries: 1 });
  return {
    id: "anthropic",
    createMessage(params, { signal } = {}) {
      return client.messages.create(params, { signal, timeout: REQUEST_TIMEOUT_MS });
    },
  };
}

function httpError(status, body) {
  const type = body && body.error && body.error.type;
  const message = (body && body.error && body.error.message) || `HTTP ${status}`;
  const err = new Error(message);
  err.status = status;
  if (status === 403 && type === "plan_required") err.code = "plan_required";
  else if (type) err.code = type;
  return err;
}

function cloudTransport({ baseUrl, token, fetchFn } = {}) {
  const doFetch = fetchFn || globalThis.fetch;
  const root = String(baseUrl || "").replace(/\/+$/, "").replace(/\/v1$/, "");
  return {
    id: "cloud",
    async createMessage(params, { signal, taskId } = {}) {
      if (!root) throw Object.assign(new Error("Kiiri Cloud address missing"), { code: "no_key" });
      if (!token) throw Object.assign(new Error("Not signed in to Kiiri Cloud"), { code: "no_key", status: 401 });
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const res = await doFetch(`${root}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(taskId ? { "X-Kiiri-Task": String(taskId) } : {}),
        },
        body: JSON.stringify(params),
        signal: signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal || timeout,
      });
      let body = null;
      try { body = await res.json(); } catch {}
      if (!res.ok) throw httpError(res.status, body);
      if (!body || !Array.isArray(body.content)) throw Object.assign(new Error("Kiiri Cloud returned an unexpected reply"), { status: res.status });
      return body;
    },
  };
}

// provider: { id: "anthropic", apiKey } | { id: "cloud", baseUrl, token }
function createTransport(provider, deps = {}) {
  if (!provider) throw new Error("no provider");
  if (provider.id === "anthropic") return anthropicTransport({ apiKey: provider.apiKey, SDK: deps.SDK });
  if (provider.id === "cloud") return cloudTransport({ baseUrl: provider.baseUrl, token: provider.token, fetchFn: deps.fetchFn });
  throw Object.assign(new Error(`computer use is not available with ${provider.id}`), { code: "unsupported_provider" });
}

module.exports = { createTransport, anthropicTransport, cloudTransport, httpError };
