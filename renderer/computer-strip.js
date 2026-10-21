"use strict";

const api = window.cuAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    label: "Kiiri is using your computer",
    step: (n, max) => `step ${n}/${max}`,
    pause: "⏸ Pause", resume: "▶ Resume", stop: "■ Stop",
    thinking: "thinking…", paused: "paused",
    confirmTitle: "⚠️ Check this step", askTitle: "❓ Kiiri is asking",
    allow: "Allow this step", deny: "Deny — stop",
    escHint: "Esc stops",
    risk: { blocked_app: "This app holds secrets or system controls — Kiiri asks before acting here.", banking: "This looks like banking or a payment.", secret_field: "This types into a password / secret field.", dangerous_shortcut: "This shortcut can quit, log out or delete.", irreversible_intent: "This step looks like it sends, buys, deletes or publishes something." },
  },
  tr: {
    label: "Kiiri bilgisayarını kullanıyor",
    step: (n, max) => `adım ${n}/${max}`,
    pause: "⏸ Duraklat", resume: "▶ Devam", stop: "■ Durdur",
    thinking: "düşünüyor…", paused: "duraklatıldı",
    confirmTitle: "⚠️ Bu adımı kontrol et", askTitle: "❓ Kiiri soruyor",
    allow: "Bu adıma izin ver", deny: "Reddet — durdur",
    escHint: "Esc durdurur",
    risk: { blocked_app: "Bu uygulama gizli bilgi ya da sistem ayarı tutuyor — burada bir şey yapmadan önce soruyorum.", banking: "Bu bir bankacılık ya da ödeme işlemine benziyor.", secret_field: "Bu adım şifre ya da gizli bir alana yazıyor.", dangerous_shortcut: "Bu kısayol uygulamayı kapatabilir, oturumu kapatabilir ya da bir şey silebilir.", irreversible_intent: "Bu adım bir şey gönderiyor, satın alıyor, siliyor ya da yayınlıyor gibi görünüyor." },
  },
  ko: {
    label: "Kiiri가 컴퓨터를 사용하는 중",
    step: (n, max) => `${n}/${max} 단계`,
    pause: "⏸ 일시정지", resume: "▶ 계속", stop: "■ 중지",
    thinking: "생각 중…", paused: "일시정지됨",
    confirmTitle: "⚠️ 이 단계를 확인하세요", askTitle: "❓ Kiiri의 질문",
    allow: "이 단계 허용", deny: "거부 — 중지",
    escHint: "Esc로 중지",
    risk: { blocked_app: "이 앱은 비밀 정보나 시스템 설정을 다뤄요 — 여기서는 먼저 물어볼게요.", banking: "은행 업무나 결제처럼 보여요.", secret_field: "비밀번호 같은 민감한 칸에 입력하려고 해요.", dangerous_shortcut: "이 단축키는 앱 종료, 로그아웃, 삭제를 할 수 있어요.", irreversible_intent: "이 단계는 무언가를 보내거나, 구매하거나, 삭제하거나, 게시하는 것 같아요." },
  },
  ja: {
    label: "Kiiri がパソコンを操作中",
    step: (n, max) => `ステップ ${n}/${max}`,
    pause: "⏸ 一時停止", resume: "▶ 再開", stop: "■ 停止",
    thinking: "考え中…", paused: "一時停止中",
    confirmTitle: "⚠️ このステップを確認", askTitle: "❓ Kiiri からの確認",
    allow: "このステップを許可", deny: "拒否して停止",
    escHint: "Esc で停止",
    risk: { blocked_app: "このアプリは秘密情報やシステム設定を扱います — 操作の前に確認します。", banking: "銀行取引や支払いのようです。", secret_field: "パスワードなどの秘密の欄に入力しようとしています。", dangerous_shortcut: "このショートカットは終了・ログアウト・削除を行う可能性があります。", irreversible_intent: "このステップは送信・購入・削除・投稿のように見えます。" },
  },
};

let lang = "en";
let state = { step: 0, maxSteps: 30, paused: false, phase: "thinking", summary: "" };
let confirmId = null;

function L(key, ...args) {
  const v = (I18N[lang] || I18N.en)[key] || I18N.en[key] || key;
  return typeof v === "function" ? v(...args) : v;
}

function render() {
  $("label").textContent = L("label");
  $("steps").textContent = L("step", state.step || 0, state.maxSteps || 30);
  $("phase").textContent = state.paused ? L("paused") : state.phase === "thinking" ? L("thinking") : "";
  $("pause").textContent = state.paused ? L("resume") : L("pause");
  $("stop").textContent = L("stop");
  $("stop").title = L("escHint");
  $("allow").textContent = L("allow");
  $("deny").textContent = L("deny");
  document.body.classList.toggle("paused", !!state.paused);
}

api.onState((s) => { state = { ...state, ...(s || {}) }; render(); });

api.onConfirm((c) => {
  confirmId = c.id;
  $("confirm-title").textContent = c.kind === "model" ? L("askTitle") : L("confirmTitle");
  const riskText = (I18N[lang] || I18N.en).risk || I18N.en.risk;
  $("confirm-reason").textContent = c.kind === "model" ? c.question : (riskText[c.category] || c.reason);
  $("confirm-summary").textContent = c.kind === "model" ? "" : [c.app, c.summary].filter(Boolean).join(" · ");
  $("confirm").hidden = false;
});
api.onConfirmClear(() => { confirmId = null; $("confirm").hidden = true; });

$("allow").addEventListener("click", () => { if (confirmId) api.answer(confirmId, true); });
$("deny").addEventListener("click", () => { if (confirmId) api.answer(confirmId, false); });
$("pause").addEventListener("click", () => api.pause(!state.paused));
$("stop").addEventListener("click", () => api.stop());

// The strip is click-through except while the pointer is over the card, so it
// never blocks the app underneath (main also forces click-through around every
// synthetic pointer action).
const card = $("card");
card.addEventListener("mouseenter", () => api.hover(true));
card.addEventListener("mouseleave", () => api.hover(false));

(async () => {
  try { const l = await api.languageGet(); if (I18N[l]) lang = l; } catch {}
  render();
})();
