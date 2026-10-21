"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    windowTitle: "Give Kiri a command",
    titlebar: "🐾 Give Kiri a command",
    close: "Close",
    tabCommand: "Command",
    tabSkills: "Skills",
    commandPlaceholder: "What should I do? (e.g. make a 5-slide deck about AI)",
    send: "Send",
    thinking: "Thinking…",
    cancel: "Cancel",
    planTitle: "Here's what I'll do:",
    approve: "Approve",
    webSources: (n) => `🔎 Searched the web · ${n} source${n === 1 ? "" : "s"}`,
    creating: "Creating…",
    runFailed: "Couldn't run it.",
    errorGeneric: "Something went wrong.",
    openFolder: "Open folder",
    undo: "Undo",
    undone: "Undone",
    errorWord: "error",
    noSkills: "No skills yet. Describe one below to create it.",
    deleteAria: "Delete",
    newSkillHeading: "New skill — describe it",
    newSkillHint: "E.g. \"When I say 'make slides', create a PowerPoint on the topic I give and save it.\"",
    skillDescPlaceholder: "Describe the skill in plain words…",
    create: "Create",
    discard: "Discard",
    save: "Save",
    triggersLabel: "Triggers:",
    toolsLabel: "Tools:",
    skillCreateFailed: "Couldn't create the skill.",
    modeComputer: "🖱 On my computer",
    cuPlanning: "Looking at your screen…",
    cuPlanTitle: "I'll do this on your computer:",
    cuPlanHint: (n) => `Up to ${n} steps · I'll ask before anything risky · Esc or ■ Stop ends it`,
    cuApprove: "Approve & start",
    cuRunning: "Working on your computer…",
    cuPermTitle: "One permission first",
    cuOpenSettings: "Open System Settings",
    cuLogTitle: (n) => `What I did (${n} step${n === 1 ? "" : "s"})`,
    cuAllowed: "allowed", cuDenied: "denied",
    cuStatus: { done: "✓ Done", denied: "Stopped — you said no", stopped: "Stopped", step_limit: "Stopped — reached the step limit", time_limit: "Stopped — 8-minute limit", errors: "Stopped — 3 errors in a row", refused: "Declined", error: "Failed" },
    cuErr: {
      disabled: "The AI Assistant is off — turn it on in settings.",
      cu_disabled: "\"Do it on my computer\" is off — turn it on in AI Assistant settings.",
      no_key: "Add your Anthropic API key or sign in to Kiiri Cloud first.",
      unsupported_provider: "Computer use works with Claude (your Anthropic key) or Kiiri Cloud. Switch the provider in AI Assistant settings.",
      plan_required: "Computer use is part of Kiiri Plus.",
      accessibility: "To move the mouse and type for you, Kiiri needs the Accessibility permission. Open System Settings → Privacy & Security → Accessibility, turn on Kiiri, then send the task again.",
      screen_permission: "Kiiri needs the Screen Recording permission to see your screen (System Settings → Privacy & Security → Screen Recording).",
      platform: "Computer use isn't supported on this system.",
      busy: "I'm already using the computer — stop that run first.",
      expired: "This plan expired — send the task again.",
    },
    cuRefused: "I won't do that one:",
  },
  tr: {
    windowTitle: "Kiri'ye komut ver",
    titlebar: "🐾 Kiri'ye komut ver",
    close: "Kapat",
    tabCommand: "Komut",
    tabSkills: "Skiller",
    commandPlaceholder: "Ne yapayım? (ör. yapay zeka hakkında 5 slaytlık sunum yap)",
    send: "Gönder",
    thinking: "Düşünüyorum…",
    cancel: "İptal",
    planTitle: "Şunu yapacağım:",
    approve: "Onayla",
    webSources: (n) => `🔎 Web'de arandı · ${n} kaynak`,
    creating: "Oluşturuyorum…",
    runFailed: "Çalıştırılamadı.",
    errorGeneric: "Hata oluştu.",
    openFolder: "Klasörü aç",
    undo: "Geri al",
    undone: "Geri alındı",
    errorWord: "hata",
    noSkills: "Henüz skill yok. Aşağıdan tarif ederek oluştur.",
    deleteAria: "Sil",
    newSkillHeading: "Yeni skill — tarif et",
    newSkillHint: "Örn: \"Sana 'sunum yap' dediğimde verdiğim konuda bir PowerPoint oluştur ve kaydet.\"",
    skillDescPlaceholder: "Skill'i doğal dille tarif et…",
    create: "Oluştur",
    discard: "Vazgeç",
    save: "Kaydet",
    triggersLabel: "Tetikler:",
    toolsLabel: "Araçlar:",
    skillCreateFailed: "Skill oluşturulamadı.",
    modeComputer: "🖱 Bilgisayarımda",
    cuPlanning: "Ekranına bakıyorum…",
    cuPlanTitle: "Bilgisayarında şunu yapacağım:",
    cuPlanHint: (n) => `En fazla ${n} adım · Riskli bir şeyden önce sorarım · Esc ya da ■ Durdur ile bitir`,
    cuApprove: "Onayla ve başla",
    cuRunning: "Bilgisayarında çalışıyorum…",
    cuPermTitle: "Önce bir izin gerekiyor",
    cuOpenSettings: "Sistem Ayarları'nı aç",
    cuLogTitle: (n) => `Yaptıklarım (${n} adım)`,
    cuAllowed: "izin verildi", cuDenied: "reddedildi",
    cuStatus: { done: "✓ Tamamlandı", denied: "Durdu — reddettin", stopped: "Durduruldu", step_limit: "Durdu — adım sınırına geldim", time_limit: "Durdu — 8 dakika sınırı", errors: "Durdu — üst üste 3 hata", refused: "Reddedildi", error: "Başarısız" },
    cuErr: {
      disabled: "AI Asistan kapalı — ayarlardan aç.",
      cu_disabled: "\"Bilgisayarımda yap\" kapalı — AI Asistan ayarlarından aç.",
      no_key: "Önce Anthropic API anahtarını gir ya da Kiiri Cloud'a giriş yap.",
      unsupported_provider: "Bilgisayar kullanımı Claude (Anthropic anahtarın) ya da Kiiri Cloud ile çalışır. Sağlayıcıyı AI Asistan ayarlarından değiştir.",
      plan_required: "Bilgisayar kullanımı Kiiri Plus'a dahil.",
      accessibility: "Fareyi oynatıp senin yerine yazabilmem için Erişilebilirlik izni gerekiyor. Sistem Ayarları → Gizlilik ve Güvenlik → Erişilebilirlik'ten Kiiri'yi aç, sonra görevi yeniden gönder.",
      screen_permission: "Ekranını görebilmem için Ekran Kaydı izni gerekiyor (Sistem Ayarları → Gizlilik ve Güvenlik → Ekran Kaydı).",
      platform: "Bu sistemde bilgisayar kullanımı desteklenmiyor.",
      busy: "Zaten bilgisayarı kullanıyorum — önce onu durdur.",
      expired: "Planın süresi doldu — görevi yeniden gönder.",
    },
    cuRefused: "Bunu yapmayacağım:",
  },
  ko: {
    windowTitle: "Kiri에게 명령하기",
    titlebar: "🐾 Kiri에게 명령하기",
    close: "닫기",
    tabCommand: "명령",
    tabSkills: "스킬",
    commandPlaceholder: "뭘 할까냥? (예: 인공지능에 대한 슬라이드 5장 만들기)",
    send: "보내기",
    thinking: "생각 중이다냥…",
    cancel: "취소",
    planTitle: "이렇게 할 거다냥:",
    approve: "승인",
    webSources: (n) => `🔎 웹 검색 · 출처 ${n}개`,
    creating: "만드는 중이다냥…",
    runFailed: "실행하지 못했어요.",
    errorGeneric: "문제가 생겼다냥.",
    openFolder: "폴더 열기",
    undo: "되돌리기",
    undone: "되돌렸어요",
    errorWord: "오류",
    noSkills: "아직 스킬이 없어요. 아래에서 설명해서 만들어 보세요.",
    deleteAria: "삭제",
    newSkillHeading: "새 스킬 — 설명하기",
    newSkillHint: "예: \"'발표자료 만들어'라고 하면 내가 준 주제로 PowerPoint를 만들어 저장해.\"",
    skillDescPlaceholder: "스킬을 자연스러운 말로 설명해 주세요…",
    create: "만들기",
    discard: "취소",
    save: "저장",
    triggersLabel: "트리거:",
    toolsLabel: "도구:",
    skillCreateFailed: "스킬을 만들지 못했어요.",
    modeComputer: "🖱 내 컴퓨터에서",
    cuPlanning: "화면을 보는 중이다냥…",
    cuPlanTitle: "컴퓨터에서 이렇게 할 거다냥:",
    cuPlanHint: (n) => `최대 ${n}단계 · 위험한 단계 전에는 물어볼게요 · Esc 또는 ■ 중지로 끝내기`,
    cuApprove: "승인하고 시작",
    cuRunning: "컴퓨터에서 작업 중이다냥…",
    cuPermTitle: "먼저 권한이 필요해요",
    cuOpenSettings: "시스템 설정 열기",
    cuLogTitle: (n) => `한 일 (${n}단계)`,
    cuAllowed: "허용됨", cuDenied: "거부됨",
    cuStatus: { done: "✓ 완료", denied: "중지 — 거부함", stopped: "중지됨", step_limit: "중지 — 단계 한도 도달", time_limit: "중지 — 8분 한도", errors: "중지 — 연속 3번 오류", refused: "거절됨", error: "실패" },
    cuErr: {
      disabled: "AI 어시스턴트가 꺼져 있어요 — 설정에서 켜 주세요.",
      cu_disabled: "\"내 컴퓨터에서 하기\"가 꺼져 있어요 — AI 어시스턴트 설정에서 켜 주세요.",
      no_key: "먼저 Anthropic API 키를 입력하거나 Kiiri Cloud에 로그인해 주세요.",
      unsupported_provider: "컴퓨터 사용은 Claude(내 Anthropic 키) 또는 Kiiri Cloud에서만 돼요. AI 어시스턴트 설정에서 제공자를 바꿔 주세요.",
      plan_required: "컴퓨터 사용은 Kiiri Plus에 포함돼요.",
      accessibility: "마우스를 움직이고 대신 입력하려면 손쉬운 사용 권한이 필요해요. 시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 Kiiri를 켠 뒤 다시 보내 주세요.",
      screen_permission: "화면을 보려면 화면 기록 권한이 필요해요 (시스템 설정 → 개인정보 보호 및 보안 → 화면 기록).",
      platform: "이 시스템에서는 컴퓨터 사용을 지원하지 않아요.",
      busy: "이미 컴퓨터를 사용 중이에요 — 먼저 중지해 주세요.",
      expired: "계획이 만료됐어요 — 다시 보내 주세요.",
    },
    cuRefused: "이건 하지 않을게요:",
  },
  ja: {
    windowTitle: "Kiri に指示する",
    titlebar: "🐾 Kiri に指示する",
    close: "閉じる",
    tabCommand: "コマンド",
    tabSkills: "スキル",
    commandPlaceholder: "何をするにゃ？（例: AIについて5枚のスライドを作って）",
    send: "送信",
    thinking: "考え中だにゃ…",
    cancel: "キャンセル",
    planTitle: "こうするにゃ:",
    approve: "承認",
    webSources: (n) => `🔎 Web を検索 · 出典 ${n} 件`,
    creating: "作成中だにゃ…",
    runFailed: "実行できませんでした。",
    errorGeneric: "エラーが起きたにゃ。",
    openFolder: "フォルダを開く",
    undo: "元に戻す",
    undone: "元に戻しました",
    errorWord: "エラー",
    noSkills: "スキルはまだありません。下で説明して作成してください。",
    deleteAria: "削除",
    newSkillHeading: "新しいスキル — 説明する",
    newSkillHint: "例: 「『スライド作って』と言ったら、指定したテーマで PowerPoint を作成して保存して。」",
    skillDescPlaceholder: "スキルを自然な言葉で説明してください…",
    create: "作成",
    discard: "破棄",
    save: "保存",
    triggersLabel: "トリガー:",
    toolsLabel: "ツール:",
    skillCreateFailed: "スキルを作成できませんでした。",
    modeComputer: "🖱 パソコンで",
    cuPlanning: "画面を見ているにゃ…",
    cuPlanTitle: "パソコンでこうするにゃ:",
    cuPlanHint: (n) => `最大 ${n} ステップ · 危ない操作の前に確認します · Esc か ■ 停止で終了`,
    cuApprove: "承認して開始",
    cuRunning: "パソコンを操作中だにゃ…",
    cuPermTitle: "先に許可が必要です",
    cuOpenSettings: "システム設定を開く",
    cuLogTitle: (n) => `やったこと（${n} ステップ）`,
    cuAllowed: "許可", cuDenied: "拒否",
    cuStatus: { done: "✓ 完了", denied: "停止 — 拒否されました", stopped: "停止しました", step_limit: "停止 — ステップ上限", time_limit: "停止 — 8 分の上限", errors: "停止 — 3 回連続エラー", refused: "辞退しました", error: "失敗" },
    cuErr: {
      disabled: "AI アシスタントがオフです — 設定でオンにしてください。",
      cu_disabled: "「パソコンで実行」がオフです — AI アシスタント設定でオンにしてください。",
      no_key: "先に Anthropic API キーを入力するか、Kiiri Cloud にサインインしてください。",
      unsupported_provider: "パソコン操作は Claude（自分の Anthropic キー）か Kiiri Cloud で使えます。AI アシスタント設定でプロバイダを切り替えてください。",
      plan_required: "パソコン操作は Kiiri Plus の機能です。",
      accessibility: "マウス操作や入力を代わりに行うには「アクセシビリティ」の許可が必要です。システム設定 → プライバシーとセキュリティ → アクセシビリティで Kiiri をオンにして、もう一度送ってください。",
      screen_permission: "画面を見るには「画面収録」の許可が必要です（システム設定 → プライバシーとセキュリティ → 画面収録）。",
      platform: "このシステムではパソコン操作に対応していません。",
      busy: "すでにパソコンを操作中です — 先に停止してください。",
      expired: "プランの期限が切れました — もう一度送ってください。",
    },
    cuRefused: "これはやめておきます:",
  },
};

let lang = "en";
function L(key, ...args) {
  const table = I18N[lang] || I18N.en;
  const v = table[key] || I18N.en[key] || key;
  return typeof v === "function" ? v(...args) : v;
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = L(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", L(node.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => { node.setAttribute("placeholder", L(node.dataset.i18nPh)); });
}

const commandTab = $("command-tab");
const skillsTab = $("skills-tab");
const tabCommand = $("tab-command");
const tabSkills = $("tab-skills");

const skillChips = $("skill-chips");
const commandForm = $("command-form");
const commandInput = $("command-input");

const resp = $("resp");
const respBusy = $("resp-busy");
const respBusyLabel = $("resp-busy-label");
const respText = $("resp-text");
const respPlan = $("resp-plan");
const planList = $("plan-list");
const planSources = $("plan-sources");
const planSourcesTitle = $("plan-sources-title");
const planSourcesList = $("plan-sources-list");
const respResult = $("resp-result");
const resultList = $("result-list");

let currentPlanId = null;

function syncSize() {
  requestAnimationFrame(() => {
    const h = Math.ceil(document.body.scrollHeight);
    api.resizeCommand({ height: h });
  });
}

function hideAll() {
  resp.hidden = true;
  respBusy.hidden = true;
  respText.hidden = true;
  respPlan.hidden = true;
  respResult.hidden = true;
  for (const id of ["resp-cu-plan", "resp-cu-result", "resp-cu-perm"]) {
    const node = document.getElementById(id);
    if (node) node.hidden = true;
  }
}

function showBusy(label) {
  hideAll();
  resp.hidden = false;
  respBusy.hidden = false;
  respBusyLabel.textContent = label || L("thinking");
  syncSize();
}

function showText(text) {
  hideAll();
  resp.hidden = false;
  respText.hidden = false;
  respText.textContent = text;
  syncSize();
}

function showPlan(data) {
  hideAll();
  currentPlanId = data.planId;
  planList.innerHTML = "";
  for (const a of data.actions) {
    const li = document.createElement("li");
    li.textContent = a.summary || a.type;
    planList.appendChild(li);
  }
  // Pages the agent read on the web — plain text (title · host), not links.
  const sources = Array.isArray(data.sources) ? data.sources : [];
  planSourcesList.innerHTML = "";
  for (const src of sources.slice(0, 6)) {
    const li = document.createElement("li");
    let host = "";
    try { host = new URL(src.url).hostname.replace(/^www\./, ""); } catch {}
    li.textContent = host ? `${src.title} · ${host}` : src.title;
    planSourcesList.appendChild(li);
  }
  planSourcesTitle.textContent = L("webSources", sources.length);
  planSources.hidden = !sources.length;
  resp.hidden = false;
  respPlan.hidden = false;
  syncSize();
}

function showResults(results) {
  hideAll();
  resultList.innerHTML = "";
  for (const r of results) {
    const item = document.createElement("div");
    item.className = "result-item" + (r.ok ? "" : " err");
    if (r.ok) {
      const name = document.createElement("div");
      name.className = "ri-name";
      name.textContent = `✓ ${r.name}`;
      const p = document.createElement("div");
      p.className = "ri-path";
      p.textContent = r.path;
      const actions = document.createElement("div");
      actions.className = "ri-actions";
      const openBtn = document.createElement("button");
      openBtn.className = "primary-btn";
      openBtn.textContent = L("openFolder");
      openBtn.addEventListener("click", () => api.agentOpen(r.path));
      const undoBtn = document.createElement("button");
      undoBtn.className = "ghost-btn";
      undoBtn.textContent = L("undo");
      undoBtn.addEventListener("click", async () => {
        const res = await api.agentUndo({ ledgerId: r.ledgerId, filePath: r.path });
        if (res && res.ok) {
          undoBtn.textContent = L("undone");
          undoBtn.disabled = true;
          openBtn.disabled = true;
        }
      });
      actions.appendChild(openBtn);
      actions.appendChild(undoBtn);
      item.appendChild(name);
      item.appendChild(p);
      item.appendChild(actions);
    } else {
      item.textContent = `✕ ${r.type}: ${r.message || L("errorWord")}`;
    }
    resultList.appendChild(item);
  }
  resp.hidden = false;
  respResult.hidden = false;
  syncSize();
}

// ---- Computer use ----
const modeToggle = $("mode-toggle");
const respCuPlan = $("resp-cu-plan");
const respCuResult = $("resp-cu-result");
const respCuPerm = $("resp-cu-perm");
let computerMode = false;
let currentRunId = null;
let cuPlanning = false;

function setComputerMode(on) {
  computerMode = !!on;
  modeToggle.setAttribute("aria-pressed", computerMode ? "true" : "false");
}
modeToggle.addEventListener("click", () => { setComputerMode(!computerMode); commandInput.focus(); });

function cuErrorText(res) {
  const map = L("cuErr");
  return (map && map[res.error]) || res.message || L("errorGeneric");
}

function showCuPermission(text) {
  hideAll();
  $("cu-perm-text").textContent = text;
  resp.hidden = false;
  respCuPerm.hidden = false;
  syncSize();
}

function showCuPlan(res) {
  hideAll();
  currentRunId = res.runId;
  $("cu-plan-text").textContent = res.plan;
  $("cu-plan-hint").textContent = L("cuPlanHint", res.maxSteps || 30);
  resp.hidden = false;
  respCuPlan.hidden = false;
  syncSize();
}

function showCuResult(res) {
  hideAll();
  const status = $("cu-status");
  const labels = L("cuStatus");
  status.textContent = (labels && labels[res.status]) || res.status || "";
  status.className = "cu-status " + (res.status === "done" ? "ok" : "bad");
  const extra = res.error && res.error !== "error" ? cuErrorText(res) : "";
  $("cu-text").textContent = [res.text, extra].filter(Boolean).join("\n\n");
  const log = Array.isArray(res.log) ? res.log : [];
  const list = $("cu-log");
  list.innerHTML = "";
  for (const e of log) {
    const li = document.createElement("li");
    let line = e.summary || e.name;
    if (e.risk || e.name === "confirm_with_user") line += ` — ⚠️ ${e.confirmed ? L("cuAllowed") : L("cuDenied")}`;
    if (!e.ok && e.error && e.name !== "confirm_with_user") line += ` — ✕ ${e.error}`;
    li.textContent = line;
    if (!e.ok && e.name !== "confirm_with_user") li.className = "err";
    else if (e.risk) li.className = "risk";
    list.appendChild(li);
  }
  $("cu-log-title").textContent = L("cuLogTitle", res.steps || 0);
  $("cu-log-wrap").hidden = !log.length;
  resp.hidden = false;
  respCuResult.hidden = false;
  syncSize();
}

async function submitComputer(text) {
  showBusy(L("cuPlanning"));
  cuPlanning = true;
  const res = await api.computerPlan(text);
  cuPlanning = false;
  if (!res) return showText(L("errorGeneric"));
  if (res.error === "accessibility") return showCuPermission(cuErrorText(res));
  if (res.error) return showText(cuErrorText(res));
  if (res.type === "refused") return showText(res.text ? `${L("cuRefused")} ${res.text}` : L("errorGeneric"));
  if (res.type === "computer-plan") return showCuPlan(res);
  showText(L("errorGeneric"));
}

$("cu-approve").addEventListener("click", async () => {
  const runId = currentRunId;
  currentRunId = null;
  if (!runId) return;
  showBusy(L("cuRunning"));
  const res = await api.computerStart(runId);
  if (!res) return showText(L("errorGeneric"));
  if (res.error === "accessibility") return showCuPermission(cuErrorText(res));
  if (!res.status) return showText(cuErrorText(res));
  showCuResult(res);
});
$("cu-reject").addEventListener("click", () => {
  currentRunId = null;
  api.computerCancel();
  hideAll();
  syncSize();
});
$("cu-open-settings").addEventListener("click", () => api.computerOpenAccessibility());
if (api.onCommandMode) {
  api.onCommandMode((mode) => {
    selectTab("command");
    setComputerMode(mode === "computer");
    commandInput.focus();
  });
}

async function submitCommand(text) {
  // Computer use: the toggle, or an explicit "/pc …" / "on my computer …"
  // phrasing. File-generation commands stay with the command agent.
  let routed = null;
  try { routed = await api.computerDetect(text); } catch {}
  if (computerMode || (routed && routed.computer)) {
    return submitComputer((routed && routed.text) || text);
  }
  showBusy(L("thinking"));
  const res = await api.agentRun(text);
  if (!res || res.error) {
    showText((res && res.message) || L("errorGeneric"));
    return;
  }
  if (res.type === "text") {
    showText(res.text);
  } else if (res.type === "plan") {
    showPlan(res);
  }
}

commandForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = commandInput.value.trim();
  if (text) submitCommand(text);
});

$("resp-cancel").addEventListener("click", () => {
  if (cuPlanning) { cuPlanning = false; api.computerCancel(); }
  api.agentCancel(currentPlanId);
  hideAll();
  syncSize();
});

$("plan-approve").addEventListener("click", async () => {
  showBusy(L("creating"));
  const res = await api.agentApprove(currentPlanId);
  currentPlanId = null;
  if (res && res.ok) showResults(res.results);
  else showText((res && res.message) || L("runFailed"));
});

$("plan-reject").addEventListener("click", () => {
  api.agentCancel(currentPlanId);
  currentPlanId = null;
  hideAll();
  syncSize();
});

// ---- Skill chips ----
async function loadChips() {
  const skills = await api.skillsList();
  skillChips.innerHTML = "";
  for (const s of skills) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = `${s.emoji || "✨"} ${s.name}`;
    chip.addEventListener("click", () => {
      const trig = (s.triggers && s.triggers[0]) || s.name;
      commandInput.value = trig + " ";
      commandInput.focus();
    });
    skillChips.appendChild(chip);
  }
  syncSize();
}

// ---- Tabs ----
function selectTab(which) {
  const isCmd = which === "command";
  tabCommand.classList.toggle("active", isCmd);
  tabSkills.classList.toggle("active", !isCmd);
  commandTab.hidden = !isCmd;
  skillsTab.hidden = isCmd;
  if (!isCmd) loadSkills();
  else loadChips();
  syncSize();
}
tabCommand.addEventListener("click", () => selectTab("command"));
tabSkills.addEventListener("click", () => selectTab("skills"));

// ---- Skills tab ----
const skillsListEl = $("skills-list");
const skillDesc = $("skill-desc");
const skillDraft = $("skill-draft");
let draftSkill = null;

async function loadSkills() {
  const skills = await api.skillsList();
  skillsListEl.innerHTML = "";
  if (!skills.length) {
    const empty = document.createElement("div");
    empty.className = "skills-empty";
    empty.textContent = L("noSkills");
    skillsListEl.appendChild(empty);
  }
  for (const s of skills) {
    const item = document.createElement("div");
    item.className = "skill-item";
    item.innerHTML = `<span class="si-emoji"></span>
      <div class="si-main"><div class="si-name"></div><div class="si-trig"></div></div>
      <button class="si-del">×</button>`;
    item.querySelector(".si-del").setAttribute("aria-label", L("deleteAria"));
    item.querySelector(".si-emoji").textContent = s.emoji || "✨";
    item.querySelector(".si-name").textContent = s.name;
    item.querySelector(".si-trig").textContent = (s.triggers || []).join(", ");
    item.querySelector(".si-del").addEventListener("click", async () => {
      await api.skillDelete(s.id);
      loadSkills();
    });
    skillsListEl.appendChild(item);
  }
  syncSize();
}

$("skill-author-btn").addEventListener("click", async () => {
  const desc = skillDesc.value.trim();
  if (!desc) return;
  const btn = $("skill-author-btn");
  btn.disabled = true;
  btn.textContent = L("creating");
  const res = await api.skillAuthor(desc);
  btn.disabled = false;
  btn.textContent = L("create");
  if (res && res.ok) {
    draftSkill = res.skill;
    skillDraft.querySelector(".draft-emoji").textContent = res.skill.emoji || "✨";
    skillDraft.querySelector(".draft-name").textContent = res.skill.name;
    skillDraft.querySelector(".draft-triggers").innerHTML = `<b>${L("triggersLabel")}</b> ${(res.skill.triggers || []).join(", ")}`;
    skillDraft.querySelector(".draft-tools").innerHTML = `<b>${L("toolsLabel")}</b> ${(res.skill.tools || []).join(", ")}`;
    skillDraft.querySelector(".draft-instruction").textContent = res.skill.instruction;
    skillDraft.hidden = false;
  } else {
    draftSkill = null;
    skillDraft.hidden = true;
    alert((res && res.message) || L("skillCreateFailed"));
  }
  syncSize();
});

$("draft-save").addEventListener("click", async () => {
  if (!draftSkill) return;
  await api.skillSave(draftSkill);
  draftSkill = null;
  skillDraft.hidden = true;
  skillDesc.value = "";
  loadSkills();
});
$("draft-discard").addEventListener("click", () => {
  draftSkill = null;
  skillDraft.hidden = true;
  syncSize();
});

$("close-btn").addEventListener("click", () => api.closeCommand());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") api.closeCommand();
});

// Voice transcript arriving from the cat's mic button → run it.
if (api.onVoiceRun) {
  api.onVoiceRun((text) => {
    const t = String(text || "").trim();
    if (!t) return;
    selectTab("command");
    commandInput.value = t;
    submitCommand(t);
  });
}

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
  loadChips();
  syncSize();
})();
