"use strict";

// Task registry. Built-in tasks ship with the app; users can define their own
// in AI settings (stored in ai-config.customTasks). Each task carries a
// language-neutral `instruction` (the core ask sent to Claude) plus localized
// labels for the menu. `think: true` enables adaptive thinking for the call.

const LANGS = ["tr", "en", "ko", "ja"];

const BUILTIN_TASKS = [
  {
    id: "summarize",
    emoji: "📝",
    think: false,
    instruction:
      "Bu ekran görüntüsündeki ana metni/içeriği özetle. En önemli noktaları 2-4 kısa madde veya birkaç cümlede ver.",
    labels: { tr: "Özetle", en: "Summarize", ko: "요약", ja: "要約" },
  },
  {
    id: "solve",
    emoji: "✅",
    think: true,
    instruction:
      "Görüntüdeki soruyu veya problemi çöz. Önce kısa çözüm adımlarını yaz, sonra ayrı bir satırda net bir 'Cevap:' ver. Çoktan seçmeli ise doğru şıkkı belirt.",
    labels: { tr: "Soruyu çöz", en: "Solve", ko: "문제 풀기", ja: "問題を解く" },
  },
  {
    id: "explain",
    emoji: "💡",
    think: true,
    instruction:
      "Görüntüdeki içeriği (kod, kavram, hata mesajı, diyagram vb.) sade bir dille açıkla. Ne olduğunu ve neden önemli olduğunu anlat.",
    labels: { tr: "Açıkla", en: "Explain", ko: "설명", ja: "説明" },
  },
  {
    id: "translate",
    emoji: "🌐",
    think: false,
    instruction:
      "Görüntüdeki metni hedef dile çevir. Sadece çeviriyi ver, ek açıklama yazma.",
    labels: { tr: "Çevir", en: "Translate", ko: "번역", ja: "翻訳" },
  },
  {
    id: "extract",
    emoji: "📋",
    think: false,
    instruction:
      "Görüntüdeki tüm metni olduğu gibi, satır düzenini koruyarak çıkar (OCR). Yorum ekleme, sadece metni ver.",
    labels: { tr: "Metni çıkar", en: "Extract text", ko: "텍스트 추출", ja: "テキスト抽出" },
  },
];

function labelFor(task, lang) {
  if (task.custom) return task.label;
  const l = LANGS.includes(lang) ? lang : "en";
  return (task.labels && (task.labels[l] || task.labels.en)) || task.id;
}

// Returns the merged, localized task list for the menu/settings UI.
function localizedTasks(lang, customTasks) {
  const builtin = BUILTIN_TASKS.map((t) => ({
    id: t.id,
    emoji: t.emoji,
    label: labelFor(t, lang),
    think: t.think,
    custom: false,
  }));
  const custom = (customTasks || []).map((t) => ({
    id: t.id,
    emoji: t.emoji || "✨",
    label: t.label,
    think: !!t.think,
    custom: true,
  }));
  return [...builtin, ...custom];
}

// Resolves a task id to the object used to build the Claude request.
function resolveTask(id, customTasks) {
  const builtin = BUILTIN_TASKS.find((t) => t.id === id);
  if (builtin) return { ...builtin, custom: false };
  const custom = (customTasks || []).find((t) => t.id === id);
  if (custom) {
    return {
      id: custom.id,
      emoji: custom.emoji || "✨",
      think: !!custom.think,
      instruction: custom.prompt,
      custom: true,
      label: custom.label,
    };
  }
  return null;
}

module.exports = { BUILTIN_TASKS, localizedTasks, resolveTask, labelFor };
