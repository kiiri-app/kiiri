"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

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
  respBusyLabel.textContent = label || "Düşünüyorum…";
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
      openBtn.textContent = "Klasörü aç";
      openBtn.addEventListener("click", () => api.agentOpen(r.path));
      const undoBtn = document.createElement("button");
      undoBtn.className = "ghost-btn";
      undoBtn.textContent = "Geri al";
      undoBtn.addEventListener("click", async () => {
        const res = await api.agentUndo({ ledgerId: r.ledgerId, filePath: r.path });
        if (res && res.ok) {
          undoBtn.textContent = "Geri alındı";
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
      item.textContent = `✕ ${r.type}: ${r.message || "hata"}`;
    }
    resultList.appendChild(item);
  }
  resp.hidden = false;
  respResult.hidden = false;
  syncSize();
}

async function submitCommand(text) {
  showBusy("Düşünüyorum…");
  const res = await api.agentRun(text);
  if (!res || res.error) {
    showText((res && res.message) || "Hata oluştu.");
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
  showBusy("Oluşturuyorum…");
  const res = await api.agentApprove(currentPlanId);
  currentPlanId = null;
  if (res && res.ok) showResults(res.results);
  else showText((res && res.message) || "Çalıştırılamadı.");
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
    empty.textContent = "Henüz skill yok. Aşağıdan tarif ederek oluştur.";
    skillsListEl.appendChild(empty);
  }
  for (const s of skills) {
    const item = document.createElement("div");
    item.className = "skill-item";
    item.innerHTML = `<span class="si-emoji"></span>
      <div class="si-main"><div class="si-name"></div><div class="si-trig"></div></div>
      <button class="si-del" aria-label="Sil">×</button>`;
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
  btn.textContent = "Oluşturuluyor…";
  const res = await api.skillAuthor(desc);
  btn.disabled = false;
  btn.textContent = "Oluştur";
  if (res && res.ok) {
    draftSkill = res.skill;
    skillDraft.querySelector(".draft-emoji").textContent = res.skill.emoji || "✨";
    skillDraft.querySelector(".draft-name").textContent = res.skill.name;
    skillDraft.querySelector(".draft-triggers").innerHTML = `<b>Tetikler:</b> ${(res.skill.triggers || []).join(", ")}`;
    skillDraft.querySelector(".draft-tools").innerHTML = `<b>Araçlar:</b> ${(res.skill.tools || []).join(", ")}`;
    skillDraft.querySelector(".draft-instruction").textContent = res.skill.instruction;
    skillDraft.hidden = false;
  } else {
    draftSkill = null;
    skillDraft.hidden = true;
    alert((res && res.message) || "Skill oluşturulamadı.");
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

loadChips();
syncSize();
