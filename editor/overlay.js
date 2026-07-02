"use strict";

// Pixel-overlay editor. Paints a grid of coloured cells over the active
// pose-set character's idle art. Live (non-persisted) preview on the pet while
// editing; changes are only saved on "Save" / "Save as" (named variant),
// and you are asked before saving or discarding.

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    windowTitle: "Pixel Editor",
    close: "Close",
    paletteAria: "Color palette",
    customColor: "Custom",
    paint: "✏️ Paint",
    erase: "🩹 Erase",
    gridLabel: "Grid",
    clear: "Clear",
    notPoseset: "The pixel editor is only for the Kiri / Tori characters.<br />Pick Kiri or Tori in \"Character Appearance\" first.",
    designLabel: "Design",
    savedDesignsTitle: "Saved designs",
    deleteSelectedTitle: "Delete selected design",
    designNamePlaceholder: "Design name…",
    saveAs: "💾 Save as",
    saveBtn: "✓ Save",
    unsaved: "● unsaved",
    hint: "Left-click to paint · drag to draw · live preview on",
    pixelCount: (n) => `${n} pixel${n === 1 ? "" : "s"}`,
    chooseDesign: "— choose a design —",
    noSavedDesigns: "— no saved designs —",
    confirmDeleteDesign: "Delete this design?",
    deleteWord: "Delete",
    cancel: "Cancel",
    confirmSaveTo: (name) => `Save this design to ${name}?`,
    save: "Save",
    defaultDesignName: "Design",
    characterWord: "the character",
    unsavedChanges: "You have unsaved changes.",
    exitDetail: "Exit anyway? (The preview will be reverted)",
    exit: "Exit",
  },
  tr: {
    windowTitle: "Piksel Editörü",
    close: "Kapat",
    paletteAria: "Renk paleti",
    customColor: "Özel",
    paint: "✏️ Boya",
    erase: "🩹 Sil",
    gridLabel: "Izgara",
    clear: "Temizle",
    notPoseset: "Piksel editörü yalnızca Kiri / Tori karakterleri için.<br />Önce \"Karakter Görünümü\"nden Kiri ya da Tori seç.",
    designLabel: "Tasarım",
    savedDesignsTitle: "Kayıtlı tasarımlar",
    deleteSelectedTitle: "Seçili tasarımı sil",
    designNamePlaceholder: "Tasarım adı…",
    saveAs: "💾 Farklı kaydet",
    saveBtn: "✓ Kaydet",
    unsaved: "● kaydedilmedi",
    hint: "Sol tık ile boya · sürükleyerek çiz · canlı önizleme açık",
    pixelCount: (n) => `${n} piksel`,
    chooseDesign: "— tasarım seç —",
    noSavedDesigns: "— kayıtlı tasarım yok —",
    confirmDeleteDesign: "Bu tasarım silinsin mi?",
    deleteWord: "Sil",
    cancel: "Vazgeç",
    confirmSaveTo: (name) => `Bu tasarım ${name} karakterine kaydedilsin mi?`,
    save: "Kaydet",
    defaultDesignName: "Tasarım",
    characterWord: "karakter",
    unsavedChanges: "Değişiklikler kaydedilmedi.",
    exitDetail: "Yine de çıkılsın mı? (Önizleme geri alınır)",
    exit: "Çık",
  },
  ko: {
    windowTitle: "픽셀 편집기",
    close: "닫기",
    paletteAria: "색상 팔레트",
    customColor: "커스텀",
    paint: "✏️ 칠하기",
    erase: "🩹 지우개",
    gridLabel: "격자",
    clear: "지우기",
    notPoseset: "픽셀 편집기는 Kiri / Tori 캐릭터 전용이에요.<br />먼저 \"캐릭터 외형\"에서 Kiri나 Tori를 선택해 주세요.",
    designLabel: "디자인",
    savedDesignsTitle: "저장된 디자인",
    deleteSelectedTitle: "선택한 디자인 삭제",
    designNamePlaceholder: "디자인 이름…",
    saveAs: "💾 다른 이름으로 저장",
    saveBtn: "✓ 저장",
    unsaved: "● 저장 안 됨",
    hint: "왼쪽 클릭으로 칠하기 · 드래그로 그리기 · 실시간 미리보기 켜짐",
    pixelCount: (n) => `${n} 픽셀`,
    chooseDesign: "— 디자인 선택 —",
    noSavedDesigns: "— 저장된 디자인 없음 —",
    confirmDeleteDesign: "이 디자인을 삭제할까요?",
    deleteWord: "삭제",
    cancel: "취소",
    confirmSaveTo: (name) => `이 디자인을 ${name} 캐릭터에 저장할까요?`,
    save: "저장",
    defaultDesignName: "디자인",
    characterWord: "캐릭터",
    unsavedChanges: "저장하지 않은 변경이 있어요.",
    exitDetail: "그래도 나갈까요? (미리보기는 되돌려져요)",
    exit: "나가기",
  },
  ja: {
    windowTitle: "ピクセルエディター",
    close: "閉じる",
    paletteAria: "カラーパレット",
    customColor: "カスタム",
    paint: "✏️ 塗る",
    erase: "🩹 消す",
    gridLabel: "グリッド",
    clear: "クリア",
    notPoseset: "ピクセルエディターは Kiri / Tori キャラクター専用です。<br />先に「キャラクター外見」で Kiri か Tori を選んでください。",
    designLabel: "デザイン",
    savedDesignsTitle: "保存済みデザイン",
    deleteSelectedTitle: "選択したデザインを削除",
    designNamePlaceholder: "デザイン名…",
    saveAs: "💾 別名で保存",
    saveBtn: "✓ 保存",
    unsaved: "● 未保存",
    hint: "左クリックで塗る · ドラッグで描く · ライブプレビュー有効",
    pixelCount: (n) => `${n} ピクセル`,
    chooseDesign: "— デザインを選択 —",
    noSavedDesigns: "— 保存済みデザインなし —",
    confirmDeleteDesign: "このデザインを削除しますか？",
    deleteWord: "削除",
    cancel: "キャンセル",
    confirmSaveTo: (name) => `このデザインを ${name} に保存しますか？`,
    save: "保存",
    defaultDesignName: "デザイン",
    characterWord: "キャラクター",
    unsavedChanges: "未保存の変更があります。",
    exitDetail: "それでも閉じますか？（プレビューは元に戻ります）",
    exit: "閉じる",
  },
};

let lang = "en";
function L(key, ...args) {
  const table = I18N[lang] || I18N.en;
  const value = table[key] || I18N.en[key] || key;
  return typeof value === "function" ? value(...args) : value;
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = L(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", L(node.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => { node.setAttribute("placeholder", L(node.dataset.i18nPh)); });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => { node.setAttribute("title", L(node.dataset.i18nTitle)); });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = L(node.dataset.i18nHtml); });
}

const SWATCHES = [
  "#000000", "#ffffff", "#5a4636", "#8a6d3b", "#b08968", "#e7c9a0",
  "#e0573a", "#f29e4b", "#ffd166", "#a3c585", "#5fa97d", "#3a7d6e",
  "#6db3d6", "#3f6fb0", "#7d6bb0", "#d98ab0",
];

const stage = $("stage");
const bg = $("bg");
const canvas = $("paint");
const ctx = canvas.getContext("2d");
const paletteEl = $("palette");
const customColor = $("custom-color");
const gridToggle = $("grid-toggle");
const countEl = $("count");
const variantSelect = $("variant-select");
const variantName = $("variant-name");
const dirtyEl = $("dirty");

let set = null;
let cols = 40;
let rows = 40;
let activeColor = "#e0573a";
let mode = "paint";
let brush = 1;
let showGrid = true;
let painting = false;
let dirty = false;
let presets = [];
let originalOverlay = null; // what the character had when the editor opened
const cells = new Map(); // "x,y" -> color
let previewTimer = null;

function key(x, y) { return x + "," + y; }

function overlayFromCells() {
  if (!cells.size) return null;
  const arr = [];
  for (const [k, color] of cells) {
    const [x, y] = k.split(",").map(Number);
    arr.push({ x, y, color });
  }
  return { cols, rows, cells: arr };
}

function setDirty(v) {
  dirty = v;
  dirtyEl.hidden = !v;
}

function schedulePreview() {
  countEl.textContent = L("pixelCount", cells.size);
  setDirty(true);
  if (previewTimer) return;
  previewTimer = setTimeout(() => {
    previewTimer = null;
    api.overlayPreview(overlayFromCells());
  }, 90);
}

// ── Layout + drawing ──────────────────────────────────────────────────────
function layout() {
  const rect = bg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}

function redraw() {
  const rect = bg.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const cw = w / cols, ch = h / rows;
  for (const [k, color] of cells) {
    const [x, y] = k.split(",").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
  }
  if (showGrid) {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 1; i < cols; i++) { ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); }
    for (let j = 1; j < rows; j++) { ctx.moveTo(0, j * ch); ctx.lineTo(w, j * ch); }
    ctx.stroke();
  }
}

// ── Painting ──────────────────────────────────────────────────────────────
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  return { x: Math.floor(nx * cols), y: Math.floor(ny * rows) };
}

function paintAt(cx, cy) {
  let changed = false;
  const r = brush - 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const k = key(x, y);
      if (mode === "erase") {
        if (cells.delete(k)) changed = true;
      } else if (cells.get(k) !== activeColor) {
        cells.set(k, activeColor);
        changed = true;
      }
    }
  }
  if (changed) { redraw(); schedulePreview(); }
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  painting = true;
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = cellFromEvent(e);
  paintAt(x, y);
});
canvas.addEventListener("pointermove", (e) => {
  if (!painting) return;
  const { x, y } = cellFromEvent(e);
  paintAt(x, y);
});
const endPaint = () => { painting = false; };
canvas.addEventListener("pointerup", endPaint);
canvas.addEventListener("pointercancel", endPaint);
canvas.addEventListener("pointerleave", endPaint);

// ── Grid resolution ────────────────────────────────────────────────────────
function setCols(newCols) {
  if (newCols === cols) return;
  const natW = bg.naturalWidth || 1, natH = bg.naturalHeight || 1;
  const newRows = Math.max(4, Math.round(newCols * natH / natW));
  const remapped = new Map();
  for (const [k, color] of cells) {
    const [x, y] = k.split(",").map(Number);
    const nx = Math.min(newCols - 1, Math.floor((x + 0.5) / cols * newCols));
    const ny = Math.min(newRows - 1, Math.floor((y + 0.5) / rows * newRows));
    remapped.set(key(nx, ny), color);
  }
  cols = newCols; rows = newRows;
  cells.clear();
  for (const [k, v] of remapped) cells.set(k, v);
  redraw();
  schedulePreview();
}

function loadCells(overlay) {
  cells.clear();
  if (overlay && overlay.cols && overlay.rows) {
    cols = overlay.cols; rows = overlay.rows;
    for (const c of overlay.cells || []) cells.set(key(c.x, c.y), c.color);
  }
  document.querySelectorAll("#grids .tool-btn").forEach((m) => m.classList.toggle("active", Number(m.dataset.cols) === cols));
}

// ── Palette + toolbar ──────────────────────────────────────────────────────
function buildPalette() {
  for (const c of SWATCHES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch"; b.style.background = c; b.dataset.color = c;
    b.addEventListener("click", () => selectColor(c, b));
    paletteEl.appendChild(b);
  }
  const first = paletteEl.querySelector(`[data-color="${activeColor}"]`);
  if (first) first.classList.add("active");
}
function selectColor(c, btn) {
  activeColor = c; mode = "paint";
  paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s === btn));
  document.querySelectorAll("#modes .tool-btn").forEach((m) => m.classList.toggle("active", m.dataset.mode === "paint"));
}
customColor.addEventListener("input", () => {
  activeColor = customColor.value; mode = "paint";
  paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll("#modes .tool-btn").forEach((m) => m.classList.toggle("active", m.dataset.mode === "paint"));
});
document.querySelectorAll("#modes .tool-btn").forEach((b) => {
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    document.querySelectorAll("#modes .tool-btn").forEach((m) => m.classList.toggle("active", m === b));
  });
});
document.querySelectorAll("#brushes .tool-btn").forEach((b) => {
  b.addEventListener("click", () => {
    brush = Number(b.dataset.brush) || 1;
    document.querySelectorAll("#brushes .tool-btn").forEach((m) => m.classList.toggle("active", m === b));
  });
});
document.querySelectorAll("#grids .tool-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#grids .tool-btn").forEach((m) => m.classList.toggle("active", m === b));
    setCols(Number(b.dataset.cols) || 40);
  });
});
gridToggle.addEventListener("change", () => { showGrid = gridToggle.checked; redraw(); });
$("clear-btn").addEventListener("click", () => {
  if (!cells.size) return;
  cells.clear(); redraw(); schedulePreview();
});

// ── Variants (named designs) ───────────────────────────────────────────────
function refreshVariantSelect(selectedId) {
  const mine = presets.filter((p) => p.set === set);
  variantSelect.innerHTML = "";
  const none = document.createElement("option");
  none.value = ""; none.textContent = mine.length ? L("chooseDesign") : L("noSavedDesigns");
  variantSelect.appendChild(none);
  for (const p of mine) {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = p.name;
    variantSelect.appendChild(o);
  }
  variantSelect.value = selectedId || "";
}

variantSelect.addEventListener("change", () => {
  const p = presets.find((x) => x.id === variantSelect.value);
  if (!p) return;
  loadCells(p.overlay);
  variantName.value = p.name;
  layout();
  schedulePreview(); // marks dirty (apply by "Kaydet")
});

$("variant-delete").addEventListener("click", async () => {
  const id = variantSelect.value;
  if (!id) return;
  const ok = await api.overlayConfirm({ message: L("confirmDeleteDesign"), ok: L("deleteWord"), cancel: L("cancel") });
  if (!ok) return;
  await api.overlayPresetDelete(id);
  presets = presets.filter((p) => p.id !== id);
  refreshVariantSelect("");
});

$("save-btn").addEventListener("click", async () => {
  const ok = await api.overlayConfirm({
    message: L("confirmSaveTo", set ? set.charAt(0).toUpperCase() + set.slice(1) : L("characterWord")),
    ok: L("save"), cancel: L("cancel"),
  });
  if (!ok) return;
  await api.overlayApply(overlayFromCells());
  originalOverlay = overlayFromCells();
  setDirty(false);
});

$("saveas-btn").addEventListener("click", async () => {
  if (!cells.size) return;
  const name = (variantName.value || "").trim() || L("defaultDesignName");
  const res = await api.overlayPresetSave({ name, overlay: overlayFromCells(), id: variantSelect.value || undefined });
  if (res && res.ok && res.preset) {
    const i = presets.findIndex((p) => p.id === res.preset.id);
    if (i >= 0) presets[i] = res.preset; else presets.push(res.preset);
    refreshVariantSelect(res.preset.id);
    originalOverlay = overlayFromCells();
    setDirty(false);
  }
});

// ── Close (confirm if there are unsaved changes) ───────────────────────────
async function requestClose() {
  if (dirty) {
    const ok = await api.overlayConfirm({
      message: L("unsavedChanges"),
      detail: L("exitDetail"),
      ok: L("exit"), cancel: L("cancel"),
    });
    if (!ok) return;
    api.overlayPreview(originalOverlay); // restore the pet to the saved state
  }
  api.closeOverlay();
}
$("close-btn").addEventListener("click", requestClose);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") requestClose(); });
window.addEventListener("resize", layout);

// ── Init ───────────────────────────────────────────────────────────────────
if (api.onLanguageChanged) {
  api.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
    refreshVariantSelect(variantSelect.value);
    countEl.textContent = L("pixelCount", cells.size);
  });
}

(async () => {
  try {
    const language = await api.languageGet();
    if (I18N[language]) lang = language;
  } catch {}
  applyI18n();
  buildPalette();
  const data = await api.overlayPresetsGet();
  set = data && data.set;
  presets = (data && data.presets) || [];
  if (!set) {
    stage.hidden = true;
    $("not-poseset").hidden = false;
    document.querySelector("#toolbar").style.opacity = "0.4";
    document.querySelector("#toolbar").style.pointerEvents = "none";
    document.querySelector("#actionbar").style.opacity = "0.4";
    document.querySelector("#actionbar").style.pointerEvents = "none";
    return;
  }
  $("char-name").textContent = `· ${set.charAt(0).toUpperCase() + set.slice(1)}`;
  originalOverlay = (data && data.current) || null;
  loadCells(originalOverlay);
  refreshVariantSelect("");
  bg.addEventListener("load", () => {
    if (!originalOverlay) rows = Math.max(4, Math.round(cols * (bg.naturalHeight || 1) / (bg.naturalWidth || 1)));
    layout();
  });
  bg.src = `../svg/${set}_noeye.png`;
  new ResizeObserver(layout).observe(stage);
  countEl.textContent = L("pixelCount", cells.size);
  setDirty(false);
})();
