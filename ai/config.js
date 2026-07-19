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

// Multi-provider: Claude (Anthropic), OpenAI, Gemini, and Ollama (local/offline).
// OpenAI/Gemini/Ollama all speak the OpenAI Chat Completions format.
const SUPPORTED_PROVIDERS = ["anthropic", "openai", "gemini", "ollama"];
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OLLAMA_MODEL = "llama3.2-vision";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

const DEFAULTS = Object.freeze({
  enabled: false,
  provider: "anthropic",
  model: DEFAULT_MODEL,            // anthropic model
  openaiModel: DEFAULT_OPENAI_MODEL,
  geminiModel: DEFAULT_GEMINI_MODEL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  responseLanguage: "tr",
  // When false, only an Option/Alt-held drop triggers analysis. When true,
  // every drop of the cat runs an analysis.
  alwaysAnalyzeOnDrop: false,
  // Run a quick classify pass so the task menu can recommend an action.
  autoDetect: true,
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
});

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
    responseLanguage: SUPPORTED_RESPONSE_LANGUAGES.includes(data.responseLanguage)
      ? data.responseLanguage
      : DEFAULTS.responseLanguage,
    alwaysAnalyzeOnDrop: !!data.alwaysAnalyzeOnDrop,
    autoDetect: data.autoDetect === undefined ? DEFAULTS.autoDetect : !!data.autoDetect,
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
  };
}

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
  const next = sanitizeConfig({ ...loadConfig(), ...(patch || {}) });
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
  };
}

// Spoken answers usable: toggle on + either an OpenAI key (cloud TTS) or the
// macOS `say` fallback.
function ttsUsable() {
  const c = loadConfig();
  return !!(c.ttsEnabled && (hasOpenAiKey() || process.platform === "darwin"));
}

// True only when voice is usable (toggle on + key present).
function voiceUsable() {
  const c = loadConfig();
  return !!(c.voiceEnabled && hasOpenAiKey());
}

// Push-to-talk usable: its own toggle + STT (OpenAI key) + a ready vision
// provider to answer the screen question.
function pttUsable() {
  const c = loadConfig();
  return !!(c.pttEnabled && hasOpenAiKey() && providerReady());
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
  resolveProvider,
  providerReady,
  SUPPORTED_PROVIDERS,
  SUPPORTED_PTT_HOTKEYS,
  SUPPORTED_TTS_VOICES,
  voiceUsable,
  pttUsable,
  ttsUsable,
  redactedConfig,
};
