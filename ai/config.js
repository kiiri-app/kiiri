"use strict";

// AI assistant configuration + encrypted API key storage.
// Non-secret settings live in `ai-config.json`; the Anthropic API key is stored
// separately in `ai-key.bin`, encrypted with Electron safeStorage when available
// (Keychain on macOS, libsecret on Linux, DPAPI on Windows). The key never
// touches the renderer — only the main process reads it to build requests.

const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const DEFAULT_MODEL = "claude-opus-4-8";
const SUPPORTED_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"];
const SUPPORTED_RESPONSE_LANGUAGES = ["tr", "en", "ko", "ja"];
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const SUPPORTED_TRANSCRIBE_MODELS = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"];
// Push-to-talk hold combos (modifier pairs, evaluated on the global input hook).
const SUPPORTED_PTT_HOTKEYS = ["ctrl+alt", "ctrl+shift", "alt+shift", "cmd+alt"];
// OpenAI TTS voices for spoken answers (macOS `say` is the keyless fallback).
const SUPPORTED_TTS_VOICES = ["alloy", "nova", "shimmer", "echo", "onyx", "fable", "coral", "sage"];

// One-click profiles (OpenClicky "Local/Realtime/Quality" parity): each flips the
// whole provider+voice+TTS stack atomically so the user picks an intent, not six
// toggles. `patch` is merged into the config; the master `enabled` toggle and any
// stored keys are untouched (usable() gates still apply if a key is missing).
const PROFILES = [
  // Offline & private: local Ollama brain, keyless macOS `say` voice, no cloud STT.
  { id: "local",   patch: { provider: "ollama",    voiceEnabled: false, pttEnabled: false, ttsEnabled: true } },
  // Fast & cheap: small cloud model, no voice — snappy typed answers.
  { id: "fast",    patch: { provider: "anthropic", model: "claude-haiku-4-5", voiceEnabled: false, pttEnabled: false, ttsEnabled: false } },
  // Best quality: flagship model + full voice (needs an OpenAI key for STT/TTS).
  { id: "quality", patch: { provider: "anthropic", model: "claude-opus-4-8",  voiceEnabled: true,  pttEnabled: true,  ttsEnabled: true } },
];
const PROFILE_IDS = PROFILES.map((p) => p.id);

// Multi-provider: Claude (Anthropic), OpenAI, Gemini, Ollama (local/offline), and
// "proxy" — the user's own kiiri-proxy (or any OpenAI-compatible endpoint), where
// provider keys live on their server and the app only holds a proxy token.
// Everything except Anthropic speaks the OpenAI Chat Completions format.
const SUPPORTED_PROVIDERS = ["anthropic", "openai", "gemini", "ollama", "proxy"];
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OLLAMA_MODEL = "llama3.2-vision";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_PROXY_MODEL = "kiiri-smart";

const DEFAULTS = Object.freeze({
  enabled: false,
  provider: "anthropic",
  model: DEFAULT_MODEL,            // anthropic model
  openaiModel: DEFAULT_OPENAI_MODEL,
  geminiModel: DEFAULT_GEMINI_MODEL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  proxyBaseUrl: "",
  proxyModel: DEFAULT_PROXY_MODEL,
  responseLanguage: "tr",
  // When false, only an Option/Alt-held drop triggers analysis. When true,
  // every drop of the cat runs an analysis.
  alwaysAnalyzeOnDrop: false,
  // Run a quick classify pass so the task menu can recommend an action.
  autoDetect: true,
  // App-awareness: tell the model which app is frontmost (name only) so screen
  // answers are sharper. Zero extra permission; the screenshot already reveals
  // far more, so this is on by default. Toggle off to stop sending the app name.
  appContextEnabled: true,
  // Logical-pixel size of the region captured around the cat.
  captureWidth: 720,
  captureHeight: 520,
  customTasks: [],
  // Voice (OpenAI STT). Independent toggle; needs its own OpenAI key.
  voiceEnabled: false,
  transcribeModel: DEFAULT_TRANSCRIBE_MODEL,
  // Push-to-talk: hold a hotkey → ask about the whole screen (spoken). Needs
  // voice usable (STT). Hotkey is a modifier combo held down.
  pttEnabled: false,
  pttHotkey: "ctrl+alt",
  // Spoken answers (TTS): reads screen-question answers aloud. OpenAI TTS when
  // a key is present, otherwise the macOS `say` voice for the response language.
  ttsEnabled: false,
  ttsVoice: "alloy",
  // Last one-click profile the user applied (informational; "" = custom/none).
  activeProfile: "",
  // Writing style for written work (files + drop-task outputs): tag chips +
  // a free-text note. Separate from the per-character persona (how it talks).
  writingStyle: { tags: [], note: "" },
});

// Tag ids the settings UI offers; prompts.js maps each to an instruction line.
const WRITING_STYLE_TAGS = [
  "professional", "friendly", "warm", "direct", "concise", "detailed",
  "formal", "plain", "bullets", "activeVoice", "noEmDash", "noEmoji",
];

function sanitizeWritingStyle(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const tags = Array.isArray(data.tags)
    ? [...new Set(data.tags.filter((t) => WRITING_STYLE_TAGS.includes(t)))]
    : [];
  const note = String(data.note == null ? "" : data.note).trim().slice(0, 300);
  return { tags, note };
}

// Proxy base URL: https anywhere, plain http only for a local dev proxy (so a
// token never crosses the network unencrypted). Stored without a trailing "/" or
// "/v1" — resolveProvider adds "/v1". Anything else → "" (not configured).
function sanitizeProxyUrl(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  let u;
  try { u = new URL(raw); } catch { return ""; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return "";
  if (u.username || u.password) return "";
  const path = u.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${u.origin}${path}`.slice(0, 300);
}

let cached = null;

function configPath() {
  return path.join(app.getPath("userData"), "ai-config.json");
}

function secretPath(file) {
  return path.join(app.getPath("userData"), file);
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeCustomTask(task, index) {
  if (!task || typeof task !== "object") return null;
  const label = String(task.label || "").trim().slice(0, 40);
  const prompt = String(task.prompt || "").trim().slice(0, 2000);
  if (!label || !prompt) return null;
  const id = String(task.id || "").trim() || `custom-${Date.now()}-${index}`;
  const emoji = String(task.emoji || "✨").trim().slice(0, 4) || "✨";
  return { id, label, emoji, prompt, think: !!task.think, custom: true };
}

function sanitizeConfig(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const customTasks = Array.isArray(data.customTasks)
    ? data.customTasks.map(sanitizeCustomTask).filter(Boolean).slice(0, 20)
    : [];
  const cleanStr = (v, fallback, max) => {
    const s = String(v == null ? "" : v).trim().slice(0, max || 120);
    return s || fallback;
  };
  return {
    enabled: !!data.enabled,
    provider: SUPPORTED_PROVIDERS.includes(data.provider) ? data.provider : "anthropic",
    model: SUPPORTED_MODELS.includes(data.model) ? data.model : DEFAULT_MODEL,
    openaiModel: cleanStr(data.openaiModel, DEFAULT_OPENAI_MODEL),
    geminiModel: cleanStr(data.geminiModel, DEFAULT_GEMINI_MODEL),
    ollamaModel: cleanStr(data.ollamaModel, DEFAULT_OLLAMA_MODEL),
    ollamaBaseUrl: cleanStr(data.ollamaBaseUrl, DEFAULT_OLLAMA_BASE_URL, 200),
    proxyBaseUrl: sanitizeProxyUrl(data.proxyBaseUrl),
    proxyModel: cleanStr(data.proxyModel, DEFAULT_PROXY_MODEL),
    responseLanguage: SUPPORTED_RESPONSE_LANGUAGES.includes(data.responseLanguage)
      ? data.responseLanguage
      : DEFAULTS.responseLanguage,
    alwaysAnalyzeOnDrop: !!data.alwaysAnalyzeOnDrop,
    autoDetect: data.autoDetect === undefined ? DEFAULTS.autoDetect : !!data.autoDetect,
    appContextEnabled: data.appContextEnabled === undefined ? DEFAULTS.appContextEnabled : !!data.appContextEnabled,
    captureWidth: clampInt(data.captureWidth, 240, 2000, DEFAULTS.captureWidth),
    captureHeight: clampInt(data.captureHeight, 200, 2000, DEFAULTS.captureHeight),
    customTasks,
    voiceEnabled: !!data.voiceEnabled,
    transcribeModel: SUPPORTED_TRANSCRIBE_MODELS.includes(data.transcribeModel)
      ? data.transcribeModel
      : DEFAULT_TRANSCRIBE_MODEL,
    pttEnabled: !!data.pttEnabled,
    pttHotkey: SUPPORTED_PTT_HOTKEYS.includes(data.pttHotkey) ? data.pttHotkey : "ctrl+alt",
    ttsEnabled: !!data.ttsEnabled,
    ttsVoice: SUPPORTED_TTS_VOICES.includes(data.ttsVoice) ? data.ttsVoice : DEFAULTS.ttsVoice,
    activeProfile: PROFILE_IDS.includes(data.activeProfile) ? data.activeProfile : "",
    writingStyle: sanitizeWritingStyle(data.writingStyle),
  };
}

// Apply a one-click profile: merge its patch + record which profile is active.
// Editing any of the profiled fields afterwards clears activeProfile (see
// saveConfig) so the UI stops claiming a preset that no longer matches.
function applyProfile(id) {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) return { ok: false, reason: "unknown" };
  saveConfig({ ...profile.patch, activeProfile: id });
  return { ok: true, config: redactedConfig() };
}

// Fields a profile owns — touching any of them by hand means "custom" now.
const PROFILE_FIELDS = ["provider", "model", "voiceEnabled", "pttEnabled", "ttsEnabled"];

function loadConfig() {
  if (cached) return cached;
  try {
    const text = fs.readFileSync(configPath(), "utf8");
    cached = sanitizeConfig(JSON.parse(text));
  } catch {
    cached = sanitizeConfig({});
  }
  return cached;
}

function saveConfig(patch) {
  const p = patch || {};
  // Hand-editing a profiled field (unless we're the one applying a profile)
  // detaches from the preset so the settings UI shows "custom".
  if (p.activeProfile === undefined && PROFILE_FIELDS.some((f) => f in p)) {
    p.activeProfile = "";
  }
  const next = sanitizeConfig({ ...loadConfig(), ...p });
  cached = next;
  try {
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.warn("[Kiri][ai] failed to save config:", err && err.message);
  }
  return next;
}

// ---- Encrypted secrets (Anthropic + OpenAI keys) ----

const ANTHROPIC_KEY_FILE = "ai-key.bin";
const OPENAI_KEY_FILE = "openai-key.bin";
const GEMINI_KEY_FILE = "gemini-key.bin";
const PROXY_TOKEN_FILE = "proxy-token.bin";

function writeSecret(file, rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return { ok: false, reason: "empty" };
  try {
    let bytes;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      bytes = safeStorage.encryptString(key);
    } else {
      // Fallback: obfuscated (not strong encryption). Prefixed so we know.
      bytes = Buffer.concat([Buffer.from("PLAIN:"), Buffer.from(key, "utf8")]);
    }
    fs.writeFileSync(secretPath(file), bytes);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err && err.message };
  }
}

function readSecret(file) {
  try {
    const bytes = fs.readFileSync(secretPath(file));
    if (bytes.slice(0, 6).toString() === "PLAIN:") {
      return bytes.slice(6).toString("utf8");
    }
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(bytes);
    }
    return null;
  } catch {
    return null;
  }
}

function hasSecret(file) {
  try {
    return fs.statSync(secretPath(file)).size > 0;
  } catch {
    return false;
  }
}

function clearSecret(file) {
  try {
    fs.unlinkSync(secretPath(file));
  } catch {}
  return { ok: true };
}

// Anthropic (vision + planning)
const setApiKey = (k) => writeSecret(ANTHROPIC_KEY_FILE, k);
const getApiKey = () => readSecret(ANTHROPIC_KEY_FILE);
const hasApiKey = () => hasSecret(ANTHROPIC_KEY_FILE);
const clearApiKey = () => clearSecret(ANTHROPIC_KEY_FILE);

// OpenAI (voice STT + OpenAI provider — same key serves both)
const setOpenAiKey = (k) => writeSecret(OPENAI_KEY_FILE, k);
const getOpenAiKey = () => readSecret(OPENAI_KEY_FILE);
const hasOpenAiKey = () => hasSecret(OPENAI_KEY_FILE);
const clearOpenAiKey = () => clearSecret(OPENAI_KEY_FILE);

// Gemini (Google) provider
const setGeminiKey = (k) => writeSecret(GEMINI_KEY_FILE, k);
const getGeminiKey = () => readSecret(GEMINI_KEY_FILE);
const hasGeminiKey = () => hasSecret(GEMINI_KEY_FILE);
const clearGeminiKey = () => clearSecret(GEMINI_KEY_FILE);

// Own proxy (kiiri-proxy / any OpenAI-compatible endpoint): bearer token
const setProxyToken = (k) => writeSecret(PROXY_TOKEN_FILE, k);
const getProxyToken = () => readSecret(PROXY_TOKEN_FILE);
const hasProxyToken = () => hasSecret(PROXY_TOKEN_FILE);
const clearProxyToken = () => clearSecret(PROXY_TOKEN_FILE);

function proxyReady() {
  return !!(loadConfig().proxyBaseUrl && hasProxyToken());
}

// Resolves the active provider into { id, model, apiKey, baseUrl }. OpenAI/Gemini/
// Ollama use the OpenAI-compatible chat-completions format (baseUrl set); Anthropic
// uses its own SDK (baseUrl null).
function resolveProvider() {
  const c = loadConfig();
  switch (c.provider) {
    case "openai":
      return { id: "openai", model: c.openaiModel, apiKey: getOpenAiKey(), baseUrl: "https://api.openai.com/v1" };
    case "gemini":
      return { id: "gemini", model: c.geminiModel, apiKey: getGeminiKey(), baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" };
    case "ollama":
      return { id: "ollama", model: c.ollamaModel, apiKey: null, baseUrl: `${String(c.ollamaBaseUrl || "http://localhost:11434").replace(/\/+$/, "")}/v1` };
    case "proxy":
      return { id: "proxy", model: c.proxyModel, apiKey: getProxyToken(), baseUrl: `${c.proxyBaseUrl}/v1` };
    case "anthropic":
    default:
      return { id: "anthropic", model: c.model, apiKey: getApiKey(), baseUrl: null };
  }
}

// Is the active provider usable (key present, or local Ollama)?
function providerReady() {
  const c = loadConfig();
  if (c.provider === "openai") return hasOpenAiKey();
  if (c.provider === "gemini") return hasGeminiKey();
  if (c.provider === "ollama") return true; // local; reachability checked at call time
  if (c.provider === "proxy") return proxyReady();
  return hasApiKey();
}

// Renderer-safe view of config (no secret key material).
function redactedConfig() {
  const c = loadConfig();
  return {
    ...c,
    hasApiKey: hasApiKey(),
    hasOpenAiKey: hasOpenAiKey(),
    hasGeminiKey: hasGeminiKey(),
    hasProxyToken: hasProxyToken(),
    audioVia: audioVia(),
    providerReady: providerReady(),
    encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable()),
    supportedModels: SUPPORTED_MODELS,
    supportedProviders: SUPPORTED_PROVIDERS,
    supportedResponseLanguages: SUPPORTED_RESPONSE_LANGUAGES,
    supportedTranscribeModels: SUPPORTED_TRANSCRIBE_MODELS,
    supportedPttHotkeys: SUPPORTED_PTT_HOTKEYS,
    pttUsable: pttUsable(),
    supportedTtsVoices: SUPPORTED_TTS_VOICES,
    ttsUsable: ttsUsable(),
    profiles: PROFILE_IDS,
    activeProfile: c.activeProfile || "",
    supportedWritingStyleTags: WRITING_STYLE_TAGS,
  };
}

// Where speech (TTS + STT) goes. With the own-proxy provider selected, audio
// goes through the proxy too (that's the point: no keys on this machine);
// otherwise it needs the user's OpenAI key. null = no cloud audio available.
function audioVia() {
  const c = loadConfig();
  if (c.provider === "proxy" && proxyReady()) return "proxy";
  if (hasOpenAiKey()) return "openai";
  return null;
}

// { baseUrl, apiKey, via } for the OpenAI-style /audio/* endpoints, or null.
function audioRoute() {
  const via = audioVia();
  if (via === "proxy") return { via, baseUrl: `${loadConfig().proxyBaseUrl}/v1`, apiKey: getProxyToken() };
  if (via === "openai") return { via, baseUrl: "https://api.openai.com/v1", apiKey: getOpenAiKey() };
  return null;
}

// Spoken answers usable: toggle on + either cloud TTS (OpenAI key or proxy) or
// the macOS `say` fallback.
function ttsUsable() {
  const c = loadConfig();
  return !!(c.ttsEnabled && (audioVia() || process.platform === "darwin"));
}

// True only when voice is usable (toggle on + a speech-to-text route).
function voiceUsable() {
  const c = loadConfig();
  return !!(c.voiceEnabled && audioVia());
}

// Push-to-talk usable: its own toggle + STT + a ready vision provider to answer
// the screen question.
function pttUsable() {
  const c = loadConfig();
  return !!(c.pttEnabled && audioVia() && providerReady());
}

module.exports = {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  SUPPORTED_RESPONSE_LANGUAGES,
  SUPPORTED_TRANSCRIBE_MODELS,
  loadConfig,
  saveConfig,
  sanitizeCustomTask,
  setApiKey,
  getApiKey,
  hasApiKey,
  clearApiKey,
  setOpenAiKey,
  getOpenAiKey,
  hasOpenAiKey,
  clearOpenAiKey,
  setGeminiKey,
  getGeminiKey,
  hasGeminiKey,
  clearGeminiKey,
  setProxyToken,
  getProxyToken,
  hasProxyToken,
  clearProxyToken,
  sanitizeProxyUrl,
  resolveProvider,
  providerReady,
  audioVia,
  audioRoute,
  SUPPORTED_PROVIDERS,
  SUPPORTED_PTT_HOTKEYS,
  SUPPORTED_TTS_VOICES,
  PROFILE_IDS,
  WRITING_STYLE_TAGS,
  applyProfile,
  voiceUsable,
  pttUsable,
  ttsUsable,
  redactedConfig,
};
