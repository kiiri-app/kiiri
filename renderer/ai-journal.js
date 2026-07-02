"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    windowTitle: "Knowledge Journal",
    journalName: "Knowledge Journal",
    close: "Close",
    tabReview: "Review",
    tabReviewCount: (n) => `Review (${n})`,
    tabCards: "Cards",
    tabAdd: "Add",
    reviewEmpty: "No cards due today 🎉",
    showAnswer: "Show answer",
    rateAgain: "Again",
    rateHard: "Hard",
    rateGood: "Good",
    rateEasy: "Easy",
    questionLabel: "Question",
    answerLabel: "Answer",
    questionPlaceholder: "Front of the card (question)",
    answerPlaceholder: "Back of the card (answer)",
    addCard: "Add card",
    stats: (due, total) => `${due} due · ${total} cards`,
    dueNow: "now",
    dueDays: (d) => `in ${d} day${d === 1 ? "" : "s"}`,
    dueHours: (h) => `in ${h} hour${h === 1 ? "" : "s"}`,
    reviewCountMeta: (n) => `${n} review${n === 1 ? "" : "s"}`,
    cardsEmpty: "No cards yet. Add one from an AI result with '📚 Add to journal' or from the 'Add' tab.",
    deleteAria: "Delete",
  },
  tr: {
    windowTitle: "Bilgi Defteri",
    journalName: "Bilgi Defteri",
    close: "Kapat",
    tabReview: "Tekrar",
    tabReviewCount: (n) => `Tekrar (${n})`,
    tabCards: "Kartlar",
    tabAdd: "Ekle",
    reviewEmpty: "Bugün tekrar edilecek kart yok 🎉",
    showAnswer: "Cevabı göster",
    rateAgain: "Tekrar",
    rateHard: "Zor",
    rateGood: "İyi",
    rateEasy: "Kolay",
    questionLabel: "Soru",
    answerLabel: "Cevap",
    questionPlaceholder: "Kartın ön yüzü (soru)",
    answerPlaceholder: "Kartın arka yüzü (cevap)",
    addCard: "Kart ekle",
    stats: (due, total) => `${due} tekrar · ${total} kart`,
    dueNow: "şimdi",
    dueDays: (d) => `${d} gün sonra`,
    dueHours: (h) => `${h} saat sonra`,
    reviewCountMeta: (n) => `${n} tekrar`,
    cardsEmpty: "Henüz kart yok. AI sonucundan '📚 Deftere ekle' ile veya 'Ekle' sekmesinden ekle.",
    deleteAria: "Sil",
  },
  ko: {
    windowTitle: "지식 노트",
    journalName: "지식 노트",
    close: "닫기",
    tabReview: "복습",
    tabReviewCount: (n) => `복습 (${n})`,
    tabCards: "카드",
    tabAdd: "추가",
    reviewEmpty: "오늘 복습할 카드가 없다냥 🎉",
    showAnswer: "정답 보기",
    rateAgain: "다시",
    rateHard: "어려움",
    rateGood: "좋음",
    rateEasy: "쉬움",
    questionLabel: "질문",
    answerLabel: "답",
    questionPlaceholder: "카드 앞면 (질문)",
    answerPlaceholder: "카드 뒷면 (답)",
    addCard: "카드 추가",
    stats: (due, total) => `복습 ${due} · 카드 ${total}`,
    dueNow: "지금",
    dueDays: (d) => `${d}일 후`,
    dueHours: (h) => `${h}시간 후`,
    reviewCountMeta: (n) => `${n}회 복습`,
    cardsEmpty: "아직 카드가 없어요. AI 결과의 '📚 노트에 추가'나 '추가' 탭에서 추가해 보세요.",
    deleteAria: "삭제",
  },
  ja: {
    windowTitle: "ナレッジノート",
    journalName: "ナレッジノート",
    close: "閉じる",
    tabReview: "復習",
    tabReviewCount: (n) => `復習 (${n})`,
    tabCards: "カード",
    tabAdd: "追加",
    reviewEmpty: "今日復習するカードはないにゃ 🎉",
    showAnswer: "答えを見る",
    rateAgain: "もう一度",
    rateHard: "難しい",
    rateGood: "良い",
    rateEasy: "簡単",
    questionLabel: "質問",
    answerLabel: "答え",
    questionPlaceholder: "カードの表（質問）",
    answerPlaceholder: "カードの裏（答え）",
    addCard: "カードを追加",
    stats: (due, total) => `復習 ${due} · カード ${total}`,
    dueNow: "今",
    dueDays: (d) => `${d}日後`,
    dueHours: (h) => `${h}時間後`,
    reviewCountMeta: (n) => `復習${n}回`,
    cardsEmpty: "カードはまだありません。AI 結果の「📚 ノートに追加」か「追加」タブから追加してください。",
    deleteAria: "削除",
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
}

const statsEl = $("stats");
const reviewTab = $("review-tab");
const cardsTab = $("cards-tab");
const addTab = $("add-tab");
const tabReview = $("tab-review");
const tabCards = $("tab-cards");
const tabAdd = $("tab-add");

const reviewEmpty = $("review-empty");
const reviewCard = $("review-card");
const cardQuestion = $("card-question");
const cardAnswer = $("card-answer");
const revealBtn = $("reveal-btn");
const rateRow = $("rate-row");

let queue = [];
let current = null;

function syncSize() {
  requestAnimationFrame(() => api.resizeJournal({ height: Math.ceil(document.body.scrollHeight) }));
}

async function refreshStats() {
  const s = await api.journalStats();
  statsEl.textContent = L("stats", s.due, s.total);
  // reflect due count on the review tab label
  tabReview.textContent = s.due > 0 ? L("tabReviewCount", s.due) : L("tabReview");
}

function showNextCard() {
  current = queue.shift() || null;
  if (!current) {
    reviewCard.hidden = true;
    reviewEmpty.hidden = false;
    syncSize();
    return;
  }
  reviewEmpty.hidden = true;
  reviewCard.hidden = false;
  cardQuestion.textContent = current.question;
  cardAnswer.textContent = current.answer;
  cardAnswer.hidden = true;
  rateRow.hidden = true;
  revealBtn.hidden = false;
  syncSize();
}

async function loadReview() {
  queue = await api.journalDue();
  showNextCard();
  refreshStats();
}

revealBtn.addEventListener("click", () => {
  cardAnswer.hidden = false;
  rateRow.hidden = false;
  revealBtn.hidden = true;
  syncSize();
});

rateRow.querySelectorAll(".rate-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!current) return;
    await api.journalReview(current.id, Number(btn.dataset.q));
    showNextCard();
    refreshStats();
  });
});

// ---- Cards list ----
const cardsList = $("cards-list");
function relativeDue(dueAt) {
  const diff = dueAt - Date.now();
  if (diff <= 0) return L("dueNow");
  const days = Math.round(diff / 86400000);
  if (days >= 1) return L("dueDays", days);
  const hours = Math.round(diff / 3600000);
  return L("dueHours", Math.max(1, hours));
}
async function loadCards() {
  const cards = await api.journalList();
  cardsList.innerHTML = "";
  if (!cards.length) {
    const e = document.createElement("div");
    e.className = "cards-empty";
    e.textContent = L("cardsEmpty");
    cardsList.appendChild(e);
    syncSize();
    return;
  }
  const now = Date.now();
  for (const c of cards) {
    const item = document.createElement("div");
    item.className = "card-item" + ((c.dueAt || 0) <= now ? " due" : "");
    item.innerHTML = `<div class="ci-main"><div class="ci-q"></div><div class="ci-meta"></div></div><button class="ci-del">×</button>`;
    item.querySelector(".ci-del").setAttribute("aria-label", L("deleteAria"));
    item.querySelector(".ci-q").textContent = c.question;
    item.querySelector(".ci-meta").textContent = `${relativeDue(c.dueAt || 0)} · ${L("reviewCountMeta", c.reviewCount || 0)}`;
    item.querySelector(".ci-del").addEventListener("click", async () => {
      await api.journalDelete(c.id);
      loadCards();
      refreshStats();
    });
    cardsList.appendChild(item);
  }
  syncSize();
}

// ---- Add ----
$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = $("add-q").value.trim();
  const answer = $("add-a").value.trim();
  if (!question || !answer) return;
  await api.journalAdd({ question, answer });
  $("add-q").value = "";
  $("add-a").value = "";
  refreshStats();
  selectTab("cards");
});

// ---- Tabs ----
function selectTab(which) {
  tabReview.classList.toggle("active", which === "review");
  tabCards.classList.toggle("active", which === "cards");
  tabAdd.classList.toggle("active", which === "add");
  reviewTab.hidden = which !== "review";
  cardsTab.hidden = which !== "cards";
  addTab.hidden = which !== "add";
  if (which === "review") loadReview();
  else if (which === "cards") loadCards();
  else syncSize();
}
tabReview.addEventListener("click", () => selectTab("review"));
tabCards.addEventListener("click", () => selectTab("cards"));
tabAdd.addEventListener("click", () => selectTab("add"));

$("close-btn").addEventListener("click", () => api.closeJournal());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") api.closeJournal();
});

if (api.onLanguageChanged) {
  api.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
    refreshStats();
  });
}

(async () => {
  try {
    const language = await api.languageGet();
    if (I18N[language]) lang = language;
  } catch {}
  applyI18n();
  selectTab("review");
})();
