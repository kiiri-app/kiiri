"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    windowTitle: "Character Appearance",
    close: "Close",
    previewAlt: "preview",
    classicNote: "Classic cat — its pattern is edited in the \"Pattern Editor\".",
    characterLabel: "Character",
    editPixels: "🎨 Edit pixels",
    apply: "Apply",
    applied: "Applied ✓",
    classicCat: "Classic cat",
  },
  tr: {
    windowTitle: "Karakter Görünümü",
    close: "Kapat",
    previewAlt: "önizleme",
    classicNote: "Klasik kedi — deseni \"Desen Editörü\"nden düzenlenir.",
    characterLabel: "Karakter",
    editPixels: "🎨 Pikselleri düzenle",
    apply: "Uygula",
    applied: "Uygulandı ✓",
    classicCat: "Klasik kedi",
  },
  ko: {
    windowTitle: "캐릭터 외형",
    close: "닫기",
    previewAlt: "미리보기",
    classicNote: "클래식 고양이 — 무늬는 \"패턴 편집\"에서 수정해요.",
    characterLabel: "캐릭터",
    editPixels: "🎨 픽셀 편집",
    apply: "적용",
    applied: "적용됨 ✓",
    classicCat: "클래식 고양이",
  },
  ja: {
    windowTitle: "キャラクター外見",
    close: "閉じる",
    previewAlt: "プレビュー",
    classicNote: "クラシック猫 — 模様は「パターン編集」で編集します。",
    characterLabel: "キャラクター",
    editPixels: "🎨 ピクセル編集",
    apply: "適用",
    applied: "適用済み ✓",
    classicCat: "クラシック猫",
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
  document.querySelectorAll("[data-i18n-alt]").forEach((node) => { node.setAttribute("alt", L(node.dataset.i18nAlt)); });
  const classicBtn = setsEl.querySelector('button[data-id="classic"]');
  if (classicBtn) classicBtn.textContent = L("classicCat");
}

const previewPose = $("preview-pose");
const classicNote = $("classic-note");
const setsEl = $("sets");
const paintBtn = $("paint-btn");

// The illustrated pose-set characters (kiri / tori) plus the original rigged
// "classic" cat. The old Ghibli-resembling sprites (orman/cini …) and their
// editor were removed.
const OPTIONS = [
  { id: "kiri", label: "Kiri", kind: "poseset" },
  { id: "tori", label: "Tori", kind: "poseset" },
  { id: "classic", labelKey: "classicCat", kind: "classic" },
];

let kind = "poseset";
let set = "kiri";

function selectedId() { return kind === "poseset" ? set : "classic"; }

function renderPreview() {
  const posed = kind === "poseset";
  previewPose.hidden = !posed;
  classicNote.hidden = posed;
  if (posed) previewPose.src = `../svg/${set}_noeye.png`;
}

function updatePaintBtn() {
  paintBtn.disabled = kind !== "poseset";
  paintBtn.style.opacity = kind === "poseset" ? "1" : "0.45";
}

function sync() {
  setsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.id === selectedId()));
  renderPreview();
  updatePaintBtn();
}

for (const o of OPTIONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "set-btn";
  b.dataset.id = o.id;
  b.textContent = o.labelKey ? L(o.labelKey) : o.label;
  b.addEventListener("click", () => {
    kind = o.kind;
    if (o.kind === "poseset") set = o.id;
    sync();
  });
  setsEl.appendChild(b);
}

paintBtn.addEventListener("click", async () => {
  if (kind !== "poseset") return;
  // Make sure the active character is this pose-set before opening the pixel editor.
  await api.characterSetArt({ kind, set });
  api.openOverlayEditor();
});

$("apply-btn").addEventListener("click", async () => {
  const btn = $("apply-btn");
  await api.characterSetArt({ kind, set });
  btn.classList.add("done");
  btn.textContent = L("applied");
  setTimeout(() => { btn.classList.remove("done"); btn.textContent = L("apply"); }, 1400);
});

$("close-btn").addEventListener("click", () => api.closeCharacter());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") api.closeCharacter(); });

if (api.onLanguageChanged) {
  api.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
  });
}

(async () => {
  try {
    const language = await api.languageGet();
    if (I18N[language]) lang = language;
  } catch {}
  applyI18n();
  const cur = await api.characterGet();
  if (cur) {
    $("char-name").textContent = cur.name ? `· ${cur.name}` : "";
    // Legacy "sprite" characters fall back to the classic option (sprites removed).
    kind = cur.kind === "poseset" ? "poseset" : "classic";
    if (cur.set === "tori" || cur.set === "kiri") set = cur.set;
  }
  sync();
})();
