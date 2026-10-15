"use strict";

// "Test connection" for the own-proxy provider: GET {base}/v1/models with the
// token. Returns { ok:true, models } or { ok:false, reason } where reason is one
// of: not_configured | auth | unreachable | timeout | status. No request body,
// so nothing sensitive is sent while testing.

const TIMEOUT_MS = 8000;

async function checkProxy(baseUrl, token, { fetchImpl = fetch } = {}) {
  if (!baseUrl || !token) return { ok: false, reason: "not_configured" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth" };
    if (res.status === 503) return { ok: false, reason: "not_configured" }; // proxy has no tokens set
    if (!res.ok) return { ok: false, reason: "status", status: res.status };
    const data = await res.json().catch(() => null);
    const models = Array.isArray(data && data.data)
      ? data.data.map((m) => m && m.id).filter((id) => typeof id === "string").slice(0, 50)
      : [];
    return { ok: true, models };
  } catch (err) {
    return { ok: false, reason: err && err.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { checkProxy };
