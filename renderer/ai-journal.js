"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

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
  statsEl.textContent = `${s.due} tekrar · ${s.total} kart`;
  // reflect due count on the review tab label
  tabReview.textContent = s.due > 0 ? `Tekrar (${s.due})` : "Tekrar";
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
  if (diff <= 0) return "şimdi";
  const days = Math.round(diff / 86400000);
  if (days >= 1) return `${days} gün sonra`;
  const hours = Math.round(diff / 3600000);
  return `${Math.max(1, hours)} saat sonra`;
}
async function loadCards() {
  const cards = await api.journalList();
  cardsList.innerHTML = "";
  if (!cards.length) {
    const e = document.createElement("div");
    e.className = "cards-empty";
    e.textContent = "Henüz kart yok. AI sonucundan '📚 Deftere ekle' ile veya 'Ekle' sekmesinden ekle.";
    cardsList.appendChild(e);
    syncSize();
    return;
  }
  const now = Date.now();
  for (const c of cards) {
    const item = document.createElement("div");
    item.className = "card-item" + ((c.dueAt || 0) <= now ? " due" : "");
    item.innerHTML = `<div class="ci-main"><div class="ci-q"></div><div class="ci-meta"></div></div><button class="ci-del" aria-label="Sil">×</button>`;
    item.querySelector(".ci-q").textContent = c.question;
    item.querySelector(".ci-meta").textContent = `${relativeDue(c.dueAt || 0)} · ${c.reviewCount || 0} tekrar`;
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

selectTab("review");
