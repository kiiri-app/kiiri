"use strict";

const PROVIDER_LABELS = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI (GPT-4o)",
  gemini: "Google Gemini",
  ollama: "Ollama (yerel / offline)",
};
const MODEL_FIELD = {
  anthropic: "model",
  openai: "openaiModel",
  gemini: "geminiModel",
  ollama: "ollamaModel",
};
const MODEL_SUGGESTIONS = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
  ollama: ["llama3.2-vision", "llava", "qwen2.5vl", "minicpm-v"],
};
const PROVIDER_HINT = {
  anthropic: "Anahtar: yukarıdaki 'Anthropic API anahtarı' bölümü.",
  openai: "Anahtar: aşağıdaki 'Ses (OpenAI)' bölümündeki anahtar (paylaşılır).",
  gemini: "Anahtar: buradaki Gemini anahtarı.",
  ollama: "Yerel/offline — anahtar gerekmez. Ollama çalışıyor olmalı ve bir vision modeli indirilmeli (ör. `ollama pull llama3.2-vision`).",
};
const LANG_LABELS = { tr: "Türkçe", en: "English", ko: "한국어", ja: "日本語" };
const TRANSCRIBE_LABELS = {
  "gpt-4o-mini-transcribe": "gpt-4o-mini-transcribe (hızlı/ucuz)",
  "gpt-4o-transcribe": "gpt-4o-transcribe (daha iyi)",
  "whisper-1": "whisper-1",
};

const el = (id) => document.getElementById(id);
const enabled = el("enabled");
const apiKey = el("api-key");
const saveKey = el("save-key");
const clearKey = el("clear-key");
const keyStatus = el("key-status");
const encWarning = el("enc-warning");
const providerSel = el("provider");
const providerModel = el("provider-model");
const modelSuggestions = el("model-suggestions");
const ollamaBaseRow = el("ollama-base-row");
const ollamaBase = el("ollama-base");
const geminiKeyRow = el("gemini-key-row");
const geminiKeyEl = el("gemini-key");
const saveGeminiKey = el("save-gemini-key");
const clearGeminiKey = el("clear-gemini-key");
const geminiKeyStatus = el("gemini-key-status");
const providerHint = el("provider-hint");
const langSel = el("response-language");
const autoDetect = el("auto-detect");
const alwaysDrop = el("always-drop");
const customList = el("custom-list");
const customForm = el("custom-form");
const vEnabled = el("voice-enabled");
const openaiKeyEl = el("openai-key");
const saveOpenaiKey = el("save-openai-key");
const clearOpenaiKey = el("clear-openai-key");
const openaiKeyStatus = el("openai-key-status");
const transcribeModelEl = el("transcribe-model");

let config = null;

function fillSelect(select, values, labels, current) {
  select.innerHTML = "";
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = (labels && labels[v]) || v;
    if (v === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderKeyStatus() {
  if (config.hasApiKey) {
    keyStatus.textContent = "Anahtar kayıtlı ✓";
    keyStatus.classList.add("ok");
    clearKey.hidden = false;
  } else {
    keyStatus.textContent = "Anahtar yok";
    keyStatus.classList.remove("ok");
    clearKey.hidden = true;
  }
  encWarning.hidden = !!config.encryptionAvailable;
}

function renderCustomTasks() {
  customList.innerHTML = "";
  const tasks = config.customTasks || [];
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "custom-empty";
    empty.textContent = "Henüz özel görev yok.";
    customList.appendChild(empty);
    return;
  }
  for (const t of tasks) {
    const item = document.createElement("div");
    item.className = "custom-item";
    item.innerHTML = `
      <span class="ci-emoji"></span>
      <span class="ci-label"></span>
      <span class="ci-prompt"></span>
      <button type="button" class="ci-del" aria-label="Sil">×</button>`;
    item.querySelector(".ci-emoji").textContent = t.emoji || "✨";
    item.querySelector(".ci-label").textContent = t.label;
    item.querySelector(".ci-prompt").textContent = t.prompt;
    item.querySelector(".ci-del").addEventListener("click", async () => {
      config = await window.aiAPI.customTaskDelete(t.id);
      renderCustomTasks();
    });
    customList.appendChild(item);
  }
}

function renderOpenAiStatus() {
  if (config.hasOpenAiKey) {
    openaiKeyStatus.textContent = "Anahtar kayıtlı ✓";
    openaiKeyStatus.classList.add("ok");
    clearOpenaiKey.hidden = false;
  } else {
    openaiKeyStatus.textContent = "Anahtar yok";
    openaiKeyStatus.classList.remove("ok");
    clearOpenaiKey.hidden = true;
  }
}

function renderGeminiStatus() {
  if (config.hasGeminiKey) {
    geminiKeyStatus.textContent = "Anahtar kayıtlı ✓";
    geminiKeyStatus.classList.add("ok");
    clearGeminiKey.hidden = false;
  } else {
    geminiKeyStatus.textContent = "Anahtar yok";
    geminiKeyStatus.classList.remove("ok");
    clearGeminiKey.hidden = true;
  }
}

function applyProviderUI() {
  const p = config.provider || "anthropic";
  providerModel.value = config[MODEL_FIELD[p]] || "";
  modelSuggestions.innerHTML = (MODEL_SUGGESTIONS[p] || [])
    .map((m) => `<option value="${m}"></option>`)
    .join("");
  ollamaBaseRow.hidden = p !== "ollama";
  ollamaBase.value = config.ollamaBaseUrl || "";
  geminiKeyRow.hidden = p !== "gemini";
  providerHint.textContent = PROVIDER_HINT[p] || "";
  renderGeminiStatus();
}

function render() {
  enabled.checked = config.enabled;
  autoDetect.checked = config.autoDetect;
  alwaysDrop.checked = config.alwaysAnalyzeOnDrop;
  fillSelect(providerSel, config.supportedProviders || [], PROVIDER_LABELS, config.provider);
  fillSelect(langSel, config.supportedResponseLanguages || [], LANG_LABELS, config.responseLanguage);
  applyProviderUI();
  vEnabled.checked = config.voiceEnabled;
  fillSelect(transcribeModelEl, config.supportedTranscribeModels || [], TRANSCRIBE_LABELS, config.transcribeModel);
  renderKeyStatus();
  renderOpenAiStatus();
  renderCustomTasks();
}

async function patch(p) {
  config = await window.aiAPI.configSet(p);
}

enabled.addEventListener("change", () => patch({ enabled: enabled.checked }));
autoDetect.addEventListener("change", () => patch({ autoDetect: autoDetect.checked }));
alwaysDrop.addEventListener("change", () => patch({ alwaysAnalyzeOnDrop: alwaysDrop.checked }));
providerSel.addEventListener("change", async () => {
  await patch({ provider: providerSel.value });
  applyProviderUI();
});
providerModel.addEventListener("change", () => {
  const field = MODEL_FIELD[config.provider] || "model";
  patch({ [field]: providerModel.value.trim() });
});
ollamaBase.addEventListener("change", () => patch({ ollamaBaseUrl: ollamaBase.value.trim() }));
saveGeminiKey.addEventListener("click", async () => {
  const value = geminiKeyEl.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setGeminiKey(value);
  if (res && res.ok) {
    geminiKeyEl.value = "";
    config = await window.aiAPI.configGet();
    renderGeminiStatus();
  } else {
    geminiKeyStatus.textContent = "Kaydedilemedi: " + ((res && res.reason) || "hata");
  }
});
clearGeminiKey.addEventListener("click", async () => {
  await window.aiAPI.clearGeminiKey();
  config = await window.aiAPI.configGet();
  renderGeminiStatus();
});
langSel.addEventListener("change", () => patch({ responseLanguage: langSel.value }));

saveKey.addEventListener("click", async () => {
  const value = apiKey.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setKey(value);
  if (res && res.ok) {
    apiKey.value = "";
    config = await window.aiAPI.configGet();
    renderKeyStatus();
  } else {
    keyStatus.textContent = "Kaydedilemedi: " + ((res && res.reason) || "hata");
  }
});

clearKey.addEventListener("click", async () => {
  await window.aiAPI.clearKey();
  config = await window.aiAPI.configGet();
  renderKeyStatus();
});

vEnabled.addEventListener("change", () => patch({ voiceEnabled: vEnabled.checked }));
transcribeModelEl.addEventListener("change", () => patch({ transcribeModel: transcribeModelEl.value }));

saveOpenaiKey.addEventListener("click", async () => {
  const value = openaiKeyEl.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setOpenAiKey(value);
  if (res && res.ok) {
    openaiKeyEl.value = "";
    config = await window.aiAPI.configGet();
    renderOpenAiStatus();
  } else {
    openaiKeyStatus.textContent = "Kaydedilemedi: " + ((res && res.reason) || "hata");
  }
});

clearOpenaiKey.addEventListener("click", async () => {
  await window.aiAPI.clearOpenAiKey();
  config = await window.aiAPI.configGet();
  renderOpenAiStatus();
});

customForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = {
    emoji: el("ct-emoji").value.trim() || "✨",
    label: el("ct-label").value.trim(),
    prompt: el("ct-prompt").value.trim(),
    think: el("ct-think").checked,
  };
  if (!task.label || !task.prompt) return;
  config = await window.aiAPI.customTaskSave(task);
  el("ct-emoji").value = "";
  el("ct-label").value = "";
  el("ct-prompt").value = "";
  el("ct-think").checked = false;
  renderCustomTasks();
});

el("close-btn").addEventListener("click", () => window.aiAPI.closeSettings());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.aiAPI.closeSettings();
});

(async () => {
  config = await window.aiAPI.configGet();
  render();
})();
