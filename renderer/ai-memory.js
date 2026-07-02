"use strict";

// Per-character memory window. Lists the active character's work history (what it
// summarized/answered/created), lets you delete entries or clear all, and open
// the human-readable .md. Data comes from main via the aiAPI bridge.

const I18N = {
  en: {
    memoryName: "Memory", close: "Close",
    memoryHint: "Kiri remembers its recent work here and uses it as context — so it picks up where you left off.",
    openFile: "Open .md", clearAll: "Clear all",
    memoryEmpty: "No memories yet — do an AI task and it'll show up here.",
    kindTask: "📝 Task", kindScreen: "🔍 Screen", kindCommand: "📦 File", kindNote: "🗒️ Note",
    more: "Show more", less: "Show less",
    confirmClear: "Clear all of this character's memory?",
  },
  tr: {
    memoryName: "Hafıza", close: "Kapat",
    memoryHint: "Kiri son işlerini burada hatırlar ve bağlam olarak kullanır — böylece kaldığın yerden devam eder.",
    openFile: ".md aç", clearAll: "Hepsini temizle",
    memoryEmpty: "Henüz hafıza yok — bir AI görevi yap, burada görünsün.",
    kindTask: "📝 Görev", kindScreen: "🔍 Ekran", kindCommand: "📦 Dosya", kindNote: "🗒️ Not",
    more: "Daha fazla", less: "Daha az",
    confirmClear: "Bu karakterin tüm hafızası silinsin mi?",
  },
  ko: {
    memoryName: "기억", close: "닫기",
    memoryHint: "Kiri가 최근 작업을 여기에 기억하고 맥락으로 사용해요 — 이어서 계속할 수 있어요.",
    openFile: ".md 열기", clearAll: "모두 지우기",
    memoryEmpty: "아직 기억이 없어요 — AI 작업을 하면 여기에 나타나요.",
    kindTask: "📝 작업", kindScreen: "🔍 화면", kindCommand: "📦 파일", kindNote: "🗒️ 노트",
    more: "더 보기", less: "접기",
    confirmClear: "이 캐릭터의 기억을 모두 지울까요?",
  },
  ja: {
    memoryName: "記憶", close: "閉じる",
    memoryHint: "Kiri は最近の作業をここに覚えて文脈として使います — 続きから再開できます。",
    openFile: ".md を開く", clearAll: "すべて消去",
    memoryEmpty: "まだ記憶がありません — AI タスクをするとここに表示されます。",
    kindTask: "📝 タスク", kindScreen: "🔍 画面", kindCommand: "📦 ファイル", kindNote: "🗒️ ノート",
    more: "もっと見る", less: "折りたたむ",
    confirmClear: "このキャラクターの記憶をすべて消去しますか？",
  },
};

let lang = "en";
function L(key) { return (I18N[lang] || I18N.en)[key] || I18N.en[key] || key; }

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = L(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", L(el.getAttribute("data-i18n-aria"))); });
  document.title = L("memoryName");
}

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const subEl = document.getElementById("mem-sub");

function kindLabel(kind) {
  if (kind === "task") return L("kindTask");
  if (kind === "screen") return L("kindScreen");
  if (kind === "command") return L("kindCommand");
  return L("kindNote");
}

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTs(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function render(data) {
  const entries = (data && data.entries) || [];
  subEl.textContent = data && data.charName ? `· ${data.charName}` : "";
  listEl.innerHTML = "";
  emptyEl.hidden = entries.length > 0;
  for (const e of entries) {
    const item = document.createElement("div");
    item.className = "mem-item";

    const head = document.createElement("div");
    head.className = "mem-head";
    // If the title already leads with its own emoji (task labels do), use that as
    // the icon and drop it from the title so the icon isn't doubled.
    const rawTitle = e.title || "—";
    const emojiLead = rawTitle.match(/^(\p{Extended_Pictographic})\s*/u);
    const kind = document.createElement("span");
    kind.className = "mem-kind";
    kind.textContent = emojiLead ? emojiLead[1] : kindLabel(e.kind).split(" ")[0];
    const title = document.createElement("span");
    title.className = "mem-title";
    title.textContent = emojiLead ? rawTitle.slice(emojiLead[0].length) : rawTitle;
    const ts = document.createElement("span");
    ts.className = "mem-ts";
    ts.textContent = fmtTs(e.ts);
    const del = document.createElement("button");
    del.className = "mem-del";
    del.type = "button";
    del.textContent = "🗑";
    del.addEventListener("click", async () => {
      await window.aiAPI.memoryDelete(e.id);
      load();
    });
    head.append(kind, title, ts, del);
    item.appendChild(head);

    if (e.detail) {
      const detail = document.createElement("div");
      detail.className = "mem-detail";
      detail.textContent = e.detail;
      item.appendChild(detail);
      // "Show more" only when the text is actually clamped.
      requestAnimationFrame(() => {
        if (detail.scrollHeight > detail.clientHeight + 4) {
          const more = document.createElement("button");
          more.className = "mem-more";
          more.type = "button";
          more.textContent = L("more");
          more.addEventListener("click", () => {
            const exp = detail.classList.toggle("expanded");
            more.textContent = exp ? L("less") : L("more");
          });
          item.appendChild(more);
        }
      });
    }
    listEl.appendChild(item);
  }
}

async function load() {
  try {
    const data = await window.aiAPI.memoryList();
    render(data);
  } catch {
    render({ entries: [] });
  }
}

document.getElementById("close-btn").addEventListener("click", () => window.aiAPI.closeMemory());
document.getElementById("open-file").addEventListener("click", () => window.aiAPI.memoryOpenFile());
document.getElementById("clear-all").addEventListener("click", async () => {
  if (!window.confirm(L("confirmClear"))) return;
  await window.aiAPI.memoryClear();
  load();
});

if (window.aiAPI.onMemoryChanged) window.aiAPI.onMemoryChanged(load);
if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => { if (I18N[language]) { lang = language; applyI18n(); load(); } });
}
if (window.aiAPI.languageGet) {
  window.aiAPI.languageGet().then((language) => { if (I18N[language]) lang = language; applyI18n(); load(); }).catch(() => { applyI18n(); load(); });
} else {
  applyI18n();
  load();
}
