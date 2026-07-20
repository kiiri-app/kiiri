"use strict";

// Automations manager window: list scheduled automations + an add form.
// Talks to main via window.aiAPI.automations*. Kinds: "screen" (ask about my
// screen) and "note" (say a line). Schedules: interval (every N min) or daily.

const I18N = {
  en: {
    windowTitle: "Automations", title: "Automations", close: "Close",
    hint: "Kiri runs these on a schedule — a note to say, or a question about your screen (bubble + spoken answer).",
    empty: "No automations yet — add one below.",
    addTitle: "New automation", namePh: "Name (optional)",
    kindLabel: "Kind", kindScreen: "Ask about my screen", kindNote: "Say a note",
    promptPh: "What to ask / say…",
    scheduleLabel: "Schedule", schedInterval: "Every…", schedDaily: "Daily at…",
    everyLabel: "Interval", timeLabel: "Time", addBtn: "Add automation",
    runNow: "Run now", del: "Delete",
    everyMinutes: (n) => n % 60 === 0 ? `every ${n / 60} h` : `every ${n} min`,
    dailyAt: (t) => `daily at ${t}`,
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  tr: {
    windowTitle: "Otomasyonlar", title: "Otomasyonlar", close: "Kapat",
    hint: "Kiri bunları zamanlı çalıştırır — söylenecek bir not ya da ekranın hakkında bir soru (balon + sesli yanıt).",
    empty: "Henüz otomasyon yok — aşağıdan ekle.",
    addTitle: "Yeni otomasyon", namePh: "Ad (isteğe bağlı)",
    kindLabel: "Tür", kindScreen: "Ekranımı sor", kindNote: "Not söyle",
    promptPh: "Ne sorulacak / söylenecek…",
    scheduleLabel: "Zamanlama", schedInterval: "Her…", schedDaily: "Günlük saat…",
    everyLabel: "Aralık", timeLabel: "Saat", addBtn: "Otomasyon ekle",
    runNow: "Şimdi çalıştır", del: "Sil",
    everyMinutes: (n) => n % 60 === 0 ? `her ${n / 60} saat` : `her ${n} dk`,
    dailyAt: (t) => `her gün ${t}`,
    days: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  },
  ko: {
    windowTitle: "자동화", title: "자동화", close: "닫기",
    hint: "Kiri가 일정에 따라 실행해요 — 말할 메모 또는 화면에 대한 질문(말풍선 + 음성 답변).",
    empty: "아직 자동화가 없어요 — 아래에서 추가하세요.",
    addTitle: "새 자동화", namePh: "이름 (선택)",
    kindLabel: "종류", kindScreen: "내 화면에 대해 묻기", kindNote: "메모 말하기",
    promptPh: "무엇을 묻거나 말할지…",
    scheduleLabel: "일정", schedInterval: "매…", schedDaily: "매일…",
    everyLabel: "간격", timeLabel: "시간", addBtn: "자동화 추가",
    runNow: "지금 실행", del: "삭제",
    everyMinutes: (n) => n % 60 === 0 ? `${n / 60}시간마다` : `${n}분마다`,
    dailyAt: (t) => `매일 ${t}`,
    days: ["일", "월", "화", "수", "목", "금", "토"],
  },
  ja: {
    windowTitle: "自動化", title: "自動化", close: "閉じる",
    hint: "Kiri がスケジュールで実行します — 伝えるメモ、または画面についての質問（吹き出し + 音声回答）。",
    empty: "まだ自動化がありません — 下から追加してください。",
    addTitle: "新しい自動化", namePh: "名前（任意）",
    kindLabel: "種類", kindScreen: "画面について聞く", kindNote: "メモを言う",
    promptPh: "何を聞く / 言う…",
    scheduleLabel: "スケジュール", schedInterval: "毎…", schedDaily: "毎日…",
    everyLabel: "間隔", timeLabel: "時刻", addBtn: "自動化を追加",
    runNow: "今すぐ実行", del: "削除",
    everyMinutes: (n) => n % 60 === 0 ? `${n / 60}時間ごと` : `${n}分ごと`,
    dailyAt: (t) => `毎日 ${t}`,
    days: ["日", "月", "火", "水", "木", "金", "土"],
  },
};

const INTERVAL_CHOICES = [15, 30, 60, 120, 240, 480];

let lang = "en";
function L(key) { return (I18N[lang] || I18N.en)[key] ?? I18N.en[key] ?? key; }

const el = (id) => document.getElementById(id);
const listEl = el("list");
const emptyEl = el("empty");
const form = el("form");
const nameEl = el("name");
const kindEl = el("kind");
const promptEl = el("prompt");
const schedTypeEl = el("sched-type");
const intervalEl = el("interval");
const intervalWrap = el("interval-wrap");
const dailyWrap = el("daily-wrap");
const timeEl = el("time");

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = L(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => { n.setAttribute("aria-label", L(n.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.setAttribute("placeholder", L(n.dataset.i18nPh)); });
}

function fillIntervals() {
  intervalEl.innerHTML = "";
  for (const min of INTERVAL_CHOICES) {
    const o = document.createElement("option");
    o.value = String(min);
    o.textContent = L("everyMinutes")(min);
    intervalEl.appendChild(o);
  }
  intervalEl.value = "60";
}

function scheduleText(a) {
  const s = a.schedule || {};
  if (s.type === "daily") {
    let base = L("dailyAt")(s.time);
    if (Array.isArray(s.days) && s.days.length) {
      base += " (" + s.days.map((d) => L("days")[d]).join(", ") + ")";
    }
    return base;
  }
  return L("everyMinutes")(s.everyMin || 60);
}

function render(items) {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;
  for (const a of items) {
    const item = document.createElement("div");
    item.className = "auto-item" + (a.enabled ? "" : " off");

    const head = document.createElement("div");
    head.className = "auto-head";

    const kind = document.createElement("span");
    kind.className = "auto-kind";
    kind.textContent = a.kind === "note" ? "💬" : "🔍";

    const name = document.createElement("span");
    name.className = "auto-name";
    name.textContent = a.name;

    const actions = document.createElement("div");
    actions.className = "auto-actions";

    const sw = document.createElement("label");
    sw.className = "sw";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!a.enabled;
    cb.addEventListener("change", async () => {
      const r = await window.aiAPI.automationsEnabledSet({ id: a.id, enabled: cb.checked });
      if (r && r.items) render(r.items);
    });
    const track = document.createElement("span");
    track.className = "track";
    sw.append(cb, track);

    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "auto-run";
    runBtn.textContent = "▶";
    runBtn.title = L("runNow");
    runBtn.addEventListener("click", () => window.aiAPI.automationsRunNow(a.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "auto-del";
    del.textContent = "×";
    del.title = L("del");
    del.addEventListener("click", async () => {
      const r = await window.aiAPI.automationsDelete(a.id);
      if (r && r.items) render(r.items);
    });

    actions.append(sw, runBtn, del);
    head.append(kind, name, actions);

    const meta = document.createElement("div");
    meta.className = "auto-meta";
    meta.textContent = scheduleText(a);

    const prompt = document.createElement("div");
    prompt.className = "auto-prompt";
    prompt.textContent = a.prompt;

    item.append(head, meta, prompt);
    listEl.appendChild(item);
  }
}

function syncScheduleUI() {
  const daily = schedTypeEl.value === "daily";
  dailyWrap.hidden = !daily;
  intervalWrap.hidden = daily;
}

async function refresh() {
  const items = await window.aiAPI.automationsList();
  render(items || []);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) { promptEl.focus(); return; }
  const schedule = schedTypeEl.value === "daily"
    ? { type: "daily", time: timeEl.value || "09:00", days: [] }
    : { type: "interval", everyMin: Number(intervalEl.value) || 60 };
  const r = await window.aiAPI.automationsAdd({
    name: nameEl.value.trim(),
    kind: kindEl.value,
    prompt,
    schedule,
  });
  if (r && r.items) {
    render(r.items);
    nameEl.value = "";
    promptEl.value = "";
  }
});

schedTypeEl.addEventListener("change", syncScheduleUI);
el("close-btn").addEventListener("click", () => window.aiAPI.closeAutomations());

if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => {
    lang = I18N[language] ? language : "en";
    applyI18n();
    fillIntervals();
    refresh();
  });
}

(async () => {
  try {
    const language = await window.aiAPI.languageGet();
    lang = I18N[language] ? language : "en";
  } catch {}
  applyI18n();
  fillIntervals();
  syncScheduleUI();
  refresh();
})();
