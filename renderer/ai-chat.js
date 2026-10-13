"use strict";

// Chat window: multi-turn conversation with the active character. Sends via
// window.aiAPI.chatSend and streams the reply into the last bubble.

const I18N = {
  en: { windowTitle: "Chat", title: "Chat", close: "Close", reset: "New chat",
    empty: "Say hi to Kiri — ask anything.", placeholder: "Message Kiri…", send: "Send",
    trySaying: "Try saying:", examples: ["Help me plan today in three steps", "Suggest a 5-minute break", "Explain this concept simply: …"] },
  tr: { windowTitle: "Sohbet", title: "Sohbet", close: "Kapat", reset: "Yeni sohbet",
    empty: "Kiri'ye merhaba de — ne istersen sor.", placeholder: "Kiri'ye yaz…", send: "Gönder",
    trySaying: "Şunu deneyebilirsin:", examples: ["Bugünü üç adımda planlamama yardım et", "Bana 5 dakikalık bir mola öner", "Şu kavramı basitçe anlat: …"] },
  ko: { windowTitle: "대화", title: "대화", close: "닫기", reset: "새 대화",
    empty: "Kiri에게 인사해요 — 무엇이든 물어보세요.", placeholder: "Kiri에게 메시지…", send: "보내기",
    trySaying: "이렇게 말해 보세요:", examples: ["오늘 할 일을 세 단계로 계획해 줘", "5분 휴식 방법을 추천해 줘", "이 개념을 쉽게 설명해 줘: …"] },
  ja: { windowTitle: "チャット", title: "チャット", close: "閉じる", reset: "新しいチャット",
    empty: "Kiri に挨拶しよう — 何でも聞いてね。", placeholder: "Kiri にメッセージ…", send: "送信",
    trySaying: "たとえば:", examples: ["今日の予定を3ステップで立てたい", "5分でできる休憩を提案して", "この概念をやさしく説明して: …"] },
};

let lang = "en";
function L(k) { return (I18N[lang] || I18N.en)[k] ?? I18N.en[k] ?? k; }

const el = (id) => document.getElementById(id);
const logEl = el("log");
const emptyEl = el("empty");
const form = el("form");
const input = el("input");
const sendBtn = el("send");
const subEl = el("sub");

let streaming = false;
let pendingBubble = null;

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = L(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => { n.setAttribute("aria-label", L(n.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.setAttribute("placeholder", L(n.dataset.i18nPh)); });
  renderExamples();
}

// Example prompts on the empty state. A prompt ending in "…" is a template:
// it fills the box for the user to finish; the rest send right away.
function renderExamples() {
  const box = el("examples");
  if (!box) return;
  box.innerHTML = "";
  for (const text of L("examples") || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "example";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      if (streaming) return;
      if (text.endsWith("…")) {
        input.value = text.replace(/…$/, "");
        input.focus();
        input.dispatchEvent(new Event("input"));
        return;
      }
      input.value = text;
      submit();
    });
    box.appendChild(btn);
  }
}

function scrollToEnd() { logEl.scrollTop = logEl.scrollHeight; }

function addBubble(role, text) {
  if (emptyEl) emptyEl.hidden = true;
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : role === "err" ? "err" : "cat");
  div.textContent = text || "";
  logEl.appendChild(div);
  scrollToEnd();
  return div;
}

function showTyping() {
  pendingBubble = addBubble("cat", "");
  pendingBubble.classList.add("pending");
  pendingBubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
}

function setBusy(busy) {
  streaming = busy;
  sendBtn.disabled = busy;
  input.disabled = busy;
}

async function loadHistory() {
  try {
    const data = await window.aiAPI.chatHistory();
    if (subEl && data && data.charName) subEl.textContent = data.charName;
    logEl.querySelectorAll(".msg").forEach((n) => n.remove());
    const msgs = (data && data.messages) || [];
    if (!msgs.length) { if (emptyEl) emptyEl.hidden = false; return; }
    if (emptyEl) emptyEl.hidden = true;
    for (const m of msgs) addBubble(m.role === "assistant" ? "cat" : "user", m.text);
  } catch {}
}

window.aiAPI.onChatStream((data) => {
  if (!data) return;
  if (data.phase === "start") {
    showTyping();
    return;
  }
  if (data.phase === "delta") {
    if (pendingBubble) { pendingBubble.classList.remove("pending"); pendingBubble.textContent = data.text || ""; scrollToEnd(); }
    return;
  }
  if (data.phase === "end") {
    if (pendingBubble) { pendingBubble.classList.remove("pending"); pendingBubble.textContent = data.text || ""; }
    pendingBubble = null;
    setBusy(false);
    scrollToEnd();
    input.focus();
    return;
  }
  if (data.phase === "error") {
    if (pendingBubble) { pendingBubble.remove(); pendingBubble = null; }
    addBubble("err", data.text || "error");
    setBusy(false);
    input.focus();
  }
});

async function submit() {
  const text = input.value.trim();
  if (!text || streaming) return;
  addBubble("user", text);
  input.value = "";
  input.style.height = "auto";
  setBusy(true);
  await window.aiAPI.chatSend(text); // stream handled via onChatStream
}

form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });

// Enter to send, Shift+Enter for newline.
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
});
// Auto-grow the textarea.
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(120, input.scrollHeight) + "px";
});

el("reset-btn").addEventListener("click", async () => {
  if (streaming) window.aiAPI.chatCancel();
  await window.aiAPI.chatReset();
  logEl.querySelectorAll(".msg").forEach((n) => n.remove());
  if (emptyEl) emptyEl.hidden = false;
  setBusy(false);
  input.focus();
});
el("close-btn").addEventListener("click", () => window.aiAPI.closeChat());

if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => {
    lang = I18N[language] ? language : "en";
    applyI18n();
  });
}

(async () => {
  try {
    const language = await window.aiAPI.languageGet();
    lang = I18N[language] ? language : "en";
  } catch {}
  applyI18n();
  await loadHistory();
  input.focus();
})();
