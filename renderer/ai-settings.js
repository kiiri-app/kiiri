"use strict";

const I18N = {
  en: {
    windowTitle: "Kiri AI Assistant Settings",
    titlebar: "🐾 AI Assistant",
    close: "Close",
    enableAssistant: "Turn on AI Assistant",
    anthropicKeyHeading: "Anthropic API key",
    save: "Save",
    remove: "Remove",
    noKey: "No key yet",
    keySaved: "Key saved ✓",
    encWarning: "⚠️ No secure storage on this device — the key is stored unencrypted in a local file.",
    providerHeading: "Provider (LLM)",
    providerLabel: "Provider",
    responseLanguage: "Response language",
    modelLabel: "Model",
    ollamaAddress: "Ollama address",
    geminiKeyPlaceholder: "Gemini API key",
    providerOllama: "Ollama (local / offline)",
    hintAnthropic: "Key: the 'Anthropic API key' section above.",
    hintOpenai: "Key: the key in the 'Voice (OpenAI)' section below (shared).",
    hintGemini: "Key: the Gemini key here.",
    hintOllama: "Local/offline — no key needed. Ollama must be running with a vision model pulled (e.g. `ollama pull llama3.2-vision`).",
    autoDetect: "Detect content and suggest tasks",
    alwaysDrop: "Analyze on every drop",
    triggerHint: "When off: hold <b>Option/Alt</b> and drop the cat → analysis starts.",
    voiceHeading: "Voice (OpenAI) — voice commands",
    voiceEnable: "Enable voice commands",
    transcribeModel: "Transcription model",
    fastCheap: "fast/cheap",
    better: "better",
    voiceHint: "When on, a 🎤 button appears next to the cat. Click → speak → the command runs (it stops automatically when you stop talking).",
    customTasksHeading: "Custom tasks",
    noCustomTasks: "No custom tasks yet.",
    taskNamePlaceholder: "Task name (e.g. Fix)",
    taskPromptPlaceholder: "What should the cat do? (e.g. Fix the typos in the image and return the clean text)",
    deepThink: "Use deep thinking (for math / logic)",
    addTask: "Add task",
    saveFailed: "Couldn't save: ",
    errorWord: "error",
  },
  tr: {
    windowTitle: "Kiri AI Asistan Ayarları",
    titlebar: "🐾 AI Asistan",
    close: "Kapat",
    enableAssistant: "AI Asistanı aç",
    anthropicKeyHeading: "Anthropic API anahtarı",
    save: "Kaydet",
    remove: "Sil",
    noKey: "Anahtar yok",
    keySaved: "Anahtar kayıtlı ✓",
    encWarning: "⚠️ Bu cihazda güvenli depolama yok — anahtar yerel dosyada şifrelenmeden saklanır.",
    providerHeading: "Sağlayıcı (LLM)",
    providerLabel: "Sağlayıcı",
    responseLanguage: "Yanıt dili",
    modelLabel: "Model",
    ollamaAddress: "Ollama adresi",
    geminiKeyPlaceholder: "Gemini API anahtarı",
    providerOllama: "Ollama (yerel / offline)",
    hintAnthropic: "Anahtar: yukarıdaki 'Anthropic API anahtarı' bölümü.",
    hintOpenai: "Anahtar: aşağıdaki 'Ses (OpenAI)' bölümündeki anahtar (paylaşılır).",
    hintGemini: "Anahtar: buradaki Gemini anahtarı.",
    hintOllama: "Yerel/offline — anahtar gerekmez. Ollama çalışıyor olmalı ve bir vision modeli indirilmeli (ör. `ollama pull llama3.2-vision`).",
    autoDetect: "İçeriği algıla ve görev öner",
    alwaysDrop: "Her bırakışta analiz et",
    triggerHint: "Kapalıyken: <b>Option/Alt</b> tuşunu basılı tutup kediyi bırak → analiz başlar.",
    voiceHeading: "Ses (OpenAI) — sesli komut",
    voiceEnable: "Sesli komutu aç",
    transcribeModel: "Transkripsiyon modeli",
    fastCheap: "hızlı/ucuz",
    better: "daha iyi",
    voiceHint: "Açıkken kedinin yanında 🎤 düğmesi belirir. Tıkla → konuş → komut çalışır (konuşmayı bırakınca otomatik durur).",
    customTasksHeading: "Özel görevler",
    noCustomTasks: "Henüz özel görev yok.",
    taskNamePlaceholder: "Görev adı (ör. Düzelt)",
    taskPromptPlaceholder: "Kediye ne yapmasını söyleyeyim? (ör. Görüntüdeki yazım hatalarını düzeltip temiz metni ver)",
    deepThink: "Derin düşünme kullan (matematik / mantık için)",
    addTask: "Görev ekle",
    saveFailed: "Kaydedilemedi: ",
    errorWord: "hata",
  },
  ko: {
    windowTitle: "Kiri AI 어시스턴트 설정",
    titlebar: "🐾 AI 어시스턴트",
    close: "닫기",
    enableAssistant: "AI 어시스턴트 켜기",
    anthropicKeyHeading: "Anthropic API 키",
    save: "저장",
    remove: "삭제",
    noKey: "키 없음",
    keySaved: "키 저장됨 ✓",
    encWarning: "⚠️ 이 기기에는 보안 저장소가 없어요 — 키가 로컬 파일에 암호화 없이 저장됩니다.",
    providerHeading: "제공자 (LLM)",
    providerLabel: "제공자",
    responseLanguage: "응답 언어",
    modelLabel: "모델",
    ollamaAddress: "Ollama 주소",
    geminiKeyPlaceholder: "Gemini API 키",
    providerOllama: "Ollama (로컬 / 오프라인)",
    hintAnthropic: "키: 위의 'Anthropic API 키' 섹션.",
    hintOpenai: "키: 아래 '음성 (OpenAI)' 섹션의 키 (공유됨).",
    hintGemini: "키: 여기의 Gemini 키.",
    hintOllama: "로컬/오프라인 — 키가 필요 없어요. Ollama가 실행 중이고 vision 모델이 설치되어 있어야 해요 (예: `ollama pull llama3.2-vision`).",
    autoDetect: "내용을 인식해 작업 추천",
    alwaysDrop: "떨어뜨릴 때마다 분석",
    triggerHint: "꺼져 있을 때: <b>Option/Alt</b> 키를 누른 채 고양이를 놓으면 → 분석이 시작돼요.",
    voiceHeading: "음성 (OpenAI) — 음성 명령",
    voiceEnable: "음성 명령 켜기",
    transcribeModel: "전사 모델",
    fastCheap: "빠름/저렴",
    better: "더 좋음",
    voiceHint: "켜면 고양이 옆에 🎤 버튼이 나타나요. 클릭 → 말하기 → 명령 실행 (말을 멈추면 자동으로 멈춰요).",
    customTasksHeading: "커스텀 작업",
    noCustomTasks: "아직 커스텀 작업이 없어요.",
    taskNamePlaceholder: "작업 이름 (예: 교정)",
    taskPromptPlaceholder: "고양이에게 뭘 시킬까요? (예: 이미지의 오타를 고쳐서 깔끔한 텍스트로 줘)",
    deepThink: "깊은 사고 사용 (수학 / 논리용)",
    addTask: "작업 추가",
    saveFailed: "저장 실패: ",
    errorWord: "오류",
  },
  ja: {
    windowTitle: "Kiri AI アシスタント設定",
    titlebar: "🐾 AI アシスタント",
    close: "閉じる",
    enableAssistant: "AI アシスタントをオン",
    anthropicKeyHeading: "Anthropic API キー",
    save: "保存",
    remove: "削除",
    noKey: "キーなし",
    keySaved: "キー保存済み ✓",
    encWarning: "⚠️ このデバイスには安全なストレージがありません — キーはローカルファイルに暗号化なしで保存されます。",
    providerHeading: "プロバイダー (LLM)",
    providerLabel: "プロバイダー",
    responseLanguage: "応答言語",
    modelLabel: "モデル",
    ollamaAddress: "Ollama アドレス",
    geminiKeyPlaceholder: "Gemini API キー",
    providerOllama: "Ollama (ローカル / オフライン)",
    hintAnthropic: "キー: 上の「Anthropic API キー」セクション。",
    hintOpenai: "キー: 下の「音声 (OpenAI)」セクションのキー（共有）。",
    hintGemini: "キー: ここの Gemini キー。",
    hintOllama: "ローカル/オフライン — キー不要。Ollama が起動していて vision モデルが必要です（例: `ollama pull llama3.2-vision`）。",
    autoDetect: "内容を検出してタスクを提案",
    alwaysDrop: "ドロップのたびに分析",
    triggerHint: "オフのとき: <b>Option/Alt</b> を押しながら猫をドロップ → 分析が始まります。",
    voiceHeading: "音声 (OpenAI) — 音声コマンド",
    voiceEnable: "音声コマンドをオン",
    transcribeModel: "文字起こしモデル",
    fastCheap: "速い/安い",
    better: "高精度",
    voiceHint: "オンにすると猫のそばに 🎤 ボタンが現れます。クリック → 話す → コマンド実行（話し終わると自動で止まります）。",
    customTasksHeading: "カスタムタスク",
    noCustomTasks: "カスタムタスクはまだありません。",
    taskNamePlaceholder: "タスク名（例: 修正）",
    taskPromptPlaceholder: "猫に何をさせる？（例: 画像の誤字を直してきれいなテキストを返して）",
    deepThink: "深い思考を使う（数学 / 論理向け）",
    addTask: "タスクを追加",
    saveFailed: "保存できませんでした: ",
    errorWord: "エラー",
  },
};

let lang = "en";
function L(key) {
  const table = I18N[lang] || I18N.en;
  return table[key] || I18N.en[key] || key;
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = L(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", L(node.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => { node.setAttribute("placeholder", L(node.dataset.i18nPh)); });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = L(node.dataset.i18nHtml); });
}

function providerLabels() {
  return {
    anthropic: "Claude (Anthropic)",
    openai: "OpenAI (GPT-4o)",
    gemini: "Google Gemini",
    ollama: L("providerOllama"),
  };
}
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
const PROVIDER_HINT_KEY = {
  anthropic: "hintAnthropic",
  openai: "hintOpenai",
  gemini: "hintGemini",
  ollama: "hintOllama",
};
const LANG_LABELS = { tr: "Türkçe", en: "English", ko: "한국어", ja: "日本語" };
function transcribeLabels() {
  return {
    "gpt-4o-mini-transcribe": `gpt-4o-mini-transcribe (${L("fastCheap")})`,
    "gpt-4o-transcribe": `gpt-4o-transcribe (${L("better")})`,
    "whisper-1": "whisper-1",
  };
}

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
    keyStatus.textContent = L("keySaved");
    keyStatus.classList.add("ok");
    clearKey.hidden = false;
  } else {
    keyStatus.textContent = L("noKey");
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
    empty.textContent = L("noCustomTasks");
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
      <button type="button" class="ci-del">×</button>`;
    item.querySelector(".ci-del").setAttribute("aria-label", L("remove"));
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
    openaiKeyStatus.textContent = L("keySaved");
    openaiKeyStatus.classList.add("ok");
    clearOpenaiKey.hidden = false;
  } else {
    openaiKeyStatus.textContent = L("noKey");
    openaiKeyStatus.classList.remove("ok");
    clearOpenaiKey.hidden = true;
  }
}

function renderGeminiStatus() {
  if (config.hasGeminiKey) {
    geminiKeyStatus.textContent = L("keySaved");
    geminiKeyStatus.classList.add("ok");
    clearGeminiKey.hidden = false;
  } else {
    geminiKeyStatus.textContent = L("noKey");
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
  providerHint.textContent = PROVIDER_HINT_KEY[p] ? L(PROVIDER_HINT_KEY[p]) : "";
  renderGeminiStatus();
}

function render() {
  enabled.checked = config.enabled;
  autoDetect.checked = config.autoDetect;
  alwaysDrop.checked = config.alwaysAnalyzeOnDrop;
  fillSelect(providerSel, config.supportedProviders || [], providerLabels(), config.provider);
  fillSelect(langSel, config.supportedResponseLanguages || [], LANG_LABELS, config.responseLanguage);
  applyProviderUI();
  vEnabled.checked = config.voiceEnabled;
  fillSelect(transcribeModelEl, config.supportedTranscribeModels || [], transcribeLabels(), config.transcribeModel);
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
    geminiKeyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
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
    keyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
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
    openaiKeyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
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

if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
    if (config) render();
  });
}

(async () => {
  try {
    const language = await window.aiAPI.languageGet();
    if (I18N[language]) lang = language;
  } catch {}
  applyI18n();
  config = await window.aiAPI.configGet();
  render();
})();
