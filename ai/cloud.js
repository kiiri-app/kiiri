"use strict";

// Kiiri Cloud account: email magic-link sign-in and the account/quota view.
// Flow (no custom URL scheme needed): POST /auth/start {email} → the user clicks
// the link in the email → we poll POST /auth/poll until it returns a device
// token, which is stored encrypted (config.setCloudToken). Main process only.

const os = require("os");
const config = require("./config");

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

let pending = null; // { requestId, timer, cancelled }
let me = null;      // last /v1/me response

function baseUrl() {
  return config.loadConfig().cloudBaseUrl || config.DEFAULT_CLOUD_BASE_URL;
}

async function postJson(path, body, { token, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data: data || {} };
}

function deviceName() {
  try { return String(os.hostname() || "").replace(/\.local$/, "").slice(0, 60) || "Kiiri"; } catch { return "Kiiri"; }
}

// Starts sign-in; onDone({ ok, email, plan } | { ok:false, error, message }) fires
// once, when the link is clicked, the request expires, or it is cancelled.
async function startSignIn(email, onDone, { fetchImpl = fetch, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  cancelSignIn({ clearTimer });
  const addr = String(email || "").trim().toLowerCase();
  if (!EMAIL.test(addr)) return { ok: false, error: "email", message: "Geçerli bir e-posta adresi yaz." };
  let r;
  try {
    r = await postJson("/auth/start", { email: addr, device_name: deviceName() }, { fetchImpl });
  } catch {
    return { ok: false, error: "network", message: "Kiiri Cloud'a bağlanılamadı. İnternet bağlantını kontrol et." };
  }
  if (r.status === 429) return { ok: false, error: "rate_limit", message: "Çok fazla deneme oldu. Birkaç dakika sonra tekrar dene." };
  if (r.status !== 200 || !r.data.request_id) {
    return { ok: false, error: "server", message: (r.data.error && r.data.error.message) || `Kiiri Cloud hata verdi (${r.status}).` };
  }

  const job = { requestId: r.data.request_id, timer: null, cancelled: false };
  pending = job;
  const interval = Math.max(2, Math.min(10, Number(r.data.poll_interval) || 3)) * 1000;
  const deadline = Date.now() + Math.max(60, Number(r.data.expires_in) || 900) * 1000;

  const finish = (result) => {
    if (pending === job) pending = null;
    if (!job.cancelled) onDone && onDone(result);
  };
  const tick = async () => {
    if (job.cancelled) return;
    if (Date.now() > deadline) return finish({ ok: false, error: "expired", message: "Bağlantının süresi doldu. Tekrar dene." });
    let p;
    try {
      p = await postJson("/auth/poll", { request_id: job.requestId }, { fetchImpl });
    } catch {
      p = { status: 0, data: {} }; // transient: keep polling until the deadline
    }
    if (job.cancelled) return;
    if (p.status === 200 && p.data.token) {
      config.setCloudToken(p.data.token);
      const user = p.data.user || {};
      config.saveConfig({ cloudEmail: user.email || addr, cloudPlan: user.plan || "free" });
      return finish({ ok: true, email: user.email || addr, plan: user.plan || "free" });
    }
    if (p.status === 410) return finish({ ok: false, error: "expired", message: "Bağlantının süresi doldu. Tekrar dene." });
    job.timer = setTimer(tick, interval);
  };
  job.timer = setTimer(tick, interval);
  return { ok: true, email: addr };
}

function cancelSignIn({ clearTimer = clearTimeout } = {}) {
  if (!pending) return false;
  pending.cancelled = true;
  if (pending.timer) clearTimer(pending.timer);
  pending = null;
  return true;
}

function isSigningIn() {
  return !!pending;
}

// Account + quota. Refreshes the cached plan so feature checks
// (config.webSearchUsable) follow upgrades/downgrades.
async function fetchMe({ fetchImpl = fetch } = {}) {
  const token = config.getCloudToken();
  if (!token) { me = null; return { ok: false, error: "signed_out" }; }
  let res;
  try {
    res = await fetchImpl(`${baseUrl()}/v1/me`, { headers: { authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, error: "network", cached: me };
  }
  if (res.status === 401) {
    // Revoked elsewhere (or signed out on the server): forget the token.
    config.clearCloudToken();
    config.saveConfig({ cloudEmail: "", cloudPlan: "" });
    me = null;
    return { ok: false, error: "signed_out" };
  }
  if (!res.ok) return { ok: false, error: "server", cached: me };
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: "server", cached: me };
  me = data;
  const c = config.loadConfig();
  if (data.plan && (data.plan !== c.cloudPlan || data.email !== c.cloudEmail)) {
    config.saveConfig({ cloudPlan: data.plan, cloudEmail: data.email || c.cloudEmail });
  }
  return { ok: true, ...data };
}

async function signOut({ fetchImpl = fetch } = {}) {
  cancelSignIn();
  const token = config.getCloudToken();
  if (token) {
    try { await postJson("/auth/logout", {}, { token, fetchImpl }); } catch {}
  }
  config.clearCloudToken();
  config.saveConfig({ cloudEmail: "", cloudPlan: "" });
  me = null;
  return { ok: true };
}

// Renderer-safe status (never the token).
function status() {
  const c = config.loadConfig();
  return {
    signedIn: config.hasCloudToken(),
    signingIn: isSigningIn(),
    email: c.cloudEmail || (me && me.email) || "",
    plan: (me && me.plan) || c.cloudPlan || "",
    quota: (me && me.quota) || null,
    features: (me && me.features) || null,
  };
}

module.exports = { startSignIn, cancelSignIn, isSigningIn, fetchMe, signOut, status, deviceName };
