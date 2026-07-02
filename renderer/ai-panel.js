"use strict";

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
      badge.textContent = "Önerilen";
      btn.appendChild(badge);
    }
    btn.addEventListener("click", () => runTask(task));
    taskListEl.appendChild(btn);
  }
  show("menu");
}

async function runTask(task) {
  busyLabel.textContent = task.think ? "Düşünüyorum…" : "Bakıyorum…";
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
    resultText.textContent = (res && res.message) || "Bir hata oluştu.";
    copyBtn.disabled = true;
    journalBtn.hidden = true;
  }
  copyBtn.classList.remove("done");
  copyBtn.textContent = "Kopyala";
  journalBtn.classList.remove("done");
  journalBtn.disabled = false;
  journalBtn.textContent = "📚 Deftere ekle";
  show("result");
}

journalBtn.addEventListener("click", async () => {
  journalBtn.disabled = true;
  journalBtn.textContent = "Ekleniyor…";
  const res = await window.aiAPI.journalAddFromText(resultText.textContent || "");
  if (res && res.ok) {
    journalBtn.classList.add("done");
    journalBtn.textContent = "📚 Eklendi ✓";
  } else {
    journalBtn.disabled = false;
    journalBtn.textContent = (res && res.message) ? "Hata: " + res.message.slice(0, 24) : "📚 Deftere ekle";
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultText.textContent || "");
    copyBtn.classList.add("done");
    copyBtn.textContent = "Kopyalandı ✓";
    setTimeout(() => {
      copyBtn.classList.remove("done");
      copyBtn.textContent = "Kopyala";
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
