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

async function submitCommand(text) {
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
