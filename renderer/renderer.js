"use strict";

// Kiri pet window renderer. Characters are pose-set art (kiri / tori: idle
// PNG + sprite strips, see pose-manifest.js) or community petdex sheets.
// Cursor offsets from main drive the pupils + lean; left-drag moves the
// window (IPC drag-window); right-click opens the context menu.

const MAX_RAW_DIST_PX = 400;

// Pose-set characters (kiri / tori): flat per-state PNG art swapped via <img>,
// "eyes follow" faked as a whole-body lean toward the cursor, plus a painted
// pixel overlay composited over the idle pose.
const posesetEl = document.getElementById("poseset");
// Community pet (petdex/agentpets sprite sheet) render state.
const petdexEl = document.getElementById("petdex");
let petdexMode = false;
let petdexPet = null;      // {url, columns, rows, frameWidth, frameHeight, frames, fps}
let petdexImage = null;
let petdexTimer = null;
let petdexFrame = 0;
let petdexRow = 0;
const poseEls = posesetEl ? { noeye: posesetEl.querySelector("#pose-noeye") } : null;
// Every other state is one horizontal sprite strip (svg/<set>_<state>.png)
// shown through a <div> via background-position. Geometry, frame counts, frame
// groups and pupil positions come from window.POSE_MANIFEST, generated together
// with the strips by scripts/build-pose-sheets.py (`npm run build:poses`).
// All strips of a set share the idle canvas' coordinate system, so one layout
// rule places every state with no per-pose special cases.
const POSE_STATES = ["move", "listening", "working", "happy"];
const poseAnimEls = posesetEl ? Object.fromEntries(
  POSE_STATES.map((st) => [st, posesetEl.querySelector(`#pose-${st}`)])) : null;
// Playback per state. "move" picks its frames from the drag (see poseMoveFrame).
const POSE_PLAY = {
  working:   { fps: 2.2 },
  listening: { fps: 0 },
  happy:     { fps: 0 },
};
const POSE_MOVE_FPS = { hang: 2.4, side: 7 };
let poseAnimState = null;   // currently animating state name, or null
let poseAnimStartedAt = 0;  // performance.now() when it began
let poseAnimRaf = null;
let poseAnimFrameShown = -1;
const poseOverlayCanvas = document.getElementById("poseset-overlay");
const posePupilL = document.getElementById("pose-pupil-l");
const posePupilR = document.getElementById("pose-pupil-r");
let poseMode = false;
let poseSet = "kiri";
let poseOverlay = null;
let poseAiActive = false;
let poseListening = false;
let poseListeningTimer = null;
let poseHappy = false;
let poseHappyTimer = null;
let poseLeanR = 0; // smoothed upper-body tilt toward the cursor (deg), feet pinned
const POSE_MAX_LEAN_DEG = 7; // max "hafif" tilt at full cursor offset
let poseEyeX = 0, poseEyeY = 0;
let posePupilTravelPx = 0;
// Drag ("move") state: the body hangs from the grab point and swings like a
// pendulum; a sustained sideways drag switches to the side-view frames,
// mirrored for rightward drags (the art is drawn moving left).
let poseSwayAngle = 0, poseSwayVel = 0;
let poseDragDxAcc = 0;      // horizontal drag px since the last anim tick
let poseDragVx = 0;         // smoothed horizontal drag speed (px/frame)
let poseMoveSide = false;   // showing the side-view group
let poseMoveFlip = false;   // mirrored (dragging right)
const shareNameBadge = document.getElementById("share-name-badge");
const catSpeechBubble = document.getElementById("cat-speech-bubble");
const catThinkingDots = document.getElementById("cat-thinking-dots");
const catNameEditor = document.getElementById("cat-name-editor");
const catNameInput = document.getElementById("cat-name-input");
const catNameCancel = document.getElementById("cat-name-cancel");
const userNameEditor = document.getElementById("user-name-editor");
const userNameGuide = document.getElementById("user-name-guide");
const userNameInput = document.getElementById("user-name-input");
const userNameCancel = document.getElementById("user-name-cancel");
const personaEditor = document.getElementById("persona-editor");
const personaInput = document.getElementById("persona-input");
const personaGuideEl = document.getElementById("persona-guide");
const personaCancel = document.getElementById("persona-cancel");
const fixedMessageEditor = document.getElementById("fixed-message-editor");
const fixedMessageInput = document.getElementById("fixed-message-input");
const fixedMessageCancel = document.getElementById("fixed-message-cancel");
const screenAskEditor = document.getElementById("screen-ask-editor");
const screenAskInput = document.getElementById("screen-ask-input");
const screenAskCancel = document.getElementById("screen-ask-cancel");
const screenAskExamples = document.getElementById("screen-ask-examples");
const reminderClockButton = document.getElementById("reminder-clock-button");
const voiceListenButton = document.getElementById("voice-listen-button");
const reminderPanel = document.getElementById("reminder-panel");
const reminderPanelTitle = document.getElementById("reminder-panel-title");
const reminderForm = document.getElementById("reminder-form");
const reminderTimeInput = document.getElementById("reminder-time-input");
const reminderRepeatInput = document.getElementById("reminder-repeat-input");
const reminderRepeatButtons = document.getElementById("reminder-repeat-buttons");
const reminderDayPicker = document.getElementById("reminder-day-picker");
const reminderMessageInput = document.getElementById("reminder-message-input");
const reminderSaveButton = document.getElementById("reminder-save-button");
const reminderCancelButton = document.getElementById("reminder-cancel-button");
const reminderAddButton = document.getElementById("reminder-add-button");
const reminderPanelClose = document.getElementById("reminder-panel-close");
const reminderListEl = document.getElementById("reminder-list");
const pomodoroFocusEditor = document.getElementById("pomodoro-focus-editor");
const pomodoroFocusInput = document.getElementById("pomodoro-focus-input");
const pomodoroFocusCancel = document.getElementById("pomodoro-focus-cancel");
let targetDx = 0;
let targetDy = 0;
let tickLoopStarted = false; // see startTickLoop()
// Temporary gaze override (screen-answer "look at the pointed element"): while
// active it wins over cursor tracking so the cat looks where it's pointing.
let gazeOverrideUntil = 0;
let gazeOverrideDx = 0;
let gazeOverrideDy = 0;
function setGazeOverride(dx, dy, ms) {
  gazeOverrideDx = Math.max(-1, Math.min(1, dx));
  gazeOverrideDy = Math.max(-1, Math.min(1, dy));
  gazeOverrideUntil = performance.now() + (ms || 3000);
  targetDx = gazeOverrideDx;
  targetDy = gazeOverrideDy;
}
let currentCatName = "Kiri";
let currentUserName = "";
let isCatNameVisible = false;
let speechTimer = null;
let activeSpeechKind = null;
let baseSpeech = null;
let speechLayoutRaf = null;
let currentReminders = [];
let editingReminderId = null;
let currentFixedMessage = "";
let aiTaskStaleTimer = null;
const AI_TASK_STALE_MS = 12 * 60 * 1000; // backstop above main's 10-min session TTL
let mouseEventsEnabled = true;
let currentLanguage = "en";
let currentPomodoroState = null;
let updateCtaState = null;
const completionMeow = new Audio("../workspace/assets/sound/meow.m4a");
const reminderMeow = new Audio("../workspace/assets/sound/meow-alert.m4a");
// Royalty-free synthesized bell — alert for AI-agent (Claude Code) approval
// requests while monitoring. Generated locally with ffmpeg, no licence needed.
const aiDing = new Audio("../workspace/assets/sound/ding.mp3");
aiDing.preload = "auto";
let completionMeowVolume = 0.1;
const reminderMeowVolumeBoost = 2.4;
completionMeow.volume = completionMeowVolume;
completionMeow.preload = "auto";
reminderMeow.volume = getReminderMeowVolume();
reminderMeow.preload = "auto";

const I18N = {
  en: {
    agentComplete: "Task complete!",
    needsAttention: (name) => `${name || "Human"}, needs your attention!`,
    agentApproval: (name, who, project) => `${who || "An agent"}${project ? ` in ${project}` : ""} needs your approval${name ? ", " + name : ""}!`,
    moreWaiting: (n) => ` (+${n} more waiting)`,
    focusLabel: "Focus",
    restLabel: "Break",
    startBreak: (name) => `${name || "Human"}, take a break!`,
    startFocus: (name) => `${name || "Human"}, back to focus!`,
    updateChecking: "Checking...",
    updateAvailable: "Update",
    updateNone: "No updates",
    updateDownloading: (percent) => percent === null ? "Updating..." : `Updating ${percent}%`,
    updateRestarting: "Restarting...",
    userNameGuide: "Tell Kiri your name, and Kiri will call you for reminders and other moments.",
    userNamePlaceholder: "Enter your name",
    userGreeting: (name) => `Hi, ${name}!`,
    pomodoroPause: "Pause",
    pomodoroResume: "Resume",
    pomodoroReset: "Reset",
    reminderOnce: "Once",
    reminderCustomDays: "Choose days",
    reminderDaily: "Daily",
    reminderWeekdays: "Weekdays",
    reminderWeekends: "Weekends",
    reminderDaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    reminderOpen: "Open reminders",
    reminderTitle: "Reminder",
    reminderPanelLabel: "Reminders",
    reminderRepeatGroupLabel: "Repeat",
    reminderDayPickerLabel: "Choose days",
    reminderMessagePlaceholder: "What should Kiri remind you?",
    reminderAdd: "Add",
    reminderCancel: "Cancel",
    reminderSave: "Save",
    reminderUpdate: "Update",
    reminderClose: "Close",
    reminderEmpty: "Add a reminder and Kiri will tell you on time.",
    reminderEdit: "Edit",
    reminderDelete: "Delete",
    personaGuide: "Give this cat a personality — it shapes how it answers in AI tasks.",
    personaPlaceholder: "e.g. a cheerful and concise tutor",
    screenAskPlaceholder: "Ask about your screen…",
    screenAskExamples: ["What does this error mean?", "Summarize this briefly", "What should I do next here?"],
    micDenied: "Couldn't access the microphone.",
    voiceListening: "Listening…",
    stretchNudge: (name) => `${name || "Hey"}, time to stand up and stretch!`,
  },
  ko: {
    agentComplete: "작업 완료냥!",
    needsAttention: (name) => `${name || "집사야"}, 확인이 필요하다냥!`,
    agentApproval: (name, who, project) => `${who || "에이전트"}${project ? ` (${project})` : ""}가 승인을 기다린다냥!`,
    moreWaiting: (n) => ` (+${n}개 대기 중)`,
    focusLabel: "집중냥",
    restLabel: "휴식냥",
    startBreak: (name) => `${name || "집사야"}, 쉬자냥!`,
    startFocus: (name) => `${name || "집사야"}, 다시 집중하자냥!`,
    updateChecking: "업데이트 확인 중...",
    updateAvailable: "업데이트하기",
    updateNone: "최신 버전이다냥",
    updateDownloading: (percent) => percent === null ? "업데이트 중..." : `업데이트 중 ${percent}%`,
    updateRestarting: "재시작 중...",
    userNameGuide: "이름을 알려주면 Kiri가 알림을 주거나 다양한 상황에서 사용자를 불러줄거예요.",
    userNamePlaceholder: "사용자 이름을 입력해주세요",
    userGreeting: (name) => `안녕, ${name}!`,
    pomodoroPause: "일시정지",
    pomodoroResume: "다시 시작",
    pomodoroReset: "초기화",
    reminderOnce: "한 번",
    reminderCustomDays: "요일 선택",
    reminderDaily: "매일",
    reminderWeekdays: "평일",
    reminderWeekends: "주말",
    reminderDaysShort: ["일", "월", "화", "수", "목", "금", "토"],
    reminderOpen: "알림 열기",
    reminderTitle: "알림",
    reminderPanelLabel: "알림장",
    reminderRepeatGroupLabel: "반복 설정",
    reminderDayPickerLabel: "요일 선택",
    reminderMessagePlaceholder: "무엇을 알려줄까냥?",
    reminderAdd: "추가",
    reminderCancel: "취소",
    reminderSave: "저장",
    reminderUpdate: "수정",
    reminderClose: "닫기",
    reminderEmpty: "알림을 등록하면 시간 맞춰 알려주겠다냥.",
    reminderEdit: "수정",
    reminderDelete: "삭제",
    personaGuide: "이 고양이에게 성격을 부여하세요. AI 작업 응답 방식에 반영됩니다.",
    personaPlaceholder: "예: 밝고 간결한 튜터",
    screenAskPlaceholder: "화면에 대해 물어보세요…",
    screenAskExamples: ["이 오류는 무슨 뜻이야?", "이걸 짧게 요약해 줘", "여기서 다음에 뭘 해야 해?"],
    micDenied: "마이크에 접근할 수 없다냥.",
    voiceListening: "듣고 있다냥…",
    stretchNudge: (name) => `${name || "집사야"}, 일어나서 스트레칭하자냥!`,
  },
  ja: {
    agentComplete: "タスク完了にゃ！",
    needsAttention: (name) => `${name ? `${name}さん` : "ご主人"}、確認が必要だにゃ！`,
    agentApproval: (name, who, project) => `${who || "エージェント"}${project ? `（${project}）` : ""}が承認待ちだにゃ！`,
    moreWaiting: (n) => `（ほか${n}件待ち）`,
    focusLabel: "集中にゃ",
    restLabel: "休憩にゃ",
    startBreak: (name) => `${name ? `${name}さん` : "ご主人"}、休憩するにゃ！`,
    startFocus: (name) => `${name ? `${name}さん` : "ご主人"}、また集中するにゃ！`,
    updateChecking: "確認中...",
    updateAvailable: "アップデート",
    updateNone: "最新バージョンだにゃ",
    updateDownloading: (percent) => percent === null ? "アップデート中..." : `アップデート中 ${percent}%`,
    updateRestarting: "再起動中...",
    userNameGuide: "名前を教えると、Kiri が通知やいろいろな場面であなたを呼んでくれます。",
    userNamePlaceholder: "ユーザー名を入力してください",
    userGreeting: (name) => `こんにちは、${name}さん！`,
    pomodoroPause: "一時停止",
    pomodoroResume: "再開",
    pomodoroReset: "リセット",
    reminderOnce: "1回",
    reminderCustomDays: "曜日選択",
    reminderDaily: "毎日",
    reminderWeekdays: "平日",
    reminderWeekends: "週末",
    reminderDaysShort: ["日", "月", "火", "水", "木", "金", "土"],
    reminderOpen: "通知を開く",
    reminderTitle: "通知",
    reminderPanelLabel: "通知",
    reminderRepeatGroupLabel: "繰り返し",
    reminderDayPickerLabel: "曜日選択",
    reminderMessagePlaceholder: "何を知らせるにゃ？",
    reminderAdd: "追加",
    reminderCancel: "キャンセル",
    reminderSave: "保存",
    reminderUpdate: "更新",
    reminderClose: "閉じる",
    reminderEmpty: "通知を登録したら時間に合わせて知らせるにゃ。",
    reminderEdit: "編集",
    reminderDelete: "削除",
    personaGuide: "この猫に性格を与えます。AIタスクでの応答の仕方に反映されます。",
    personaPlaceholder: "例: 明るく簡潔なチューター",
    screenAskPlaceholder: "画面について聞いてください…",
    screenAskExamples: ["このエラーはどういう意味？", "これを短く要約して", "ここで次に何をすればいい？"],
    micDenied: "マイクにアクセスできないにゃ。",
    voiceListening: "聞いてるにゃ…",
    stretchNudge: (name) => `${name ? `${name}さん` : "ご主人"}、立ってストレッチするにゃ！`,
  },
  tr: {
    agentComplete: "Görev tamam, miyav!",
    needsAttention: (name) => `${name || "Dostum"}, bir bakman lazım!`,
    agentApproval: (name, who, project) => `${who || "Bir ajan"}${project ? ` (${project})` : ""} onayını bekliyor${name ? ", " + name : ""}!`,
    moreWaiting: (n) => ` (+${n} tane daha bekliyor)`,
    focusLabel: "Odak",
    restLabel: "Mola",
    startBreak: (name) => `${name || "Dostum"}, mola zamanı!`,
    startFocus: (name) => `${name || "Dostum"}, hadi odaklanalım!`,
    updateChecking: "Kontrol ediliyor...",
    updateAvailable: "Güncelle",
    updateNone: "Zaten güncel miyav!",
    updateDownloading: (percent) => percent === null ? "Güncelleniyor..." : `Güncelleniyor %${percent}`,
    updateRestarting: "Yeniden başlıyor...",
    userNameGuide: "Adını söylersen Kiri hatırlatmalarda ve başka anlarda sana adınla seslenir.",
    userNamePlaceholder: "Adını yaz",
    userGreeting: (name) => `Merhaba, ${name}!`,
    pomodoroPause: "Duraklat",
    pomodoroResume: "Devam et",
    pomodoroReset: "Sıfırla",
    reminderOnce: "Bir kez",
    reminderCustomDays: "Gün seç",
    reminderDaily: "Her gün",
    reminderWeekdays: "Hafta içi",
    reminderWeekends: "Hafta sonu",
    reminderDaysShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
    reminderOpen: "Hatırlatıcıları aç",
    reminderTitle: "Hatırlatıcı",
    reminderPanelLabel: "Hatırlatıcılar",
    reminderRepeatGroupLabel: "Tekrar",
    reminderDayPickerLabel: "Gün seç",
    reminderMessagePlaceholder: "Kiri sana neyi hatırlatsın?",
    reminderAdd: "Ekle",
    reminderCancel: "Vazgeç",
    reminderSave: "Kaydet",
    reminderUpdate: "Güncelle",
    reminderClose: "Kapat",
    reminderEmpty: "Bir hatırlatıcı ekle, Kiri zamanı gelince miyavlayıp haber verir.",
    reminderEdit: "Düzenle",
    reminderDelete: "Sil",
    personaGuide: "Bu kediye bir kişilik ver — AI görevlerinde nasıl yanıt vereceğini etkiler.",
    personaPlaceholder: "ör. neşeli ve özlü bir hoca",
    screenAskPlaceholder: "Ekranın hakkında bir şey sor…",
    screenAskExamples: ["Bu hata ne demek?", "Bunu kısaca özetle", "Burada sonra ne yapmalıyım?"],
    micDenied: "Mikrofona erişilemedi.",
    voiceListening: "Dinliyorum…",
    stretchNudge: (name) => `${name || "Dostum"}, kalk biraz esne!`,
  },
};

function normalizeLanguage(language) {
  const lang = String(language || "").toLowerCase().split("-")[0];
  return I18N[lang] ? lang : "en";
}

function tr(key, ...args) {
  const table = I18N[currentLanguage] || I18N.en;
  const value = table[key] || I18N.en[key] || key;
  return typeof value === "function" ? value(...args) : value;
}

window.electronAPI.onCursorPos(({ dx, dy }) => {
  // Click-through safety net. Capture turns on from mousemove when the cursor
  // is over the cat and off on mouseleave — but macOS doesn't reliably send
  // mouseleave to an unfocused transparent window, and a missed one left the
  // whole pet window eating clicks meant for the app behind it. This 16 ms poll
  // only ever turns capture OFF (outside the window, or not over the cat).
  if (!dragging && mouseEventsEnabled) {
    const cx = innerWidth / 2 + dx, cy = innerHeight / 2 + dy;
    const inside = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight;
    if (!inside || !shouldReceiveMouseAt(cx, cy)) setPetMouseEventsEnabled(false);
  }
  // While a gaze override is active (cat is "looking at" a pointed element),
  // ignore cursor tracking so it holds the look-at direction.
  if (performance.now() < gazeOverrideUntil) {
    targetDx = gazeOverrideDx;
    targetDy = gazeOverrideDy;
    return;
  }
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    targetDx = 0;
    targetDy = 0;
    return;
  }
  const clamped = Math.min(dist, MAX_RAW_DIST_PX) / MAX_RAW_DIST_PX;
  targetDx = (dx / dist) * clamped;
  targetDy = (dy / dist) * clamped;
});

// The look-at loop (pupils + lean), one rAF chain for the window's lifetime.
function startTickLoop() {
  if (tickLoopStarted) return;
  tickLoopStarted = true;
  requestAnimationFrame(tick);
}
startTickLoop();

function tick() {
  if (poseMode && posesetEl) {
    // "Look at the cursor": pupils drift toward it AND the upper body tilts
    // toward it — but the FEET STAY PLANTED. We rotate the box about its
    // bottom-centre pivot (transform-origin: 50% 100%) instead of sliding the
    // whole illustration, so only the top leans. Idle only.
    const idle = (document.body.dataset.poseState || "idle") === "idle";
    const leanTargetR = idle ? targetDx * POSE_MAX_LEAN_DEG : 0;
    poseLeanR += (leanTargetR - poseLeanR) * 0.1;
    posesetEl.style.setProperty("--lean-r", `${poseLeanR.toFixed(2)}deg`);

    const ex = idle ? targetDx * posePupilTravelPx : 0;
    const ey = idle ? targetDy * posePupilTravelPx : 0;
    poseEyeX += (ex - poseEyeX) * 0.35;
    poseEyeY += (ey - poseEyeY) * 0.35;
    const pt = `translate(${poseEyeX.toFixed(2)}px, ${poseEyeY.toFixed(2)}px)`;
    if (posePupilL) posePupilL.style.transform = pt;
    if (posePupilR) posePupilR.style.transform = pt;
  }
  requestAnimationFrame(tick);
}

function applyCatNameSettings(settings) {
  if (!settings) return;
  currentCatName = (settings.name || "Kiri").trim() || "Kiri";
  isCatNameVisible = !!settings.visible;
  if (shareNameBadge) shareNameBadge.textContent = currentCatName;
  document.body.toggleAttribute("data-show-name", isCatNameVisible);
}

function applyUserNameSettings(settings) {
  currentUserName = String(settings && settings.name || "").trim().slice(0, 24);
}

function openCatNameEditor(initialName) {
  if (!catNameEditor || !catNameInput) return;
  if (window.electronAPI.catNamePromptShown) {
    window.electronAPI.catNamePromptShown().catch(() => {});
  }
  catNameInput.value = (initialName || currentCatName || "Kiri").trim();
  document.body.dataset.editingName = "1";
  requestAnimationFrame(() => {
    catNameInput.focus();
    catNameInput.select();
  });
}

function closeCatNameEditor() {
  delete document.body.dataset.editingName;
}

function openUserNameEditor(initialName) {
  if (!userNameEditor || !userNameInput) return;
  userNameInput.value = String(initialName || "").trim();
  if (userNameGuide) userNameGuide.textContent = tr("userNameGuide");
  document.body.dataset.editingUserName = "1";
  requestAnimationFrame(() => {
    userNameInput.focus();
    userNameInput.select();
  });
}

function closeUserNameEditor() {
  delete document.body.dataset.editingUserName;
}

function openFixedMessageEditor(initialMessage) {
  if (!fixedMessageEditor || !fixedMessageInput) return;
  fixedMessageInput.value = String(initialMessage || currentFixedMessage || "").trim();
  document.body.dataset.editingFixedMessage = "1";
  requestAnimationFrame(() => {
    fixedMessageInput.focus();
    fixedMessageInput.select();
  });
}

function closeFixedMessageEditor() {
  delete document.body.dataset.editingFixedMessage;
}

function refreshBaseSpeech() {
  if (currentPomodoroState && currentPomodoroState.visible) {
    setBaseSpeech(formatPomodoroTime(currentPomodoroState.remainingSec), "timer");
    return;
  }
  setBaseSpeech(currentFixedMessage, "fixed");
}

function applyFixedMessageSettings(settings) {
  currentFixedMessage = String(settings && settings.message || "").trim().slice(0, 80);
  refreshBaseSpeech();
}

function openPomodoroFocusEditor(initialMin) {
  if (!pomodoroFocusEditor || !pomodoroFocusInput) return;
  const min = Math.max(1, Math.min(180, Math.round(Number(initialMin) || 25)));
  pomodoroFocusInput.value = String(min);
  document.body.dataset.editingPomodoroFocus = "1";
  requestAnimationFrame(() => {
    pomodoroFocusInput.focus();
    pomodoroFocusInput.select();
  });
}

function closePomodoroFocusEditor() {
  delete document.body.dataset.editingPomodoroFocus;
}

function reminderRepeatLabel(repeat) {
  if (repeat === "daily") return tr("reminderDaily");
  if (repeat === "weekdays") return tr("reminderWeekdays");
  if (repeat === "weekends") return tr("reminderWeekends");
  if (repeat === "custom") return tr("reminderCustomDays");
  return tr("reminderOnce");
}

function reminderDaysLabel(days) {
  const names = tr("reminderDaysShort");
  const selected = Array.isArray(days) ? days : [];
  const separator = currentLanguage === "en" ? " " : "";
  return selected.map((day) => names[Number(day)]).filter(Boolean).join(separator);
}

function selectedReminderDays() {
  if (!reminderDayPicker) return [];
  return Array.from(reminderDayPicker.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => Number(input.value))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function updateReminderDayPickerVisibility() {
  if (!reminderDayPicker || !reminderRepeatInput) return;
  reminderDayPicker.hidden = reminderRepeatInput.value !== "custom";
}

function setReminderRepeat(value) {
  if (!reminderRepeatInput) return;
  reminderRepeatInput.value = value === "custom" ? "custom" : "none";
  if (reminderRepeatButtons) {
    for (const button of reminderRepeatButtons.querySelectorAll("button[data-repeat]")) {
      button.classList.toggle("is-selected", button.dataset.repeat === reminderRepeatInput.value);
    }
  }
  updateReminderDayPickerVisibility();
}

function updateReminderSaveButtonText() {
  if (reminderSaveButton) reminderSaveButton.textContent = editingReminderId ? tr("reminderUpdate") : tr("reminderSave");
}

function applyReminderI18n() {
  if (reminderClockButton) reminderClockButton.setAttribute("aria-label", tr("reminderOpen"));
  if (userNameGuide) userNameGuide.textContent = tr("userNameGuide");
  if (userNameInput) userNameInput.placeholder = tr("userNamePlaceholder");
  if (reminderPanelTitle) reminderPanelTitle.textContent = tr("reminderTitle");
  if (reminderPanel) reminderPanel.setAttribute("aria-label", tr("reminderPanelLabel"));
  if (reminderMessageInput) reminderMessageInput.placeholder = tr("reminderMessagePlaceholder");
  if (reminderAddButton) reminderAddButton.textContent = tr("reminderAdd");
  if (reminderCancelButton) reminderCancelButton.textContent = tr("reminderCancel");
  if (reminderPanelClose) reminderPanelClose.textContent = tr("reminderClose");
  if (reminderRepeatButtons) reminderRepeatButtons.setAttribute("aria-label", tr("reminderRepeatGroupLabel"));
  if (reminderRepeatButtons) {
    const once = reminderRepeatButtons.querySelector('button[data-repeat="none"]');
    const custom = reminderRepeatButtons.querySelector('button[data-repeat="custom"]');
    if (once) once.textContent = tr("reminderOnce");
    if (custom) custom.textContent = tr("reminderCustomDays");
  }
  if (reminderDayPicker) {
    reminderDayPicker.setAttribute("aria-label", tr("reminderDayPickerLabel"));
    const names = tr("reminderDaysShort");
    for (const label of reminderDayPicker.querySelectorAll("label")) {
      const input = label.querySelector("input");
      const day = input ? Number(input.value) : -1;
      const text = names[day] || "";
      for (const node of Array.from(label.childNodes)) {
        if (node.nodeType === 3) node.remove();
      }
      label.appendChild(document.createTextNode(text));
    }
  }
  updateReminderSaveButtonText();
  renderReminders(currentReminders);
}

function openReminderPanel() {
  document.body.dataset.reminderPanel = "1";
}

function applyReminderSettings(settings) {
  const showButtonOutside = !!(settings && settings.showButtonOutside);
  document.body.toggleAttribute("data-reminder-button", showButtonOutside);
}

function openReminderForm() {
  document.body.dataset.reminderForm = "1";
  if (reminderTimeInput && !reminderTimeInput.value) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    reminderTimeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  requestAnimationFrame(() => {
    if (reminderMessageInput) reminderMessageInput.focus();
  });
}

function closeReminderPanel() {
  delete document.body.dataset.reminderPanel;
  closeReminderForm();
}

function closeReminderForm() {
  delete document.body.dataset.reminderForm;
}

function clearReminderDaySelection() {
  if (!reminderDayPicker) return;
  for (const input of reminderDayPicker.querySelectorAll("input[type='checkbox']")) input.checked = false;
}

function setReminderDaySelection(days) {
  clearReminderDaySelection();
  if (!reminderDayPicker || !Array.isArray(days)) return;
  const selected = new Set(days.map((day) => Number(day)));
  for (const input of reminderDayPicker.querySelectorAll("input[type='checkbox']")) {
    input.checked = selected.has(Number(input.value));
  }
}

function resetReminderForm() {
  editingReminderId = null;
  updateReminderSaveButtonText();
  if (reminderTimeInput) reminderTimeInput.value = "";
  if (reminderMessageInput) reminderMessageInput.value = "";
  setReminderRepeat("none");
  clearReminderDaySelection();
  closeReminderForm();
}

function editReminder(reminder) {
  if (!reminder || !reminder.id) return;
  editingReminderId = reminder.id;
  document.body.dataset.reminderPanel = "1";
  document.body.dataset.reminderForm = "1";
  if (reminderTimeInput) reminderTimeInput.value = reminder.time || "";
  if (reminderMessageInput) reminderMessageInput.value = reminder.message || "";
  updateReminderSaveButtonText();
  setReminderRepeat(reminder.repeat === "custom" ? "custom" : "none");
  setReminderDaySelection(reminder.days);
  requestAnimationFrame(() => {
    if (reminderMessageInput) {
      reminderMessageInput.focus();
      reminderMessageInput.select();
    }
  });
}

function currentReminderTimeKey() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function isReminderVisuallyDisabled(reminder) {
  if (!reminder) return false;
  return reminder.repeat === "none" && String(reminder.time || "") < currentReminderTimeKey();
}

function renderReminders(reminders) {
  currentReminders = Array.isArray(reminders) ? reminders : [];
  if (!reminderListEl) return;
  reminderListEl.textContent = "";
  if (!currentReminders.length) {
    const empty = document.createElement("div");
    empty.className = "reminder-empty";
    empty.textContent = tr("reminderEmpty");
    reminderListEl.appendChild(empty);
    return;
  }
  for (const reminder of currentReminders.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)))) {
    const item = document.createElement("div");
    item.className = `reminder-item${isReminderVisuallyDisabled(reminder) ? " is-disabled" : ""}`;

    const time = document.createElement("span");
    time.textContent = reminder.time || "--:--";

    const message = document.createElement("span");
    message.className = "reminder-message";
    message.textContent = reminder.message || "";
    message.title = reminder.message || "";

    const repeat = document.createElement("span");
    repeat.className = "reminder-repeat";
    const dayLabel = reminder.repeat === "custom" ? reminderDaysLabel(reminder.days) : "";
    repeat.textContent = dayLabel ? dayLabel : reminderRepeatLabel(reminder.repeat);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = tr("reminderEdit");
    edit.addEventListener("click", () => editReminder(reminder));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = tr("reminderDelete");
    remove.addEventListener("click", () => {
      window.electronAPI.reminderDelete(reminder.id).catch(() => {});
    });

    item.appendChild(time);
    item.appendChild(message);
    item.appendChild(repeat);
    item.appendChild(edit);
    item.appendChild(remove);
    reminderListEl.appendChild(item);
  }
}

if (reminderClockButton) {
  reminderClockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (document.body.dataset.reminderPanel) closeReminderPanel();
    else openReminderPanel();
  });
}

if (reminderPanelClose) {
  reminderPanelClose.addEventListener("click", () => {
    closeReminderPanel();
    resetReminderForm();
  });
}

if (reminderAddButton) {
  reminderAddButton.addEventListener("click", () => {
    resetReminderForm();
    openReminderForm();
  });
}

if (reminderCancelButton) {
  reminderCancelButton.addEventListener("click", () => resetReminderForm());
}

if (reminderRepeatButtons) {
  reminderRepeatButtons.addEventListener("click", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("button[data-repeat]") : null;
    if (!button) return;
    setReminderRepeat(button.dataset.repeat);
  });
  setReminderRepeat(reminderRepeatInput ? reminderRepeatInput.value : "none");
}

if (reminderForm && reminderTimeInput && reminderRepeatInput && reminderMessageInput) {
  reminderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = reminderMessageInput.value.trim();
    if (!reminderTimeInput.value || !message) return;
    const repeat = reminderRepeatInput.value;
    const days = repeat === "custom" ? selectedReminderDays() : [];
    if (repeat === "custom" && days.length === 0) return;
    const payload = {
      time: reminderTimeInput.value,
      message,
      repeat,
      days,
    };
    const result = editingReminderId
      ? await window.electronAPI.reminderUpdate({ ...payload, id: editingReminderId })
      : await window.electronAPI.reminderAdd(payload);
    if (result && result.ok) {
      resetReminderForm();
      renderReminders(await window.electronAPI.remindersGet());
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !document.body.dataset.reminderPanel) return;
  event.preventDefault();
  closeReminderPanel();
  resetReminderForm();
});

if (catNameEditor && catNameInput) {
  catNameEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const settings = await window.electronAPI.catNameSet(catNameInput.value);
    applyCatNameSettings(settings);
    closeCatNameEditor();
  });
}

if (catNameCancel) {
  catNameCancel.addEventListener("click", () => closeCatNameEditor());
}

if (userNameEditor && userNameInput) {
  userNameEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const settings = await window.electronAPI.userNameSet(userNameInput.value);
    applyUserNameSettings(settings);
    closeUserNameEditor();
    if (currentUserName) {
      triggerPoseHappy();
      playCompletionMeow();
      showSpeech(tr("userGreeting", currentUserName), { duration: 2200, kind: "notice" });
    }
  });
}

if (userNameCancel) {
  userNameCancel.addEventListener("click", () => closeUserNameEditor());
}

if (fixedMessageEditor && fixedMessageInput) {
  fixedMessageEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const settings = await window.electronAPI.fixedMessageSet(fixedMessageInput.value);
    applyFixedMessageSettings(settings);
    closeFixedMessageEditor();
  });
}

if (fixedMessageCancel) {
  fixedMessageCancel.addEventListener("click", () => closeFixedMessageEditor());
}

if (pomodoroFocusEditor && pomodoroFocusInput) {
  pomodoroFocusEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const min = Math.max(1, Math.min(180, Math.round(Number(pomodoroFocusInput.value) || 25)));
    const state = await window.electronAPI.pomodoroFocusSet(min);
    applyPomodoroState(state);
    closePomodoroFocusEditor();
  });
}

if (pomodoroFocusCancel) {
  pomodoroFocusCancel.addEventListener("click", () => closePomodoroFocusEditor());
}

window.electronAPI.catNameGet().then(applyCatNameSettings).catch(() => {});
window.electronAPI.onCatNameChanged(applyCatNameSettings);
window.electronAPI.userNameGet().then(applyUserNameSettings).catch(() => {});
window.electronAPI.onUserNameChanged(applyUserNameSettings);
window.electronAPI.onUserNameEdit((name) => openUserNameEditor(name));

// Per-character personality editor (multi-character).
function openPersonaEditor(initialPersona) {
  if (!personaEditor || !personaInput) return;
  personaInput.value = String(initialPersona || "");
  if (personaGuideEl) personaGuideEl.textContent = tr("personaGuide");
  personaInput.setAttribute("placeholder", tr("personaPlaceholder"));
  document.body.dataset.editingPersona = "1";
  requestAnimationFrame(() => { personaInput.focus(); });
}
function closePersonaEditor() {
  delete document.body.dataset.editingPersona;
}
if (personaEditor && personaInput) {
  personaEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await window.electronAPI.personaSet(personaInput.value); } catch {}
    closePersonaEditor();
  });
}
if (personaCancel) {
  personaCancel.addEventListener("click", () => closePersonaEditor());
}
if (window.electronAPI.onPersonaEdit) {
  window.electronAPI.onPersonaEdit((persona) => openPersonaEditor(persona));
}

// ── Ask about my screen (typed): text twin of push-to-talk. Type a question →
//    main captures the whole screen and answers with a bubble + paw point. ──
function openScreenAskEditor() {
  if (!screenAskEditor || !screenAskInput) return;
  screenAskInput.value = "";
  screenAskInput.setAttribute("placeholder", tr("screenAskPlaceholder"));
  renderScreenAskExamples();
  document.body.dataset.editingScreenAsk = "1";
  requestAnimationFrame(() => { screenAskInput.focus(); });
}
function closeScreenAskEditor() {
  delete document.body.dataset.editingScreenAsk;
}
// One-tap example questions under the box — the first thing a new user sees
// is what they can actually ask.
function renderScreenAskExamples() {
  if (!screenAskExamples) return;
  screenAskExamples.innerHTML = "";
  const list = tr("screenAskExamples");
  for (const q of Array.isArray(list) ? list : []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "screen-ask-example";
    btn.textContent = q;
    btn.addEventListener("click", async () => {
      closeScreenAskEditor();
      try { await window.electronAPI.askScreen(q); } catch {}
    });
    screenAskExamples.appendChild(btn);
  }
}
if (screenAskEditor && screenAskInput) {
  screenAskEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = screenAskInput.value.trim();
    closeScreenAskEditor();
    if (!q) return;
    try { await window.electronAPI.askScreen(q); } catch {}
  });
}
if (screenAskCancel) {
  screenAskCancel.addEventListener("click", () => closeScreenAskEditor());
}
if (window.electronAPI.onScreenAskOpen) {
  window.electronAPI.onScreenAskOpen(() => openScreenAskEditor());
}

function poseManifest() {
  const all = window.POSE_MANIFEST;
  return (all && all[poseSet]) || null;
}

function applyPosesetImages() {
  if (!poseEls || !poseAnimEls) return;
  const base = `../svg/${poseSet}_`;
  poseEls.noeye.src = `${base}noeye.png`;
  for (const state of POSE_STATES) {
    const el = poseAnimEls[state];
    if (el) el.style.backgroundImage = `url("${base}${state}.png")`;
  }
}

// The idle canvas contain-fit into the pose box, feet on the box bottom (same
// as #pose-noeye's object-fit). Layout size, not getBoundingClientRect — the
// box is rotated by the cursor lean, which would inflate a bounding rect.
function poseIdleRect() {
  const m = poseManifest();
  if (!m || !posesetEl) return null;
  const bw = posesetEl.offsetWidth, bh = posesetEl.offsetHeight;
  if (bw <= 0 || bh <= 0) return null;
  const s = Math.min(bw / m.w, bh / m.h);
  return { s, x: (bw - m.w * s) / 2, y: bh - m.h * s, w: m.w * s, h: m.h * s };
}

// Place a state's strip cell in idle-canvas coordinates (it may overflow the
// box — the drag pose hangs below the feet, standing poses rise above the head).
function sizePoseAnim(state) {
  const el = poseAnimEls && poseAnimEls[state];
  const m = poseManifest();
  const c = m && m.states[state];
  const r = poseIdleRect();
  if (!el || !c || !r) return;
  el.style.left = `${r.x + c.ox * r.s}px`;
  el.style.top = `${r.y + c.oy * r.s}px`;
  el.style.width = `${c.cw * r.s}px`;
  el.style.height = `${c.ch * r.s}px`;
  el.style.backgroundSize = `${c.frames * 100}% 100%`;
}

// Standing poses reach higher than the sitting idle art (and kiri's idle head
// already sits above the box's --cat-top line), so lift the speech bubble /
// thinking dots to clear whatever is showing: --pose-rise = px from the
// --cat-top line up to the current art's top edge.
function updatePoseRise(state) {
  const r = poseMode ? poseIdleRect() : null;
  if (!r) { document.body.style.removeProperty("--pose-rise"); return; }
  const m = poseManifest();
  const c = m && m.states[state];
  const artTop = r.y + Math.min(0, c ? c.oy * r.s : 0);
  const catTopInBox = posesetEl.offsetHeight - posesetEl.offsetWidth; // box = cat-top-0.18cs … cat-top+cs
  const rise = Math.max(0, Math.round(catTopInBox - artTop));
  document.body.style.setProperty("--pose-rise", `${rise}px`);
}

function showPoseFrame(el, frames, idx) {
  if (idx === poseAnimFrameShown) return;
  poseAnimFrameShown = idx;
  el.style.backgroundPositionX = frames > 1 ? `${(idx / (frames - 1)) * 100}%` : "0%";
}

// Drag pose: pendulum sway from horizontal impulses, side view while dragged
// sideways (with hysteresis so it doesn't flicker), slow dangle otherwise.
function poseMoveFrame(c, el, now) {
  poseDragVx += (poseDragDxAcc - poseDragVx) * 0.3;
  poseDragDxAcc = 0;
  const speed = Math.abs(poseDragVx);
  if (!poseMoveSide && speed > 3) poseMoveSide = true;
  else if (poseMoveSide && speed < 0.8) poseMoveSide = false;
  if (poseMoveSide && speed > 1.5) poseMoveFlip = poseDragVx > 0;
  poseSwayVel += -poseSwayAngle * 0.055;   // spring back to plumb
  poseSwayVel *= 0.9;                      // damping
  poseSwayAngle = Math.max(-12, Math.min(12, poseSwayAngle + poseSwayVel));
  const flip = poseMoveSide && poseMoveFlip ? -1 : 1;
  el.style.transform = `rotate(${poseSwayAngle.toFixed(2)}deg) scaleX(${flip})`;
  const groups = c.groups || { hang: [...Array(c.frames).keys()] };
  const list = (poseMoveSide && groups.side) || groups.hang || [0];
  const fps = poseMoveSide ? POSE_MOVE_FPS.side : POSE_MOVE_FPS.hang;
  const i = Math.floor(((now - poseAnimStartedAt) / 1000) * fps) % list.length;
  showPoseFrame(el, c.frames, list[i]);
}

function poseAnimTick(now) {
  poseAnimRaf = null;
  if (!poseMode || !poseAnimState) return;
  const m = poseManifest();
  const c = m && m.states[poseAnimState];
  const el = poseAnimEls[poseAnimState];
  if (c && el) {
    if (poseAnimState === "move") {
      poseMoveFrame(c, el, now);
    } else {
      const fps = (POSE_PLAY[poseAnimState] || {}).fps || 0;
      const idx = c.frames > 1 && fps > 0
        ? Math.floor(((now - poseAnimStartedAt) / 1000) * fps) % c.frames
        : 0;
      showPoseFrame(el, c.frames, idx);
    }
  }
  poseAnimRaf = requestAnimationFrame(poseAnimTick);
}

function startPoseAnim(state) {
  poseAnimState = state;
  poseAnimStartedAt = performance.now();
  poseAnimFrameShown = -1;
  if (state === "move") {
    poseSwayAngle = 0; poseSwayVel = 0;
    poseDragDxAcc = 0; poseDragVx = 0;
    poseMoveSide = false; poseMoveFlip = false;
  }
  sizePoseAnim(state);
  if (!poseAnimRaf) poseAnimRaf = requestAnimationFrame(poseAnimTick);
}

function stopPoseAnim() {
  poseAnimState = null;
  if (poseAnimRaf) { cancelAnimationFrame(poseAnimRaf); poseAnimRaf = null; }
}

// Resolve the current pose-set state from active conditions and reflect it on
// <body> (CSS swaps the visible <img>). Priority: drag > listen > happy > AI > idle.
// "Showing a spot" deliberately has no pose — the pet stays on the idle art so
// the tracking pupils stay visible while it gazes at the target.
function updatePoseState() {
  updatePetdexState();   // community pets follow the same conditions
  if (!poseMode) return;
  const st = currentPoseCondition();
  document.body.dataset.poseState = st;
  updatePoseRise(st);
  if (st === "idle") stopPoseAnim();
  else if (poseAnimState !== st) startPoseAnim(st);
  renderPosesetOverlay();
}

function currentPoseCondition() {
  if (dragging) return "move";
  if (poseListening) return "listening";
  if (poseHappy) return "happy";
  if (poseAiActive) return "working";
  return "idle";
}

// Brief happy pose when an agent task or a pomodoro finishes.
function triggerPoseHappy(ms = 2400) {
  if (!poseMode && !petdexMode) return;
  poseHappy = true;
  updatePoseState();
  clearTimeout(poseHappyTimer);
  poseHappyTimer = setTimeout(() => {
    poseHappy = false;
    updatePoseState();
  }, ms);
}

// Brief "listening" reaction when the character is clicked.
function triggerPoseListening() {
  if (!poseMode && !petdexMode) return;
  poseListening = true;
  updatePoseState();
  clearTimeout(poseListeningTimer);
  poseListeningTimer = setTimeout(() => {
    poseListening = false;
    updatePoseState();
  }, 1800);
}

// Composite the painted pixel overlay over the idle art. Only drawn while the
// idle (noeye) pose is showing — the other poses are different drawings, so the
// grid would not line up with them.
function renderPosesetOverlay() {
  const cv = poseOverlayCanvas;
  if (!cv || !poseMode || !poseEls) return;
  const ctx = cv.getContext("2d");
  const showingIdle = (document.body.dataset.poseState || "idle") === "idle";
  const cells = poseOverlay && Array.isArray(poseOverlay.cells) ? poseOverlay.cells : null;
  // A design painted on an older idle drawing would land in the wrong place —
  // keep it saved (the editor offers to fix it) but don't composite it.
  const m = poseManifest();
  const stale = !m || (poseOverlay && (poseOverlay.art || 1)) !== m.rev;
  if (!showingIdle || !cells || !cells.length || stale) {
    cv.style.display = "none";
    return;
  }
  const r = poseIdleRect();
  if (!r) { cv.style.display = "none"; return; }
  const dispW = r.w, dispH = r.h, left = r.x, top = r.y;
  const dpr = window.devicePixelRatio || 1;
  cv.style.display = "block";
  cv.style.left = `${left}px`;
  cv.style.top = `${top}px`;
  cv.style.width = `${dispW}px`;
  cv.style.height = `${dispH}px`;
  cv.width = Math.max(1, Math.round(dispW * dpr));
  cv.height = Math.max(1, Math.round(dispH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dispW, dispH);
  const cw = dispW / poseOverlay.cols;
  const ch = dispH / poseOverlay.rows;
  for (const cell of cells) {
    ctx.fillStyle = cell.color;
    ctx.fillRect(cell.x * cw, cell.y * ch, cw + 0.6, ch + 0.6);
  }
}

// Position + size the tracking pupils over the idle eyes. Uses the same
// contained-image rect as the overlay so pupils sit exactly on the eye whites.
function layoutPosePupils() {
  if (!poseMode || !posePupilL || !posePupilR || !poseEls) return;
  const m = poseManifest();
  const eyes = m && m.eyes;
  const r = poseIdleRect();
  if (!eyes || !r) return;
  const dispW = r.w, dispH = r.h, offX = r.x, offY = r.y;
  const d = Math.max(3, eyes.pr * dispW * 2);
  for (const [el, e] of [[posePupilL, eyes.l], [posePupilR, eyes.r]]) {
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
    el.style.left = `${offX + e.x * dispW - d / 2}px`;
    el.style.top = `${offY + e.y * dispH - d / 2}px`;
  }
  posePupilTravelPx = eyes.travel * dispW;
}

// ── Petdex / agentpets community pets ───────────────────────────────────────
// A pet is one sprite sheet: `columns` frames across, one animation state per
// row. We blit the current frame into #petdex each tick — simpler and more
// exact than CSS background-position math, and it lets a short sheet fall back
// to row 0 without any layout surprises.
const PETDEX_STATE_ROWS = {                 // Kiri state → petdex row index
  idle: 0, listening: 3, working: 7, move: 4, complete: 3, error: 5, thinking: 6,
};

function applyPetdexArt(pet) {
  stopPetdexAnim();
  petdexPet = pet || null;
  if (!petdexPet || !petdexEl) return;
  petdexImage = new Image();
  petdexImage.onload = () => {
    layoutPetdexCanvas();
    startPetdexAnim();
  };
  petdexImage.onerror = () => { petdexImage = null; };
  // The sheet lives outside the app folder (~/.codex/pets/…), so it is passed
  // through as a file:// URL by main.
  petdexImage.src = petdexPet.url;
}

// Canvas backing store = one frame at device resolution; CSS scales it to the
// pet box, and image-rendering:pixelated keeps pixel art crisp.
function layoutPetdexCanvas() {
  if (!petdexEl || !petdexPet) return;
  const dpr = window.devicePixelRatio || 1;
  const box = petdexEl.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;
  petdexEl.width = Math.max(1, Math.round(box.width * dpr));
  petdexEl.height = Math.max(1, Math.round(box.height * dpr));
  drawPetdexFrame();
}

function drawPetdexFrame() {
  if (!petdexEl || !petdexPet || !petdexImage || !petdexImage.complete) return;
  const ctx = petdexEl.getContext("2d");
  if (!ctx) return;
  const { frameWidth: fw, frameHeight: fh } = petdexPet;
  const row = Math.min(petdexRow, Math.max(0, petdexPet.rows - 1));
  const col = petdexFrame % Math.max(1, petdexPet.frames);
  // Contain the frame in the box, feet on the bottom edge (same as pose-set).
  const scale = Math.min(petdexEl.width / fw, petdexEl.height / fh);
  const w = fw * scale, h = fh * scale;
  const x = (petdexEl.width - w) / 2;
  const y = petdexEl.height - h;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, petdexEl.width, petdexEl.height);
  ctx.drawImage(petdexImage, col * fw, row * fh, fw, fh, x, y, w, h);
}

function startPetdexAnim() {
  stopPetdexAnim();
  if (!petdexPet) return;
  const interval = 1000 / Math.max(1, petdexPet.fps);
  drawPetdexFrame();
  petdexTimer = setInterval(() => {
    petdexFrame = (petdexFrame + 1) % Math.max(1, petdexPet.frames);
    drawPetdexFrame();
  }, interval);
}

function stopPetdexAnim() {
  if (petdexTimer) { clearInterval(petdexTimer); petdexTimer = null; }
}

// Mirrors updatePoseState() for community pets: pick the row for the current
// condition. Priority matches the pose-set path (drag > listen > AI > idle).
function updatePetdexState() {
  if (!petdexMode || !petdexPet) return;
  const state = currentPoseCondition();
  const row = PETDEX_STATE_ROWS[state === "happy" ? "complete" : state] || 0;
  if (row === petdexRow) return;
  petdexRow = row;
  petdexFrame = 0;
  drawPetdexFrame();
}

// Unknown / missing art falls back to kiri — the only built-in characters are
// the pose-sets (old classic/sprite saves are migrated in characters.js).
function applyCharacterArt(art) {
  petdexMode = !!(art && art.kind === "petdex" && art.pet);
  poseMode = !petdexMode;
  document.body.toggleAttribute("data-posemode", poseMode);
  document.body.toggleAttribute("data-petdexmode", petdexMode);
  if (posesetEl) posesetEl.hidden = !poseMode;
  if (petdexEl) petdexEl.hidden = !petdexMode;
  if (petdexMode) applyPetdexArt(art.pet);
  else stopPetdexAnim();
  if (poseMode) {
    poseSet = art && art.set === "tori" ? "tori" : "kiri";
    poseOverlay = (art && art.overlay) || null;
    applyPosesetImages();
    updatePoseState();
    layoutPosePupils();
  }
}

if (poseEls && poseEls.noeye) {
  poseEls.noeye.addEventListener("load", () => {
    renderPosesetOverlay();
    layoutPosePupils();
    updatePoseRise(document.body.dataset.poseState || "idle");
  });
}
window.addEventListener("resize", () => {
  if (petdexMode) layoutPetdexCanvas();
  if (!poseMode) return;
  renderPosesetOverlay();
  layoutPosePupils();
  if (poseAnimState) sizePoseAnim(poseAnimState);
  updatePoseRise(document.body.dataset.poseState || "idle");
});

if (window.electronAPI.onCharacterArt) {
  window.electronAPI.onCharacterArt(applyCharacterArt);
}
if (window.electronAPI.onOverlayPreview) {
  // Live, non-persisted overlay preview while the pixel editor is open.
  window.electronAPI.onOverlayPreview((overlay) => {
    if (!poseMode) return;
    poseOverlay = overlay || null;
    renderPosesetOverlay();
  });
}
window.electronAPI.onCatNameEdit((name) => openCatNameEditor(name));
window.electronAPI.fixedMessageGet().then(applyFixedMessageSettings).catch(() => {});
window.electronAPI.onFixedMessageChanged(applyFixedMessageSettings);
window.electronAPI.onFixedMessageEdit((message) => openFixedMessageEditor(message));
window.electronAPI.onPomodoroFocusEdit((min) => openPomodoroFocusEditor(min));
applyReminderI18n();
window.electronAPI.remindersGet().then(renderReminders).catch(() => {});
setInterval(() => renderReminders(currentReminders), 30 * 1000);
window.electronAPI.onRemindersChanged(renderReminders);
window.electronAPI.onReminderSettingsChanged(applyReminderSettings);
window.electronAPI.onReminderPanelOpen(() => {
  openReminderPanel();
});
window.electronAPI.onReminderTriggered((payload) => {
  const text = payload && typeof payload.text === "string" ? payload.text.trim() : "";
  if (text) {
    playReminderMeow();
    triggerPoseListening();
    showSpeech(text, { duration: 5200, kind: "reminder" });
  }
});

function updateCtaText(state) {
  if (!state) return "";
  if (state.state === "checking") return tr("updateChecking");
  if (state.state === "available") return tr("updateAvailable");
  if (state.state === "none") return tr("updateNone");
  if (state.state === "downloading") return tr("updateDownloading", state.percent ?? null);
  if (state.state === "restarting") return tr("updateRestarting");
  return "";
}

function renderUpdateCta() {
  if (!catSpeechBubble || !updateCtaState) return false;
  const text = updateCtaText(updateCtaState);
  if (!text) return false;

  catSpeechBubble.textContent = "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "update-cta-button";
  button.textContent = text;
  button.disabled = updateCtaState.state === "checking" || updateCtaState.state === "none" || updateCtaState.state === "downloading";
  const keepUpdateCtaClickable = () => setPetMouseEventsEnabled(true);
  const keepUpdateCtaPointer = (event) => {
    keepUpdateCtaClickable();
    event.stopPropagation();
  };
  const pressUpdateCtaButton = () => {
    button.classList.add("is-pressed");
    setTimeout(() => {
      button.classList.remove("is-pressed");
    }, 160);
  };
  catSpeechBubble.addEventListener("pointerenter", keepUpdateCtaClickable, { once: true });
  catSpeechBubble.addEventListener("pointermove", keepUpdateCtaClickable, { once: true });
  catSpeechBubble.addEventListener("mouseenter", keepUpdateCtaClickable, { once: true });
  button.addEventListener("mouseenter", keepUpdateCtaClickable);
  button.addEventListener("mousemove", keepUpdateCtaClickable);
  button.addEventListener("pointerenter", keepUpdateCtaClickable);
  button.addEventListener("pointermove", keepUpdateCtaClickable);
  button.addEventListener("pointerdown", (event) => {
    keepUpdateCtaPointer(event);
    pressUpdateCtaButton();
  });
  button.addEventListener("mousedown", keepUpdateCtaPointer);
  button.addEventListener("click", () => {
    if (updateCtaState.state === "available") {
      pressUpdateCtaButton();
      updateCtaState = { ...updateCtaState, state: "downloading", percent: null };
      renderUpdateCta();
      window.electronAPI.updateDownload().catch(() => {});
    }
  });
  catSpeechBubble.appendChild(button);
  catSpeechBubble.setAttribute("aria-label", text);
  document.body.dataset.speech = "update";
  keepUpdateCtaClickable();
  return true;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createPomodoroIcon(kind) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "pomodoro-icon");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const addRect = (x, y, width, height) => {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", "currentColor");
    svg.appendChild(rect);
  };

  if (kind === "pause") {
    addRect(3, 2, 2, 8);
    addRect(7, 2, 2, 8);
  } else if (kind === "play") {
    addRect(3, 2, 2, 8);
    addRect(5, 3, 2, 6);
    addRect(7, 4, 2, 4);
    addRect(9, 5, 1, 2);
  } else {
    addRect(3, 3, 2, 2);
    addRect(7, 3, 2, 2);
    addRect(5, 5, 2, 2);
    addRect(3, 7, 2, 2);
    addRect(7, 7, 2, 2);
  }

  return svg;
}

function renderPomodoroTimerSpeech(speech) {
  if (!catSpeechBubble || !speech || speech.kind !== "timer" || !currentPomodoroState || !currentPomodoroState.visible) {
    return false;
  }

  catSpeechBubble.textContent = "";
  const text = document.createElement("span");
  text.className = "pomodoro-timer-text";
  text.textContent = speech.text;
  catSpeechBubble.appendChild(text);

  const controls = document.createElement("span");
  controls.className = "pomodoro-controls";

  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.className = "pomodoro-control";
  pauseButton.appendChild(createPomodoroIcon(currentPomodoroState.running ? "pause" : "play"));
  pauseButton.title = currentPomodoroState.running ? tr("pomodoroPause") : tr("pomodoroResume");
  pauseButton.setAttribute("aria-label", pauseButton.title);
  pauseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = currentPomodoroState && currentPomodoroState.running ?
      window.electronAPI.pomodoroPause() :
      window.electronAPI.pomodoroStart();
    action.then(applyPomodoroState).catch(() => {});
  });
  controls.appendChild(pauseButton);

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "pomodoro-control";
  resetButton.appendChild(createPomodoroIcon("reset"));
  resetButton.title = tr("pomodoroReset");
  resetButton.setAttribute("aria-label", resetButton.title);
  resetButton.addEventListener("click", (event) => {
    event.stopPropagation();
    window.electronAPI.pomodoroReset().then(applyPomodoroState).catch(() => {});
  });
  controls.appendChild(resetButton);

  catSpeechBubble.appendChild(controls);
  catSpeechBubble.setAttribute("aria-label", speech.text);
  document.body.dataset.speech = "timer";
  return true;
}

function resetSpeechBubbleOverflow() {
  document.body.style.removeProperty("--bubble-overflow-y");
}

function scheduleSpeechBubbleLayout() {
  if (!catSpeechBubble) return;
  if (speechLayoutRaf) cancelAnimationFrame(speechLayoutRaf);
  speechLayoutRaf = requestAnimationFrame(() => {
    speechLayoutRaf = null;
    if (!document.body.dataset.speech || catSpeechBubble.offsetParent === null) {
      resetSpeechBubbleOverflow();
      return;
    }
    resetSpeechBubbleOverflow();
    const top = catSpeechBubble.getBoundingClientRect().top;
    const minTop = 4;
    if (top < minTop) {
      document.body.style.setProperty("--bubble-overflow-y", `${Math.ceil(minTop - top)}px`);
    }
  });
}

function renderSpeech(speech) {
  if (!catSpeechBubble) return;
  if (activeSpeechKind === "reminder" && (!speech || speech.kind !== "reminder")) return;
  if (renderUpdateCta()) {
    resetSpeechBubbleOverflow();
    return;
  }
  if (!speech || !speech.text) {
    catSpeechBubble.textContent = "";
    catSpeechBubble.removeAttribute("aria-label");
    delete document.body.dataset.speech;
    resetSpeechBubbleOverflow();
    return;
  }
  if (!renderPomodoroTimerSpeech(speech)) {
    catSpeechBubble.textContent = speech.kind === "thinking" ? "" : speech.text;
    catSpeechBubble.setAttribute("aria-label", speech.text);
    document.body.dataset.speech = speech.kind || "notice";
  }
  scheduleSpeechBubbleLayout();
}

window.electronAPI.onUpdateState((state) => {
  if (!state || state.state === "idle") updateCtaState = null;
  else updateCtaState = state;
  renderSpeech(baseSpeech);
  if (state && state.state === "none") {
    setTimeout(() => {
      if (!updateCtaState || updateCtaState.state !== "none") return;
      updateCtaState = null;
      renderSpeech(baseSpeech);
    }, 3000);
  }
});

function clearSpeech() {
  if (activeSpeechKind === "reminder") return;
  if (speechTimer) {
    clearTimeout(speechTimer);
    speechTimer = null;
  }
  activeSpeechKind = null;
  renderSpeech(baseSpeech);
}

function showSpeech(text, { duration = 1800, kind = "notice" } = {}) {
  if (activeSpeechKind === "reminder" && kind !== "reminder") return;
  if (speechTimer) clearTimeout(speechTimer);
  activeSpeechKind = kind;
  delete document.body.dataset.speech;
  void document.body.offsetWidth;
  renderSpeech({ text, kind });
  speechTimer = setTimeout(() => {
    speechTimer = null;
    activeSpeechKind = null;
    renderSpeech(baseSpeech);
  }, duration);
}

function setBaseSpeech(text, kind = "timer") {
  baseSpeech = text ? { text, kind } : null;
  if (!speechTimer) renderSpeech(baseSpeech);
}

// Live-updating speech for streaming answers: updates the bubble text in place
// (only the first call "pops"), and holds it open with a long safety timer so
// mid-stream pauses don't collapse the bubble. Call showSpeech() at the end to
// give it a normal auto-close duration.
function streamSpeech(text) {
  if (activeSpeechKind === "reminder") return;
  if (speechTimer) clearTimeout(speechTimer);
  if (activeSpeechKind !== "stream") {
    activeSpeechKind = "stream";
    delete document.body.dataset.speech;
    void document.body.offsetWidth;
  }
  renderSpeech({ text, kind: "notice" });
  // Safety net: if the stream stalls/dies without an "end", don't hang forever.
  speechTimer = setTimeout(() => {
    speechTimer = null;
    activeSpeechKind = null;
    renderSpeech(baseSpeech);
  }, 30000);
}

function setThinkingDotsVisible(visible) {
  document.body.toggleAttribute("data-thinking", !!visible);
  if (catThinkingDots) catThinkingDots.setAttribute("aria-hidden", visible ? "false" : "true");
}

function clearAiTaskStaleTimer() {
  if (!aiTaskStaleTimer) return;
  clearTimeout(aiTaskStaleTimer);
  aiTaskStaleTimer = null;
}

let lastMeowAt = 0;
const MEOW_COOLDOWN_MS = 500;

function playCompletionMeow() {
  if (completionMeowVolume <= 0) return;
  const now = Date.now();
  if (now - lastMeowAt < MEOW_COOLDOWN_MS) return;
  lastMeowAt = now;
  completionMeow.volume = completionMeowVolume;
  completionMeow.currentTime = 0;
  completionMeow.play().catch(() => {});
}

function getReminderMeowVolume() {
  return Math.max(0, Math.min(1, completionMeowVolume * reminderMeowVolumeBoost));
}

function playReminderMeow(options = {}) {
  if (completionMeowVolume <= 0) return;
  const repeat = Math.max(1, Math.min(3, Math.round(Number(options.repeat) || 3)));
  const play = () => {
    reminderMeow.volume = getReminderMeowVolume();
    reminderMeow.currentTime = 0;
    reminderMeow.play().catch(() => {});
  };
  play();
  if (repeat >= 2) setTimeout(play, 1500);
  if (repeat >= 3) setTimeout(play, 3000);
}

function playAiComplete() {
  setThinkingDotsVisible(false);
  triggerPoseHappy();
  playCompletionMeow();
  showSpeech(tr("agentComplete"), { kind: "complete" });
}

// AI-agent approval alert (e.g. Claude Code asks to run a command while it is
// monitoring): a clean "ding" + a glance/jump + a speech bubble.
function playAiDing() {
  if (completionMeowVolume <= 0) return;
  aiDing.volume = Math.max(0, Math.min(1, completionMeowVolume * 3));
  aiDing.currentTime = 0;
  aiDing.play().catch(() => {});
}

const AGENT_LABELS = { "claude-code": "Claude", cursor: "Cursor", codex: "Codex", kiro: "Kiro", antigravity: "Antigravity" };

const AI_NOTIFY_DURATION_MS = 5600;
// Approval requests from several sessions can land at once; show them one
// after another instead of letting the newest bubble overwrite the rest.
const aiNotifyQueue = [];
let aiNotifyCurrent = null;
let aiNotifyTimer = null;

function aiNotifyKey(event) {
  return `${(event && event.agentId) || "agent"}:${(event && event.sessionId) || ""}`;
}

function aiNotificationText(event) {
  const who = AGENT_LABELS[event.agentId];
  let msg = who ? tr("agentApproval", currentUserName, who, event.project || "") : tr("needsAttention", currentUserName);
  if (aiNotifyQueue.length) msg += tr("moreWaiting", aiNotifyQueue.length);
  return msg;
}

function showNextAiNotification() {
  if (aiNotifyTimer) clearTimeout(aiNotifyTimer);
  aiNotifyTimer = null;
  aiNotifyCurrent = aiNotifyQueue.shift() || null;
  if (!aiNotifyCurrent) return;
  const event = aiNotifyCurrent;
  setThinkingDotsVisible(false);
  playAiDing();
  triggerPoseListening();
  showSpeech(aiNotificationText(event), { duration: AI_NOTIFY_DURATION_MS, kind: "reminder" });
  aiNotifyTimer = setTimeout(showNextAiNotification, AI_NOTIFY_DURATION_MS + 300);
}

function playAiNotification(event) {
  const entry = { ...(event || {}), key: aiNotifyKey(event) };
  if (aiNotifyCurrent && aiNotifyCurrent.key === entry.key) return;
  const queued = aiNotifyQueue.findIndex((e) => e.key === entry.key);
  if (queued >= 0) aiNotifyQueue[queued] = entry;
  else aiNotifyQueue.push(entry);
  if (!aiNotifyCurrent) showNextAiNotification();
  // Refresh the "+N more waiting" count on the bubble already on screen.
  else if (activeSpeechKind === "reminder") renderSpeech({ text: aiNotificationText(aiNotifyCurrent), kind: "reminder" });
}

// A session moved on (approved in its terminal, finished, errored): drop its
// pending bubble, and skip ahead if it is the one on screen.
function resolveAiNotification(event) {
  const key = aiNotifyKey(event);
  const queued = aiNotifyQueue.findIndex((e) => e.key === key);
  if (queued >= 0) aiNotifyQueue.splice(queued, 1);
  if (!aiNotifyCurrent || aiNotifyCurrent.key !== key) return;
  if (aiNotifyQueue.length) showNextAiNotification();
  else aiNotifyCurrent = { ...aiNotifyCurrent, key: null }; // a fresh prompt from it dings again
}

function formatPomodoroTime(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${String(min).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function applyPomodoroState(state) {
  currentPomodoroState = state || null;
  if (!state || !state.visible) {
    currentPomodoroState = null;
    delete document.body.dataset.pomodoro;
    delete document.body.dataset.pomodoroMode;
    delete document.body.dataset.pomodoroPaused;
    if (speechTimer && activeSpeechKind !== "reminder") {
      clearTimeout(speechTimer);
      speechTimer = null;
      activeSpeechKind = null;
    }
    refreshBaseSpeech();
    return;
  }
  const mode = state.mode === "rest" ? "rest" : "focus";
  currentPomodoroState = state;
  document.body.dataset.pomodoro = "1";
  document.body.dataset.pomodoroMode = mode;
  document.body.toggleAttribute("data-pomodoro-paused", !state.running);
  refreshBaseSpeech();
}

function clearAiTaskVisuals() {
  poseAiActive = false;
  updatePoseState();
  setThinkingDotsVisible(false);
}

function applyAiTaskState(event) {
  const state = event && typeof event.state === "string" ? event.state : "";
  if (state && state !== "notification") resolveAiNotification(event);
  const active = state === "thinking" || state === "working";
  // Community pets share the pose-set condition flags; updatePoseState() fans
  // out to updatePetdexState() so the sheet's state row follows along.
  poseAiActive = active;
  updatePoseState();
  setThinkingDotsVisible(false);
  clearAiTaskStaleTimer();
  if (active) {
    // Antigravity's hook has no terminal event, so its bursts decay fast.
    // Every other agent gets a long backstop slightly above main's 10-min
    // session TTL, in case the terminal/idle event never arrives.
    const staleMs = event && event.agentId === "antigravity" ? 3000 : AI_TASK_STALE_MS;
    aiTaskStaleTimer = setTimeout(() => {
      aiTaskStaleTimer = null;
      clearAiTaskVisuals();
    }, staleMs);
  }
}

window.electronAPI.onAiTaskComplete(playAiComplete);
window.electronAPI.onDoJump(() => triggerPoseHappy());
window.electronAPI.onDoStretch(() => {
  triggerPoseHappy(3200);
  playCompletionMeow();
  showSpeech(tr("stretchNudge", currentUserName), { duration: 6000, kind: "break" });
});
window.electronAPI.onAiTaskState(applyAiTaskState);
window.electronAPI.onAiTaskNotification(playAiNotification);
if (window.electronAPI.onAiNotice) {
  window.electronAPI.onAiNotice((message) => {
    if (message) showSpeech(message, { duration: 4600, kind: "notice" });
  });
}

// ── Voice listen (OpenAI STT-only): click the mic → record → silence auto-stop
//    or click again → main transcribes → routes into the command agent. ──
let voiceEnabled = false;
let voiceRecording = false;
let voiceStream = null;
let voiceRecorder = null;
let voiceChunks = [];
let voiceAudioCtx = null;
let voiceAnalyser = null;
let voiceSilenceTimer = null;
let voiceMaxTimer = null;
let voiceVadRaf = null;
let voiceHadSpeech = false;

function applyVoiceConfig(cfg) {
  voiceEnabled = !!(cfg && cfg.enabled);
  if (!voiceListenButton) return;
  if (voiceEnabled) {
    voiceListenButton.removeAttribute("hidden");
  } else {
    voiceListenButton.setAttribute("hidden", "");
    if (voiceRecording) stopVoiceListening(true);
  }
}

function cleanupVoiceAudio() {
  if (voiceVadRaf) cancelAnimationFrame(voiceVadRaf);
  voiceVadRaf = null;
  if (voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
  voiceSilenceTimer = null;
  if (voiceMaxTimer) clearTimeout(voiceMaxTimer);
  voiceMaxTimer = null;
  if (voiceAudioCtx) { try { voiceAudioCtx.close(); } catch {} }
  voiceAudioCtx = null;
  voiceAnalyser = null;
  if (voiceStream) { voiceStream.getTracks().forEach((t) => t.stop()); }
  voiceStream = null;
}

async function startVoiceListening() {
  if (voiceRecording || !voiceEnabled) return;
  try { if (window.electronAPI.voiceRequestMic) await window.electronAPI.voiceRequestMic(); } catch {}
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showSpeech(tr("micDenied"), { duration: 3200, kind: "notice" });
    return;
  }
  voiceRecording = true;
  voiceHadSpeech = false;
  voiceChunks = [];
  document.body.dataset.listening = "1";
  showSpeech(tr("voiceListening"), { duration: 1600, kind: "notice" });

  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  voiceRecorder = mime
    ? new MediaRecorder(voiceStream, { mimeType: mime })
    : new MediaRecorder(voiceStream);
  voiceRecorder.ondataavailable = (e) => { if (e.data && e.data.size) voiceChunks.push(e.data); };
  voiceRecorder.onstop = onVoiceStop;
  voiceRecorder.start();

  voiceMaxTimer = setTimeout(() => stopVoiceListening(), 30000);

  // Simple RMS VAD: once speech is heard, stop ~1.4s after it tapers off.
  try {
    voiceAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = voiceAudioCtx.createMediaStreamSource(voiceStream);
    voiceAnalyser = voiceAudioCtx.createAnalyser();
    voiceAnalyser.fftSize = 1024;
    src.connect(voiceAnalyser);
    const buf = new Uint8Array(voiceAnalyser.fftSize);
    const tick = () => {
      if (!voiceRecording || !voiceAnalyser) return;
      voiceAnalyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      if (rms > 0.045) {
        voiceHadSpeech = true;
        if (voiceSilenceTimer) { clearTimeout(voiceSilenceTimer); voiceSilenceTimer = null; }
      } else if (voiceHadSpeech && !voiceSilenceTimer) {
        voiceSilenceTimer = setTimeout(() => stopVoiceListening(), 1400);
      }
      voiceVadRaf = requestAnimationFrame(tick);
    };
    voiceVadRaf = requestAnimationFrame(tick);
  } catch {}
}

function stopVoiceListening(discard) {
  if (!voiceRecording) return;
  voiceRecording = false;
  delete document.body.dataset.listening;
  if (voiceVadRaf) cancelAnimationFrame(voiceVadRaf);
  voiceVadRaf = null;
  if (voiceSilenceTimer) { clearTimeout(voiceSilenceTimer); voiceSilenceTimer = null; }
  if (voiceMaxTimer) { clearTimeout(voiceMaxTimer); voiceMaxTimer = null; }
  if (discard && voiceRecorder) {
    try { voiceRecorder.ondataavailable = null; voiceRecorder.onstop = null; voiceRecorder.stop(); } catch {}
    voiceRecorder = null;
    cleanupVoiceAudio();
    return;
  }
  try { if (voiceRecorder && voiceRecorder.state !== "inactive") voiceRecorder.stop(); } catch {}
}

async function onVoiceStop() {
  const hadSpeech = voiceHadSpeech;
  const chunks = voiceChunks.slice();
  const mime = (voiceRecorder && voiceRecorder.mimeType) || "audio/webm";
  cleanupVoiceAudio();
  voiceRecorder = null;
  if (!chunks.length || !hadSpeech) return;
  const blob = new Blob(chunks, { type: mime });
  const bytes = await blob.arrayBuffer();
  try { await window.electronAPI.voiceSendAudio({ bytes, mime }); } catch {}
}

if (voiceListenButton) {
  voiceListenButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (voiceRecording) stopVoiceListening();
    else startVoiceListening();
  });
}
if (window.electronAPI.voiceConfigGet) {
  window.electronAPI.voiceConfigGet().then(applyVoiceConfig).catch(() => {});
  window.electronAPI.onVoiceConfigChanged(applyVoiceConfig);
}

// ── Push-to-talk: main sends ptt-start/ptt-stop as the hotkey is held/released.
//    We record the mic while held, then hand the audio to main which transcribes
//    it and answers against the screen it snapshotted at ptt-start. ──
let pttStream = null;
let pttRecorder = null;
let pttChunks = [];
let pttRecording = false;

async function pttStart() {
  if (pttRecording) return;
  try { if (window.electronAPI.voiceRequestMic) await window.electronAPI.voiceRequestMic(); } catch {}
  try {
    pttStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showSpeech(tr("micDenied"), { duration: 3000, kind: "notice" });
    return;
  }
  pttRecording = true;
  pttChunks = [];
  poseListening = true;
  updatePoseState();
  document.body.dataset.listening = "1";
  showSpeech(tr("voiceListening"), { duration: 1400, kind: "notice" });
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  pttRecorder = mime ? new MediaRecorder(pttStream, { mimeType: mime }) : new MediaRecorder(pttStream);
  pttRecorder.ondataavailable = (e) => { if (e.data && e.data.size) pttChunks.push(e.data); };
  pttRecorder.onstop = onPttRecorderStop;
  pttRecorder.start();
}

function pttStop() {
  if (!pttRecording) return;
  pttRecording = false;
  poseListening = false;
  updatePoseState();
  delete document.body.dataset.listening;
  try { if (pttRecorder && pttRecorder.state !== "inactive") pttRecorder.stop(); } catch {}
}

async function onPttRecorderStop() {
  const chunks = pttChunks.slice();
  const mime = (pttRecorder && pttRecorder.mimeType) || "audio/webm";
  if (pttStream) { pttStream.getTracks().forEach((t) => t.stop()); pttStream = null; }
  pttRecorder = null;
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: mime });
  const bytes = await blob.arrayBuffer();
  try { await window.electronAPI.pttSendAudio({ bytes, mime }); } catch {}
}

if (window.electronAPI.onPttStart) {
  window.electronAPI.onPttStart(pttStart);
  window.electronAPI.onPttStop(pttStop);
}

// Screen-question answer: streams into the speech bubble (phase start/delta),
// then finalizes (phase end) with a normal auto-close + a brief gaze toward the
// pointed element. Legacy single-shot payloads (no phase) still work.
if (window.electronAPI.onScreenAnswer) {
  window.electronAPI.onScreenAnswer((data) => {
    if (!data) return;
    if (data.phase === "start") {
      streamSpeech("");
      return;
    }
    if (data.phase === "delta") {
      streamSpeech(data.text || "");
      return;
    }
    // "end" (or legacy no-phase): final text with auto-close, then gaze.
    if (data.text) {
      const secs = Math.min(16000, Math.max(5000, data.text.length * 90));
      activeSpeechKind = "notice"; // let showSpeech replace the stream bubble
      showSpeech(data.text, { duration: secs, kind: "notice" });
    }
    if (data.gaze && Number.isFinite(data.gaze.dx)) {
      // Showing a spot = look at it. The gaze hold outlasts the arrow overlay
      // (~2.8s + fade) so the pet is still facing the target while it reads.
      setGazeOverride(data.gaze.dx, data.gaze.dy, 4500);
    }
  });
}

// Spoken answers (TTS): play the synthesized audio from main. Volume follows
// the single "Notification sound" slider (0 = user muted everything → skip).
let ttsPlayer = null;
if (window.electronAPI.onTtsAudio) {
  window.electronAPI.onTtsAudio((payload) => {
    if (!payload || !payload.audio || completionMeowVolume <= 0) return;
    try { if (ttsPlayer) ttsPlayer.pause(); } catch {}
    ttsPlayer = new Audio(`data:${payload.mime || "audio/mpeg"};base64,${payload.audio}`);
    ttsPlayer.volume = completionMeowVolume;
    ttsPlayer.play().catch(() => {});
  });
}
function applyTaskCompleteSoundVolume(volume) {
  completionMeowVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  completionMeow.volume = completionMeowVolume;
  reminderMeow.volume = getReminderMeowVolume();
}
window.electronAPI.taskCompleteSoundVolumeGet().then(applyTaskCompleteSoundVolume).catch(() => {});
window.electronAPI.onTaskCompleteSoundVolume(applyTaskCompleteSoundVolume);
window.electronAPI.pomodoroGet().then(applyPomodoroState).catch(() => {});
window.electronAPI.onPomodoroState(applyPomodoroState);
window.electronAPI.onPomodoroComplete((event) => {
  const isBreakStart = event && event.completedMode === "focus";
  const text = isBreakStart ? tr("startBreak", currentUserName) : tr("startFocus", currentUserName);
  // Break → a happy stretch-out; back to focus → the perked-up "!" look.
  if (isBreakStart) triggerPoseHappy();
  else triggerPoseListening();
  showSpeech(text, { kind: isBreakStart ? "break" : "focus" });
});
window.electronAPI.languageGet().then((language) => {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage;
  applyReminderI18n();
  applyPomodoroState(currentPomodoroState);
}).catch(() => {});
window.electronAPI.onLanguageChanged((language) => {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage;
  applyReminderI18n();
  applyPomodoroState(currentPomodoroState);
});

// ── Drag (좌클릭) + Context menu (우클릭) ──

const dragHandle = document.getElementById("drag-handle");
let dragging = false;
let lastX = 0;
let lastY = 0;
let pendingDrag = null;
let lastDragMoveAt = 0;
let pointerDownScreenX = 0;
let pointerDownScreenY = 0;
const DRAG_START_THRESHOLD_PX = 4;
function setPetMouseEventsEnabled(enabled) {
  const next = !!enabled;
  if (mouseEventsEnabled === next) return;
  mouseEventsEnabled = next;
  window.electronAPI.setMouseEventsEnabled(next);
}

function rectContains(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function currentPoseElement() {
  if (petdexMode && petdexEl) return petdexEl;
  return posesetEl;
}

// Pixel-level hit test from the build-time masks in pose-manifest.js (4 px
// cells, 8 px of slack). The old box test took ~70% of the pose box, so a
// ~340 px invisible zone around the cat swallowed clicks meant for the app
// underneath (seen on the landing page: FAQ toggles and sound buttons near
// the cat stopped responding). null = no mask (petdex, old manifest) → box test.
const poseMaskBits = new Map();
function maskHit(mask, px, py) {
  if (!mask || !mask.b) return null;
  let bits = poseMaskBits.get(mask.b);
  if (!bits) {
    bits = Uint8Array.from(atob(mask.b), (c) => c.charCodeAt(0));
    poseMaskBits.set(mask.b, bits);
  }
  const cx = Math.floor(px / mask.g), cy = Math.floor(py / mask.g);
  if (cx < 0 || cy < 0 || cx >= mask.w || cy >= mask.h) return false;
  const i = cy * mask.w + cx;
  return (bits[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

// Layout (pre-transform) position of an element in the window.
function layoutOrigin(el) {
  let x = 0, y = 0;
  for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
  return { x, y };
}

// Window point → the element's own untransformed box. #poseset is centred with
// translateX(-50%) and tilts toward the cursor (rotate about its bottom
// centre), so undo its computed transform around its transform-origin.
function clientToBox(el, x, y) {
  const o = layoutOrigin(el);
  const cs = getComputedStyle(el);
  if (!cs.transform || cs.transform === "none") return { x: x - o.x, y: y - o.y };
  const [tx, ty] = cs.transformOrigin.split(" ").map(parseFloat);
  const p = new DOMMatrix(cs.transform).inverse().transformPoint(new DOMPoint(x - o.x - tx, y - o.y - ty));
  return { x: p.x + tx, y: p.y + ty };
}

function poseMaskHit(x, y) {
  if (!poseMode || petdexMode || !posesetEl) return null;
  const m = poseManifest();
  const r = poseIdleRect();
  if (!m || !r || !m.mask) return null;
  const { x: lx, y: ly } = clientToBox(posesetEl, x, y);
  const c = poseAnimState ? m.states[poseAnimState] : null;
  if (c) {
    if (!c.masks) return null;
    const mask = c.masks[Math.max(0, poseAnimFrameShown)] || c.masks[0];
    return maskHit(mask, (lx - (r.x + c.ox * r.s)) / r.s, (ly - (r.y + c.oy * r.s)) / r.s);
  }
  return maskHit(m.mask, (lx - r.x) / r.s, (ly - r.y) / r.s);
}

function isCatHitPoint(x, y) {
  const exact = poseMaskHit(x, y);
  if (exact !== null) return exact;
  const pose = currentPoseElement();
  if (!pose) return false;
  const rect = pose.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !rectContains(rect, x, y)) return false;
  // Generous box over the lower-centre where the illustration sits (contain,
  // bottom-anchored), excluding the transparent top/side margins of the box.
  const nx = (x - rect.left) / rect.width;
  const ny = (y - rect.top) / rect.height;
  return nx >= 0.16 && nx <= 0.84 && ny >= 0.12 && ny <= 0.99;
}

function shouldReceiveMouseAt(x, y) {
  if (dragging) return true;
  if (catNameEditor && getComputedStyle(catNameEditor).display !== "none" && rectContains(catNameEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (userNameEditor && getComputedStyle(userNameEditor).display !== "none" && rectContains(userNameEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (personaEditor && getComputedStyle(personaEditor).display !== "none" && rectContains(personaEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (fixedMessageEditor && getComputedStyle(fixedMessageEditor).display !== "none" && rectContains(fixedMessageEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (pomodoroFocusEditor && getComputedStyle(pomodoroFocusEditor).display !== "none" && rectContains(pomodoroFocusEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (screenAskEditor && getComputedStyle(screenAskEditor).display !== "none" && rectContains(screenAskEditor.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (reminderClockButton && getComputedStyle(reminderClockButton).display !== "none" && rectContains(reminderClockButton.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (voiceListenButton && getComputedStyle(voiceListenButton).display !== "none" && rectContains(voiceListenButton.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (reminderPanel && getComputedStyle(reminderPanel).display !== "none" && rectContains(reminderPanel.getBoundingClientRect(), x, y)) {
    return true;
  }
  if (catSpeechBubble && getComputedStyle(catSpeechBubble).display !== "none" && rectContains(catSpeechBubble.getBoundingClientRect(), x, y)) {
    return true;
  }
  return isCatHitPoint(x, y);
}

function updateMouseEventPassthrough(event) {
  if (!event) {
    setPetMouseEventsEnabled(false);
    return;
  }
  setPetMouseEventsEnabled(shouldReceiveMouseAt(event.clientX, event.clientY));
}

requestAnimationFrame(() => setPetMouseEventsEnabled(false));

// Start moving the window: show the "move" pose (its own sway/side-view
// animation lives in poseMoveFrame).
function beginDrag(currentEvent) {
  if (dragging) return;
  dragging = true;
  lastX = currentEvent.screenX;
  lastY = currentEvent.screenY;
  poseListening = false;
  clearTimeout(poseListeningTimer);
  updatePoseState();
}

function clearPendingDrag() {
  pendingDrag = null;
}

window.addEventListener("mousedown", (e) => {
  pointerDownScreenX = e.screenX;
  pointerDownScreenY = e.screenY;
}, { capture: true });

dragHandle.addEventListener("mousedown", (e) => {
  if (!isCatHitPoint(e.clientX, e.clientY)) return;
  if (e.button === 0) {
    setPetMouseEventsEnabled(true);
    pendingDrag = {
      screenX: e.screenX,
      screenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
      startedAt: Date.now(),
    };
    e.preventDefault();
  }
});

window.addEventListener("mousemove", updateMouseEventPassthrough, { passive: true });

window.addEventListener("mousemove", (e) => {
  const pointerMoved = Math.hypot(e.screenX - pointerDownScreenX, e.screenY - pointerDownScreenY);
  if (e.buttons && pointerMoved > DRAG_START_THRESHOLD_PX) {
    lastDragMoveAt = Date.now();
  }
  if (pendingDrag) {
    const pendingMoved = Math.hypot(e.screenX - pendingDrag.screenX, e.screenY - pendingDrag.screenY);
    if ((e.buttons & 1) && pendingMoved > DRAG_START_THRESHOLD_PX) {
      beginDrag(e);
      clearPendingDrag();
    } else if (!(e.buttons & 1)) {
      clearPendingDrag();
    }
  }
  if (!dragging) return;
  const dx = e.screenX - lastX;
  const dy = e.screenY - lastY;
  if (dx !== 0 || dy !== 0) {
    lastDragMoveAt = Date.now();
    window.electronAPI.dragWindow(dx, dy);
    // The "move" pose: horizontal drag feeds the side-view switch and swings
    // the hanging body (it lags behind the movement).
    poseDragDxAcc += dx;
    poseSwayVel = Math.max(-6, Math.min(6, poseSwayVel - dx * 0.12));
    lastX = e.screenX;
    lastY = e.screenY;
  }
});

window.addEventListener("mouseup", (e) => {
  const wasPendingDrag = !!pendingDrag;
  clearPendingDrag();
  // A click (mouse down + up without a drag) on the body plays the
  // "listening" reaction.
  if (!dragging && e.button === 0) {
    const moved = Math.hypot(e.screenX - pointerDownScreenX, e.screenY - pointerDownScreenY);
    if (wasPendingDrag && moved <= DRAG_START_THRESHOLD_PX && isCatHitPoint(e.clientX, e.clientY)) {
      triggerPoseListening();
    }
  }
  if (dragging) {
    dragging = false;
    updatePoseState();
    window.electronAPI.dragWindowEnded();
    // Spatial AI: dropping the cat (with Option/Alt held, or when "analyze on
    // every drop" is enabled in settings) asks the main process to capture the
    // region under the cat and offer tasks. Main gates on the AI config.
    if (window.electronAPI.aiTriggerDrop) {
      window.electronAPI.aiTriggerDrop({ alt: e.altKey });
    }
  }
  updateMouseEventPassthrough(e);
});

window.addEventListener("mouseleave", () => {
  if (!dragging) setPetMouseEventsEnabled(false);
  clearPendingDrag();
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (dragging || Date.now() - lastDragMoveAt < 350) return;
  window.electronAPI.showContextMenu();
});
