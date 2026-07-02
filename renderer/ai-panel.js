"use strict";

const I18N = {
  en: {
    close: "Close",
    busyLooking: "Taking a look…",
    busyThinking: "Thinking…",
    cancel: "Cancel",
    backToTasks: "← Tasks",
    copy: "Copy",
    copied: "Copied ✓",
    addToJournal: "📚 Add to journal",
    adding: "Adding…",
    added: "📚 Added ✓",
    errorGeneric: "Something went wrong.",
    errorPrefix: "Error: ",
    recommended: "Recommended",
  },
  tr: {
    close: "Kapat",
    busyLooking: "Bakıyorum…",
    busyThinking: "Düşünüyorum…",
    cancel: "İptal",
    backToTasks: "← Görevler",
    copy: "Kopyala",
    copied: "Kopyalandı ✓",
    addToJournal: "📚 Deftere ekle",
    adding: "Ekleniyor…",
    added: "📚 Eklendi ✓",
    errorGeneric: "Bir hata oluştu.",
    errorPrefix: "Hata: ",
    recommended: "Önerilen",
  },
  ko: {
    close: "닫기",
    busyLooking: "보는 중이다냥…",
    busyThinking: "생각 중이다냥…",
    cancel: "취소",
    backToTasks: "← 작업",
    copy: "복사",
    copied: "복사됨 ✓",
    addToJournal: "📚 노트에 추가",
    adding: "추가 중…",
    added: "📚 추가됨 ✓",
    errorGeneric: "문제가 생겼다냥.",
    errorPrefix: "오류: ",
    recommended: "추천",
  },
  ja: {
    close: "閉じる",
    busyLooking: "見てるにゃ…",
    busyThinking: "考え中だにゃ…",
    cancel: "キャンセル",
    backToTasks: "← タスク",
    copy: "コピー",
    copied: "コピー済み ✓",
    addToJournal: "📚 ノートに追加",
    adding: "追加中…",
    added: "📚 追加済み ✓",
    errorGeneric: "エラーが起きたにゃ。",
    errorPrefix: "エラー: ",
    recommended: "おすすめ",
  },
};

let lang = "en";
function L(key) {
  const table = I18N[lang] || I18N.en;
  return table[key] || I18N.en[key] || key;
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = L(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", L(el.dataset.i18nAria)); });
}

const card = document.getElementById("card");
const titleText = document.getElementById("title-text");
const menuView = document.getElementById("menu-view");
const busyView = document.getElementById("busy-view");
const resultView = document.getElementById("result-view");
const briefEl = document.getElementById("brief");
const taskListEl = document.getElementById("task-list");
const busyLabel = document.getElementById("busy-label");
const resultTask = document.getElementById("result-task");
const resultText = document.getElementById("result-text");
const copyBtn = document.getElementById("copy-btn");
const journalBtn = document.getElementById("journal-btn");
const backBtn = document.getElementById("back-btn");
const cancelBtn = document.getElementById("cancel-btn");
const closeBtn = document.getElementById("close-btn");

let state = { captureId: null, tasks: [], catName: "Kiri" };

function syncSize() {
  // Let the DOM settle, then ask main to size the window to the card.
  requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    const width = Math.ceil(rect.width + 16);
    const height = Math.ceil(rect.height + 16);
    window.aiAPI.resizePanel({ width, height });
  });
}

function show(view) {
  menuView.hidden = view !== "menu";
  busyView.hidden = view !== "busy";
  resultView.hidden = view !== "result";
  syncSize();
}

function renderMenu(data) {
  state.captureId = data.captureId;
  state.tasks = data.tasks || [];
  state.catName = data.catName || "Kiri";
  titleText.textContent = state.catName;
  briefEl.textContent = data.brief || "";

  taskListEl.innerHTML = "";
  for (const task of state.tasks) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-btn";
    if (task.id === data.recommendedTaskId) btn.classList.add("recommended");
    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = task.emoji || "✨";
    const label = document.createElement("span");
    label.textContent = task.label;
    btn.appendChild(emoji);
    btn.appendChild(label);
    if (task.id === data.recommendedTaskId) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = L("recommended");
      btn.appendChild(badge);
    }
    btn.addEventListener("click", () => runTask(task));
    taskListEl.appendChild(btn);
  }
  show("menu");
}

async function runTask(task) {
  busyLabel.textContent = task.think ? L("busyThinking") : L("busyLooking");
  show("busy");
  const res = await window.aiAPI.runTask({ captureId: state.captureId, taskId: task.id });
  resultTask.textContent = `${task.emoji || "✨"} ${task.label}`;
  if (res && res.ok) {
    resultText.classList.remove("error");
    resultText.textContent = res.text;
    copyBtn.disabled = false;
    journalBtn.hidden = false;
  } else if (res && res.error === "aborted") {
    show("menu");
    return;
  } else {
    resultText.classList.add("error");
    resultText.textContent = (res && res.message) || L("errorGeneric");
    copyBtn.disabled = true;
    journalBtn.hidden = true;
  }
  copyBtn.classList.remove("done");
  copyBtn.textContent = L("copy");
  journalBtn.classList.remove("done");
  journalBtn.disabled = false;
  journalBtn.textContent = L("addToJournal");
  show("result");
}

journalBtn.addEventListener("click", async () => {
  journalBtn.disabled = true;
  journalBtn.textContent = L("adding");
  const res = await window.aiAPI.journalAddFromText(resultText.textContent || "");
  if (res && res.ok) {
    journalBtn.classList.add("done");
    journalBtn.textContent = L("added");
  } else {
    journalBtn.disabled = false;
    journalBtn.textContent = (res && res.message) ? L("errorPrefix") + res.message.slice(0, 24) : L("addToJournal");
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultText.textContent || "");
    copyBtn.classList.add("done");
    copyBtn.textContent = L("copied");
    setTimeout(() => {
      copyBtn.classList.remove("done");
      copyBtn.textContent = L("copy");
    }, 1500);
  } catch {}
});

backBtn.addEventListener("click", () => show("menu"));
cancelBtn.addEventListener("click", () => {
  window.aiAPI.cancel();
  show("menu");
});
closeBtn.addEventListener("click", () => window.aiAPI.closePanel());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.aiAPI.closePanel();
});

window.aiAPI.onMenuShow(renderMenu);

if (window.aiAPI.languageGet) {
  window.aiAPI.languageGet().then((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
  }).catch(() => {});
}
if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
  });
}
