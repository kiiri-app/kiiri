"use strict";

const { app, BrowserWindow, Tray, screen, ipcMain, Menu, desktopCapturer, dialog, nativeImage, globalShortcut, shell, systemPreferences } = require("electron");
const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  async checkForUpdates() {},
  async downloadUpdate() {},
  quitAndInstall() {},
  on() {},
  off() {},
  removeListener() {},
  removeAllListeners() {},
  emit() {},
  setFeedURL() {},
};
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const aiConfig = require("./ai/config");
const aiAssistant = require("./ai/assistant");
const aiAgent = require("./ai/agent");
const aiVoice = require("./ai/voice");
const aiJournal = require("./ai/journal/store");
const aiCardgen = require("./ai/journal/cardgen");
const aiMemory = require("./ai/memory/store");
const charStore = require("./characters");
const { localizedTasks } = require("./ai/tasks");

const IS_MAC = process.platform === "darwin";
const IS_WINDOWS = process.platform === "win32";
const IS_SMOKE_TEST = process.argv.includes("--kiri-smoke-test");

if (IS_WINDOWS && !process.env.PREBUILDS_ONLY) {
  process.env.PREBUILDS_ONLY = "1";
}

const STARTUP_LOG_PATH = (() => {
  try {
    return path.join(app.getPath("userData"), "logs", "main.log");
  } catch {
    return null;
  }
})();

function appendStartupLog(level, args) {
  if (!STARTUP_LOG_PATH) return;
  try {
    fs.mkdirSync(path.dirname(STARTUP_LOG_PATH), { recursive: true });
    const message = Array.from(args).map((item) => {
      if (item instanceof Error) return item.stack || item.message;
      if (typeof item === "string") return item;
      try { return JSON.stringify(item); } catch { return String(item); }
    }).join(" ");
    fs.appendFileSync(STARTUP_LOG_PATH, `[${new Date().toISOString()}] [${level}] ${message}\n`);
  } catch {}
}

function logInfo(...args) {
  console.log(...args);
  appendStartupLog("info", args);
}

function logWarn(...args) {
  console.warn(...args);
  appendStartupLog("warn", args);
}

function logError(...args) {
  console.error(...args);
  appendStartupLog("error", args);
}

process.on("uncaughtException", (error) => {
  logError("[Kiri] uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  logError("[Kiri] unhandled rejection:", reason);
});

let uIOhook = null;
let UiohookKey = null;
try {
  ({ uIOhook, UiohookKey } = require("uiohook-napi"));
} catch (error) {
  logWarn("[Kiri] uiohook-napi is unavailable:", error && error.message ? error.message : error);
}

let petWin = null;
// Multi-character: each character is its own pet window. `petWin` always points
// at the active (last-interacted) character's window so the existing single-cat
// code paths keep working; interaction handlers call setActiveChar(sender) first.
let characters = [];
let activeCharId = null;
const petWins = new Map();            // charId -> BrowserWindow
const webContentsToChar = new Map();  // webContents.id -> charId
let aiPanelWin = null;
let aiSettingsWin = null;
let aiCommandWin = null;
let aiJournalWin = null;
let memoryWin = null;
let overlayWin = null;
let journalReminderTimer = null;
let lastJournalNudgeAt = 0;
let aiPanelReady = false;
let aiPanelPendingMenu = null;
let aiCommandReady = false;
let aiCommandPendingVoice = null;
let aiBusy = false;
let cursorPollTimer = null;
let keyHookStarted = false;
let keyHookListenersAttached = false;
let keyHookRetryTimer = null;
const APP_ICON_PATH = path.join(__dirname, "assets", "kiri-logo.png");
const AGENT_STATE_PORT = 23456;
const AGENT_ACTIVE_TTL_MS = 10 * 60 * 1000;
let agentStateToken = null;

// Shared secret between the local agent-state server and the hook scripts.
// Stored under userData so the copied hooks (userData/hooks/*) can read it via
// their own relative path; keeps arbitrary local processes / web pages from
// injecting fake agent states.
function ensureAgentStateToken() {
  if (agentStateToken) return agentStateToken;
  const tokenPath = path.join(app.getPath("userData"), "agent-state-token");
  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (existing) {
      agentStateToken = existing;
      return agentStateToken;
    }
  } catch {
    // fall through to create
  }
  agentStateToken = crypto.randomBytes(16).toString("hex");
  try {
    fs.writeFileSync(tokenPath, agentStateToken, { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    console.warn("[Kiri] agent state token save failed:", err && err.message);
  }
  return agentStateToken;
}
let agentStateServer = null;
let agentSweepTimer = null;
let codexMonitor = null;
let kiroMonitor = null;
let cursorAgentMonitor = null;
const activeAgentSessions = new Map();
let agentMonitoringEnabled = true;
let tray = null;
const AGENT_DISPLAY = { "claude-code": "Claude Code", cursor: "Cursor", codex: "Codex", kiro: "Kiro", antigravity: "Antigravity" };
let regularCheckTimer = null;
let regularCheckRunning = false;
let updateInstallPending = false;
let pendingManualUpdateCheck = false;

const SUPPORTED_LANGUAGES = ["en", "ko", "ja", "tr"];
const REGULAR_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let currentLanguage = "en";

const I18N = {
  en: {
    appMenuAbout: "About Kiri",
    appMenuQuit: "Quit",
    checkForUpdates: "Check for Updates",
    editMenu: "Edit",
    contextTitle: "Kiri",
    size: "Size",
    smaller: "Smaller (-20)",
    larger: "Larger (+20)",
    resetSize: "Reset size (100 × 100)",
    petSizePixels: (size) => `${size} × ${size}`,
    setUserName: "Tell my name",
    setCatName: "Set Kiri name",
    showCatName: "Show Kiri name",
    aiAssistant: "🐾 AI Assistant…",
    askScreen: "🔍 Ask about my screen…",
    aiMemory: "🧠 Memory…",
    memoryTitle: "Memory",
    memoryKindTask: "Task",
    memoryFileCreated: (name) => `Created ${name}`,
    aiCommand: "💬 Give Kiri a command…",
    aiJournal: "📚 Knowledge Journal…",
    setCatPersona: "Set this cat's personality…",
    pixelEditor: "🖌️ Edit pixels…",
    addCharacter: "➕ Add character",
    removeCharacter: "➖ Remove this character",
    tasks: "Tasks",
    agentMonitoring: "Watch AI agents (Claude Code…)",
    aiAgents: "AI agents",
    noActiveAgents: "No active agents",
    agentWorking: "working…",
    personaGuide: "Give this cat a personality. It shapes how it answers in AI tasks.",
    personaPlaceholder: "e.g. cheerful and concise tutor",
    fixedMessage: "Fixed message",
    reminders: "Reminders",
    remindersOpen: "Open reminders",
    showReminderButtonOutside: "Show button outside",
    pomodoro: "Pomodoro",
    pomodoroStart: "Start",
    pomodoroPause: "Pause",
    pomodoroResume: "Resume",
    pomodoroReset: "Reset",
    pomodoroFocusTime: "Focus time",
    pomodoroRestTime: "Break time",
    pomodoroFocusLabel: "Focus",
    pomodoroRestLabel: "Break",
    pomodoroMinutes: (min) => `${min} min`,
    pomodoroCustom: "Custom",
    taskCompleteSound: "Notification sound",
    soundOff: "Off",
    soundLow: "Low",
    soundNormal: "Normal",
    soundHigh: "High",
    off: "Off",
    language: "Language",
    english: "English",
    korean: "Korean",
    japanese: "Japanese",
    turkish: "Turkish",
    accessibilityPermissionTitle: "Accessibility permission needed",
    accessibilityPermissionMessage: "Allow Kiri to react to typing",
    accessibilityPermissionDetail: "Turn on Kiri in Accessibility, then restart Kiri if typing reactions do not start.",
    inputPermissionTitle: "Input Monitoring may be needed",
    inputPermissionMessage: "Kiri still cannot detect typing",
    inputPermissionDetail: "Some macOS environments also require Input Monitoring. Add Kiri in Input Monitoring, then restart Kiri if typing reactions do not start.",
    openInputMonitoring: "Open Input Monitoring",
    openAccessibility: "Open Accessibility",
    globalInputPermissionTitle: "Input monitoring unavailable",
    globalInputPermissionMessage: "Kiri cannot detect keyboard or wheel input",
    globalInputPermissionDetail: "Restart Kiri and check whether Windows security software or system policy is blocking global input hooks.",
    reset: "Reset",
    clear: "Clear",
    delete: "Delete",
    later: "Later",
    aiKeyRequired: "API key needed — add one in AI Assistant settings.",
    aiAnalyzeFailed: "Analysis failed.",
    aiError: "AI error.",
    voiceNotUnderstood: "I didn't catch that — try again.",
    voiceTranscribeFailed: "Couldn't understand the audio.",
    journalDueNudge: (due) => `📚 ${due} card${due === 1 ? "" : "s"} ready to review`,
    overlayEditorTitle: "Pixel Editor",
    journalWindowTitle: "Knowledge Journal",
    overlayDefaultName: "Design",
    confirmYes: "Yes",
    confirmCancel: "Cancel",
    confirmQuestion: "Are you sure?",
  },
  ko: {
    appMenuAbout: "Kiri에 관하여",
    appMenuQuit: "종료",
    checkForUpdates: "업데이트 확인",
    editMenu: "편집",
    contextTitle: "Kiri",
    size: "크기",
    smaller: "조금 작게 (-20)",
    larger: "조금 크게 (+20)",
    resetSize: "크기 초기화 (100 × 100)",
    petSizePixels: (size) => `${size} × ${size}`,
    setUserName: "내 이름 알려주기",
    setCatName: "캣짱 이름 지정",
    showCatName: "캣짱 이름 표시",
    aiAssistant: "🐾 AI 어시스턴트…",
    askScreen: "🔍 내 화면에 대해 묻기…",
    aiMemory: "🧠 기억…",
    memoryTitle: "기억",
    memoryKindTask: "작업",
    memoryFileCreated: (name) => `${name} 만듦`,
    aiCommand: "💬 캣짱에게 명령하기…",
    aiJournal: "📚 지식 노트…",
    setCatPersona: "이 고양이의 성격 설정…",
    pixelEditor: "🖌️ 픽셀 편집…",
    addCharacter: "➕ 캐릭터 추가",
    removeCharacter: "➖ 이 캐릭터 제거",
    tasks: "작업",
    agentMonitoring: "AI 에이전트 감시 (Claude Code…)",
    aiAgents: "AI 에이전트",
    noActiveAgents: "활성 에이전트 없음",
    agentWorking: "작업 중…",
    personaGuide: "이 고양이에게 성격을 부여하세요. AI 작업 응답 방식에 반영됩니다.",
    personaPlaceholder: "예: 밝고 간결한 튜터",
    fixedMessage: "고정 메시지",
    reminders: "알림",
    remindersOpen: "알림 열기",
    showReminderButtonOutside: "바깥에 버튼 표시",
    pomodoro: "뽀모도로",
    pomodoroStart: "시작",
    pomodoroPause: "일시정지",
    pomodoroResume: "다시 시작",
    pomodoroReset: "초기화",
    pomodoroFocusTime: "집중 시간",
    pomodoroRestTime: "휴식 시간",
    pomodoroFocusLabel: "집중",
    pomodoroRestLabel: "휴식",
    pomodoroMinutes: (min) => `${min}분`,
    pomodoroCustom: "커스텀",
    taskCompleteSound: "알림음",
    soundOff: "끄기",
    soundLow: "작게",
    soundNormal: "보통",
    soundHigh: "크게",
    off: "끄기",
    language: "언어",
    english: "영어",
    korean: "한국어",
    japanese: "일본어",
    turkish: "터키어",
    accessibilityPermissionTitle: "손쉬운 사용 권한이 필요해요",
    accessibilityPermissionMessage: "캣짱이 타이핑에 반응하도록 허용해 주세요",
    accessibilityPermissionDetail: "손쉬운 사용에서 Kiri을 켜 주세요. 타이핑 반응이 바로 시작되지 않으면 캣짱을 다시 실행해 주세요.",
    inputPermissionTitle: "입력 모니터링이 필요할 수 있어요",
    inputPermissionMessage: "캣짱이 아직 키보드 입력을 감지하지 못하고 있어요",
    inputPermissionDetail: "일부 macOS 환경에서는 입력 모니터링도 필요해요. 입력 모니터링에 Kiri을 추가한 뒤, 타이핑 반응이 시작되지 않으면 캣짱을 다시 실행해 주세요.",
    openInputMonitoring: "입력 모니터링 열기",
    openAccessibility: "손쉬운 사용 열기",
    globalInputPermissionTitle: "입력 감지를 사용할 수 없어요",
    globalInputPermissionMessage: "Kiri이 키보드 또는 휠 입력을 감지하지 못하고 있어요",
    globalInputPermissionDetail: "Kiri을 다시 실행해 보세요. 계속 실패하면 Windows 보안 프로그램이나 시스템 정책이 전역 입력 후킹을 막고 있는지 확인해 주세요.",
    reset: "초기화",
    clear: "지우기",
    delete: "삭제",
    later: "나중에",
    aiKeyRequired: "API 키가 필요해요 — AI 어시스턴트 설정에서 추가해 주세요.",
    aiAnalyzeFailed: "분석에 실패했어요.",
    aiError: "AI 오류가 났어요.",
    voiceNotUnderstood: "못 알아들었다냥, 다시 말해줘냥.",
    voiceTranscribeFailed: "음성을 알아듣지 못했어요.",
    journalDueNudge: (due) => `📚 카드 ${due}장 복습할 시간이다냥`,
    overlayEditorTitle: "픽셀 편집기",
    journalWindowTitle: "지식 노트",
    overlayDefaultName: "디자인",
    confirmYes: "네",
    confirmCancel: "취소",
    confirmQuestion: "진행할까요?",
  },
  ja: {
    appMenuAbout: "Kiri について",
    appMenuQuit: "終了",
    checkForUpdates: "アップデートを確認",
    editMenu: "編集",
    contextTitle: "Kiri",
    size: "サイズ",
    smaller: "少し小さく (-20)",
    larger: "少し大きく (+20)",
    resetSize: "サイズをリセット (100 × 100)",
    petSizePixels: (size) => `${size} × ${size}`,
    setUserName: "自分の名前を教える",
    setCatName: "Kiri の名前を設定",
    showCatName: "Kiri の名前を表示",
    aiAssistant: "🐾 AI アシスタント…",
    askScreen: "🔍 画面について聞く…",
    aiMemory: "🧠 記憶…",
    memoryTitle: "記憶",
    memoryKindTask: "タスク",
    memoryFileCreated: (name) => `${name} を作成`,
    aiCommand: "💬 Kiri に指示する…",
    aiJournal: "📚 ナレッジノート…",
    setCatPersona: "この猫の性格を設定…",
    pixelEditor: "🖌️ ピクセル編集…",
    tasks: "タスク",
    agentMonitoring: "AIエージェントを監視 (Claude Code…)",
    aiAgents: "AIエージェント",
    noActiveAgents: "アクティブなエージェントなし",
    agentWorking: "作業中…",
    addCharacter: "➕ キャラクター追加",
    removeCharacter: "➖ このキャラクターを削除",
    personaGuide: "この猫に性格を与えます。AIタスクでの応答の仕方に反映されます。",
    personaPlaceholder: "例: 明るく簡潔なチューター",
    fixedMessage: "固定メッセージ",
    reminders: "通知",
    remindersOpen: "通知を開く",
    showReminderButtonOutside: "外側にボタンを表示",
    pomodoro: "ポモドーロ",
    pomodoroStart: "開始",
    pomodoroPause: "一時停止",
    pomodoroResume: "再開",
    pomodoroReset: "リセット",
    pomodoroFocusTime: "集中時間",
    pomodoroRestTime: "休憩時間",
    pomodoroFocusLabel: "集中",
    pomodoroRestLabel: "休憩",
    pomodoroMinutes: (min) => `${min}分`,
    pomodoroCustom: "カスタム",
    taskCompleteSound: "通知音",
    soundOff: "オフ",
    soundLow: "小",
    soundNormal: "標準",
    soundHigh: "大",
    off: "オフ",
    language: "言語",
    english: "英語",
    korean: "韓国語",
    japanese: "日本語",
    turkish: "トルコ語",
    accessibilityPermissionTitle: "アクセシビリティ権限が必要です",
    accessibilityPermissionMessage: "Kiri がタイピングに反応できるよう許可してください",
    accessibilityPermissionDetail: "アクセシビリティで Kiri をオンにしてください。タイピング反応が始まらない場合は Kiri を再起動してください。",
    inputPermissionTitle: "入力監視が必要な場合があります",
    inputPermissionMessage: "Kiri がまだキーボード入力を検出できません",
    inputPermissionDetail: "一部の macOS 環境では入力監視も必要です。入力監視に Kiri を追加し、タイピング反応が始まらない場合は Kiri を再起動してください。",
    openInputMonitoring: "入力監視を開く",
    openAccessibility: "アクセシビリティを開く",
    globalInputPermissionTitle: "入力検出を使用できません",
    globalInputPermissionMessage: "Kiri がキーボードまたはホイール入力を検出できません",
    globalInputPermissionDetail: "Kiri を再起動してください。解決しない場合は、Windows のセキュリティソフトまたはシステムポリシーがグローバル入力フックをブロックしていないか確認してください。",
    reset: "リセット",
    clear: "クリア",
    delete: "削除",
    later: "後で",
    aiKeyRequired: "API キーが必要です — AI アシスタント設定で追加してください。",
    aiAnalyzeFailed: "分析に失敗しました。",
    aiError: "AI エラーです。",
    voiceNotUnderstood: "聞き取れなかったにゃ、もう一度言ってにゃ。",
    voiceTranscribeFailed: "音声を聞き取れませんでした。",
    journalDueNudge: (due) => `📚 カード${due}枚の復習時間だにゃ`,
    overlayEditorTitle: "ピクセルエディター",
    journalWindowTitle: "ナレッジノート",
    overlayDefaultName: "デザイン",
    confirmYes: "はい",
    confirmCancel: "キャンセル",
    confirmQuestion: "よろしいですか？",
  },
  tr: {
    appMenuAbout: "Kiri Hakkında",
    appMenuQuit: "Çıkış",
    checkForUpdates: "Güncellemeleri Denetle",
    editMenu: "Düzen",
    contextTitle: "Kiri",
    size: "Boyut",
    smaller: "Biraz küçült (-20)",
    larger: "Biraz büyüt (+20)",
    resetSize: "Boyutu sıfırla (100 × 100)",
    petSizePixels: (size) => `${size} × ${size}`,
    setUserName: "Adımı söyle",
    setCatName: "Kiri'nin adını değiştir",
    showCatName: "Kiri'nin adını göster",
    aiAssistant: "🐾 AI Asistan…",
    askScreen: "🔍 Ekranımı sor…",
    aiMemory: "🧠 Hafıza…",
    memoryTitle: "Hafıza",
    memoryKindTask: "Görev",
    memoryFileCreated: (name) => `${name} oluşturuldu`,
    aiCommand: "💬 Kiri'ye komut ver…",
    aiJournal: "📚 Bilgi Defteri…",
    setCatPersona: "Bu kedinin kişiliğini ayarla…",
    pixelEditor: "🖌️ Pikselleri düzenle…",
    addCharacter: "➕ Karakter ekle",
    removeCharacter: "➖ Bu karakteri kaldır",
    tasks: "Görevler",
    agentMonitoring: "AI ajanlarını izle (Claude Code…)",
    aiAgents: "AI ajanları",
    noActiveAgents: "Aktif ajan yok",
    agentWorking: "çalışıyor…",
    personaGuide: "Bu kediye bir kişilik ver — AI görevlerinde nasıl yanıt vereceğini etkiler.",
    personaPlaceholder: "ör. neşeli ve özlü bir hoca",
    fixedMessage: "Sabit mesaj",
    reminders: "Hatırlatıcılar",
    remindersOpen: "Hatırlatıcıları aç",
    showReminderButtonOutside: "Düğmeyi dışarıda göster",
    pomodoro: "Pomodoro",
    pomodoroStart: "Başlat",
    pomodoroPause: "Duraklat",
    pomodoroResume: "Devam et",
    pomodoroReset: "Sıfırla",
    pomodoroFocusTime: "Odak süresi",
    pomodoroRestTime: "Mola süresi",
    pomodoroFocusLabel: "Odak",
    pomodoroRestLabel: "Mola",
    pomodoroMinutes: (min) => `${min} dk`,
    pomodoroCustom: "Özel",
    taskCompleteSound: "Bildirim sesi",
    soundOff: "Kapalı",
    soundLow: "Kısık",
    soundNormal: "Normal",
    soundHigh: "Yüksek",
    off: "Kapalı",
    language: "Dil",
    english: "İngilizce",
    korean: "Korece",
    japanese: "Japonca",
    turkish: "Türkçe",
    accessibilityPermissionTitle: "Erişilebilirlik izni gerekiyor",
    accessibilityPermissionMessage: "Kiri'nin yazmana tepki verebilmesi için izin ver",
    accessibilityPermissionDetail: "Erişilebilirlik'te Kiri'yi aç; yazma tepkileri başlamazsa Kiri'yi yeniden başlat.",
    inputPermissionTitle: "Giriş İzleme de gerekebilir",
    inputPermissionMessage: "Kiri hâlâ yazdığını algılayamıyor",
    inputPermissionDetail: "Bazı macOS ortamlarında Giriş İzleme izni de gerekir. Kiri'yi Giriş İzleme'ye ekle; yazma tepkileri yine başlamazsa Kiri'yi yeniden başlat.",
    openInputMonitoring: "Giriş İzleme'yi aç",
    openAccessibility: "Erişilebilirlik'i aç",
    globalInputPermissionTitle: "Giriş algılama kullanılamıyor",
    globalInputPermissionMessage: "Kiri klavye veya tekerlek girişini algılayamıyor",
    globalInputPermissionDetail: "Kiri'yi yeniden başlat; sorun sürerse Windows güvenlik yazılımının veya sistem politikasının genel giriş kancalarını engelleyip engellemediğini kontrol et.",
    reset: "Sıfırla",
    clear: "Temizle",
    delete: "Sil",
    later: "Sonra",
    aiKeyRequired: "API anahtarı gerekli — AI Asistan ayarlarından ekle.",
    aiAnalyzeFailed: "Analiz başarısız oldu.",
    aiError: "AI hatası.",
    voiceNotUnderstood: "Anlamadım, tekrar dene.",
    voiceTranscribeFailed: "Ses çözümlenemedi.",
    journalDueNudge: (due) => `📚 ${due} kart tekrar zamanı`,
    overlayEditorTitle: "Piksel Editörü",
    journalWindowTitle: "Bilgi Defteri",
    overlayDefaultName: "Tasarım",
    confirmYes: "Evet",
    confirmCancel: "Vazgeç",
    confirmQuestion: "Onaylıyor musun?",
  },
};

function t(key, ...args) {
  const table = I18N[currentLanguage] || I18N.en;
  const value = table[key] || I18N.en[key] || key;
  return typeof value === "function" ? value(...args) : value;
}

function normalizeLanguage(language) {
  const lang = String(language || "").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : "en";
}

function defaultLanguage() {
  return normalizeLanguage(app.getLocale && app.getLocale());
}

// ── 패턴 (사용자 커스텀 무늬) ──
// { baseColor, eyeColor, eyeBgColor, oddEye, eyeColorLeft, eyeColorRight,
//   head: [{x, y, color}], body: [...], tail: [...] }
// baseColor: 캣짱 기본 몸통 색 (타이핑/스트레칭 lerp의 시작점).
// eyeColor: 양쪽 공통 눈동자 색 (oddEye=false일 때 사용).
// eyeBgColor: 눈 배경색.
// oddEye=true이면 eyeColorLeft/eyeColorRight 따로 적용 (viewer 기준 좌/우).
const DEFAULT_BASE_COLOR = "#1A1A1A";
const DEFAULT_EYE_COLOR = "#1A1A1A";
const DEFAULT_EYE_BG_COLOR = "#FFFFFF";
let currentPattern = {
  selectedPresetId: null,
  baseColor: DEFAULT_BASE_COLOR,
  eyeColor: DEFAULT_EYE_COLOR,
  eyeBgColor: DEFAULT_EYE_BG_COLOR,
  oddEye: false,
  eyeColorLeft: DEFAULT_EYE_COLOR,
  eyeColorRight: DEFAULT_EYE_COLOR,
  head: [], body: [], tail: [],
  legFl: [], legFr: [], legRl: [], legRr: [],
  earL: [], earR: [],
};
function patternPath() {
  return path.join(app.getPath("userData"), "pattern.json");
}
function sanitizePattern(data) {
  const pattern = data && typeof data === "object" ? data : {};
  return {
    selectedPresetId: typeof pattern.selectedPresetId === "string" ? pattern.selectedPresetId : null,
    baseColor: typeof pattern.baseColor === "string" ? pattern.baseColor : DEFAULT_BASE_COLOR,
    eyeColor: typeof pattern.eyeColor === "string" ? pattern.eyeColor : DEFAULT_EYE_COLOR,
    eyeBgColor: typeof pattern.eyeBgColor === "string" ? pattern.eyeBgColor : DEFAULT_EYE_BG_COLOR,
    oddEye: !!pattern.oddEye,
    eyeColorLeft: typeof pattern.eyeColorLeft === "string" ? pattern.eyeColorLeft : (pattern.eyeColor || DEFAULT_EYE_COLOR),
    eyeColorRight: typeof pattern.eyeColorRight === "string" ? pattern.eyeColorRight : (pattern.eyeColor || DEFAULT_EYE_COLOR),
    head: Array.isArray(pattern.head) ? pattern.head : [],
    body: Array.isArray(pattern.body) ? pattern.body : [],
    tail: Array.isArray(pattern.tail) ? pattern.tail : [],
    legFl: Array.isArray(pattern.legFl) ? pattern.legFl : [],
    legFr: Array.isArray(pattern.legFr) ? pattern.legFr : [],
    legRl: Array.isArray(pattern.legRl) ? pattern.legRl : [],
    legRr: Array.isArray(pattern.legRr) ? pattern.legRr : [],
    earL: Array.isArray(pattern.earL) ? pattern.earL : [],
    earR: Array.isArray(pattern.earR) ? pattern.earR : [],
  };
}
function loadPattern() {
  try {
    if (fs.existsSync(patternPath())) {
      const data = JSON.parse(fs.readFileSync(patternPath(), "utf8"));
      if (data && typeof data === "object") {
        currentPattern = sanitizePattern(data);
      }
    }
  } catch {}
}
function savePattern() {
  try {
    fs.writeFileSync(patternPath(), JSON.stringify(currentPattern));
  } catch {}
}
function broadcastPattern() {
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("pattern-changed", currentPattern);
  }
}

// ── 자동 스트레칭 설정 ──
const DEFAULT_STRETCH_INTERVAL_MIN = 30;
const RELEASE_EXCLUDED_STRETCH_INTERVAL_MIN = 1;
let stretchIntervalMin = DEFAULT_STRETCH_INTERVAL_MIN; // 0 = 끔
let stretchTimer = null;
let reminders = [];
let reminderTimer = null;
let catName = "Kiri";
let userName = "";
let showCatName = true;
let fixedMessage = "";
let showReminderButtonOutside = true;
let pomodoroFocusMin = 25;
let pomodoroRestSec = 5 * 60;
let pomodoroMode = "focus";
let pomodoroRunning = false;
let pomodoroVisible = false;
let pomodoroRemainingSec = pomodoroFocusMin * 60;
let pomodoroTimer = null;
let accessibilityPermissionGuideShown = false;
let inputPermissionGuideShown = false;
let catNamePromptShown = false;
let taskCompleteSoundVolume = 0.1;

function releaseBuildExcludesDevOptions() {
  return app.isPackaged;
}

function normalizeStretchIntervalForBuild(min) {
  if (releaseBuildExcludesDevOptions() && min === RELEASE_EXCLUDED_STRETCH_INTERVAL_MIN) {
    return DEFAULT_STRETCH_INTERVAL_MIN;
  }
  return min;
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function normalizePetSize(size) {
  return Math.max(40, Math.min(400, Math.round(Number(size) || DEFAULT_SIZE)));
}

function normalizePetPosition(position) {
  if (!position || typeof position !== "object") return null;
  const x = Math.round(Number(position.x));
  const y = Math.round(Number(position.y));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath())) {
      const data = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
      if (typeof data.stretchIntervalMin === "number" && data.stretchIntervalMin >= 0) {
        stretchIntervalMin = normalizeStretchIntervalForBuild(data.stretchIntervalMin);
      }
      if (Array.isArray(data.reminders)) {
        reminders = data.reminders.map(sanitizeReminder).filter(Boolean);
      }
      if (typeof data.language === "string") {
        currentLanguage = normalizeLanguage(data.language);
      }
      if (typeof data.catName === "string" && data.catName.trim()) {
        catName = data.catName.trim().slice(0, 24);
      }
      if (typeof data.userName === "string") {
        userName = data.userName.trim().slice(0, 24);
      }
      if (typeof data.showCatName === "boolean") {
        showCatName = data.showCatName;
      }
      if (typeof data.fixedMessage === "string") {
        fixedMessage = data.fixedMessage.trim().slice(0, 80);
      }
      if (typeof data.showReminderButtonOutside === "boolean") {
        showReminderButtonOutside = data.showReminderButtonOutside;
      }
      if (typeof data.catNamePromptShown === "boolean") {
        catNamePromptShown = data.catNamePromptShown;
      }
      if (typeof data.taskCompleteSoundVolume === "number") {
        taskCompleteSoundVolume = Math.max(0, Math.min(1, data.taskCompleteSoundVolume));
      }
      if (typeof data.agentMonitoringEnabled === "boolean") {
        agentMonitoringEnabled = data.agentMonitoringEnabled;
      }
      if (typeof data.petSize === "number") {
        currentPetSize = normalizePetSize(data.petSize);
      }
      currentPetPosition = normalizePetPosition(data.petPosition);
      if (typeof data.pomodoroFocusMin === "number" && data.pomodoroFocusMin > 0) {
        pomodoroFocusMin = Math.max(1, Math.min(180, Math.round(data.pomodoroFocusMin)));
      }
      if (typeof data.pomodoroRestMin === "number" && data.pomodoroRestMin > 0) {
        pomodoroRestSec = Math.max(30, Math.min(60 * 60, Math.round(data.pomodoroRestMin * 60)));
      }
      if (typeof data.pomodoroRestSec === "number" && data.pomodoroRestSec > 0) {
        pomodoroRestSec = Math.max(30, Math.min(60 * 60, Math.round(data.pomodoroRestSec)));
      }
      pomodoroRemainingSec = pomodoroFocusMin * 60;
    }
  } catch {}
}
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify({
      stretchIntervalMin,
      reminders,
      language: currentLanguage,
      catName,
      userName,
      showCatName,
      fixedMessage,
      showReminderButtonOutside,
      catNamePromptShown,
      taskCompleteSoundVolume,
      agentMonitoringEnabled,
      petSize: currentPetSize,
      petPosition: currentPetPosition,
      pomodoroFocusMin,
      pomodoroRestSec,
    }, null, 2));
  } catch {}
  // Persist active character's per-cat fields (name/pattern/position/size).
  syncActiveCharFromGlobals();
}

function startStretchTimer() {
  if (stretchTimer) {
    clearInterval(stretchTimer);
    stretchTimer = null;
  }
  if (stretchIntervalMin > 0) {
    stretchTimer = setInterval(() => triggerStretchSequence(), stretchIntervalMin * 60 * 1000);
  }
}
function setStretchInterval(min) {
  stretchIntervalMin = normalizeStretchIntervalForBuild(min);
  saveSettings();
  startStretchTimer();
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeReminderRepeat(repeat) {
  return ["none", "daily", "weekdays", "weekends", "custom"].includes(repeat) ? repeat : "none";
}

function normalizeReminderDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    .sort((a, b) => a - b);
}

function sanitizeReminder(reminder) {
  if (!reminder || typeof reminder !== "object") return null;
  const timeMatch = typeof reminder.time === "string" ? /^(\d{2}):(\d{2})$/.exec(reminder.time) : null;
  const hour = timeMatch ? Number(timeMatch[1]) : -1;
  const minute = timeMatch ? Number(timeMatch[2]) : -1;
  const time = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : "";
  const message = typeof reminder.message === "string" ? reminder.message.trim().slice(0, 80) : "";
  if (!time || !message) return null;
  let repeat = normalizeReminderRepeat(reminder.repeat);
  const days = normalizeReminderDays(reminder.days);
  if (repeat === "custom" && days.length === 0) repeat = "none";
  return {
    id: typeof reminder.id === "string" && reminder.id ? reminder.id : `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time,
    message,
    repeat,
    days,
    enabled: reminder.enabled !== false,
    lastTriggeredDate: typeof reminder.lastTriggeredDate === "string" ? reminder.lastTriggeredDate : "",
    createdAt: typeof reminder.createdAt === "string" ? reminder.createdAt : new Date().toISOString(),
  };
}

function reminderAppliesToday(reminder, date = new Date()) {
  const day = date.getDay();
  if (reminder.repeat === "weekdays") return day >= 1 && day <= 5;
  if (reminder.repeat === "weekends") return day === 0 || day === 6;
  if (reminder.repeat === "custom") return Array.isArray(reminder.days) && reminder.days.includes(day);
  return true;
}

function reminderList() {
  return reminders
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt))
    .map((reminder) => ({ ...reminder }));
}

function broadcastReminders() {
  broadcastAll("reminders-changed", reminderList());
}

function broadcastReminderSettings() {
  broadcastAll("reminder-settings-changed", { showButtonOutside: showReminderButtonOutside });
}

function setShowReminderButtonOutside(visible) {
  showReminderButtonOutside = !!visible;
  saveSettings();
  broadcastReminderSettings();
}

function addReminder(payload) {
  const reminder = sanitizeReminder({
    ...payload,
    id: `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    enabled: true,
    createdAt: new Date().toISOString(),
  });
  if (!reminder) return { ok: false, reason: "invalid" };
  reminders.push(reminder);
  saveSettings();
  broadcastReminders();
  return { ok: true, reminder, reminders: reminderList() };
}

function updateReminder(id, payload) {
  const index = reminders.findIndex((reminder) => reminder.id === id);
  if (index < 0) return { ok: false, reason: "not-found" };
  const current = reminders[index];
  const reminder = sanitizeReminder({
    ...payload,
    id: current.id,
    enabled: true,
    createdAt: current.createdAt,
  });
  if (!reminder) return { ok: false, reason: "invalid" };
  reminder.lastTriggeredDate = "";
  reminders[index] = reminder;
  saveSettings();
  broadcastReminders();
  return { ok: true, reminder, reminders: reminderList() };
}

function deleteReminder(id) {
  const before = reminders.length;
  reminders = reminders.filter((reminder) => reminder.id !== id);
  if (reminders.length !== before) {
    saveSettings();
    broadcastReminders();
  }
  return { ok: true, reminders: reminderList() };
}

function setReminderEnabled(id, enabled) {
  const reminder = reminders.find((item) => item.id === id);
  if (!reminder) return { ok: false, reason: "not-found" };
  reminder.enabled = !!enabled;
  saveSettings();
  broadcastReminders();
  return { ok: true, reminder, reminders: reminderList() };
}

function formatReminderTimeForSpeech(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function formatReminderSpeech(message, time) {
  const text = String(message || "").trim();
  if (!text) return "";
  const timeText = formatReminderTimeForSpeech(time);
  const name = String(userName || "").trim();
  const koName = name || "집사야";
  const enName = name || "Human";
  const jaName = name ? `${name}さん` : "ご主人";
  if (currentLanguage === "ko") return `${koName}, ${timeText} "${text}"`;
  if (currentLanguage === "ja") return `${jaName}、${timeText}「${text}」`;
  return `${enName}, ${timeText} "${text}"`;
}

function checkRemindersNow() {
  const now = new Date();
  const key = todayKey(now);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  let changed = false;
  for (const reminder of reminders) {
    if (!reminder.enabled || reminder.time !== time || reminder.lastTriggeredDate === key) continue;
    if (!reminderAppliesToday(reminder, now)) continue;
    reminder.lastTriggeredDate = key;
    changed = true;
    broadcastAll("reminder-triggered", {
      id: reminder.id,
      text: formatReminderSpeech(reminder.message, reminder.time),
    });
    if (reminder.repeat === "none") {
      reminder.enabled = false;
    }
  }
  if (changed) {
    saveSettings();
    broadcastReminders();
  }
}

function startReminderTimer() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkRemindersNow, 15 * 1000);
  checkRemindersNow();
}

function stopReminderTimer() {
  if (!reminderTimer) return;
  clearInterval(reminderTimer);
  reminderTimer = null;
}

function setLanguage(language) {
  currentLanguage = normalizeLanguage(language);
  saveSettings();
  buildAppMenu();
  broadcastAll("language-changed", currentLanguage);
  // Keep any open AI / editor windows in sync too.
  const aiWindows = [
    [aiPanelWin, null],
    [aiSettingsWin, null],
    [aiCommandWin, null],
    [aiJournalWin, "journalWindowTitle"],
    [memoryWin, "memoryTitle"],
    [overlayWin, "overlayEditorTitle"],
  ];
  for (const [win, titleKey] of aiWindows) {
    if (win && !win.isDestroyed()) {
      if (titleKey) win.setTitle(t(titleKey));
      win.webContents.send("language-changed", currentLanguage);
    }
  }
}

function broadcastCatNameSettings() {
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("cat-name-changed", { name: catName, visible: showCatName });
  }
}

function broadcastUserNameSettings() {
  broadcastAll("user-name-changed", { name: userName });
}

function broadcastFixedMessageSettings() {
  broadcastAll("fixed-message-changed", { message: fixedMessage });
}

function setCatName(value) {
  const next = String(value || "").trim().slice(0, 24) || "Kiri";
  catName = next;
  saveSettings();
  broadcastCatNameSettings();
  return { name: catName, visible: showCatName };
}

function setUserName(value) {
  userName = String(value || "").trim().slice(0, 24);
  saveSettings();
  broadcastUserNameSettings();
  return { name: userName };
}

function setShowCatName(visible) {
  showCatName = !!visible;
  saveSettings();
  broadcastCatNameSettings();
  return { name: catName, visible: showCatName };
}

function setFixedMessage(value) {
  fixedMessage = String(value || "").trim().slice(0, 80);
  saveSettings();
  broadcastFixedMessageSettings();
  return { message: fixedMessage };
}

function markCatNamePromptShown() {
  if (catNamePromptShown) return;
  catNamePromptShown = true;
  saveSettings();
}

function broadcastTaskCompleteSoundVolume() {
  broadcastAll("task-complete-sound-volume", taskCompleteSoundVolume);
}

function setTaskCompleteSoundVolume(volume) {
  taskCompleteSoundVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  saveSettings();
  broadcastTaskCompleteSoundVolume();
  return taskCompleteSoundVolume;
}

function pomodoroPhaseDurationSec(mode = pomodoroMode) {
  return mode === "rest" ? pomodoroRestSec : pomodoroFocusMin * 60;
}

function pomodoroState() {
  return {
    visible: pomodoroVisible,
    running: pomodoroRunning,
    mode: pomodoroMode,
    remainingSec: Math.max(0, pomodoroRemainingSec),
    focusMin: pomodoroFocusMin,
    restSec: pomodoroRestSec,
  };
}

function broadcastPomodoroState() {
  broadcastAll("pomodoro-state", pomodoroState());
}

function stopPomodoroTimer() {
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer);
    pomodoroTimer = null;
  }
}

function startPomodoroTimer() {
  stopPomodoroTimer();
  pomodoroTimer = setInterval(() => {
    if (!pomodoroRunning) return;
    pomodoroRemainingSec -= 1;
    if (pomodoroRemainingSec <= 0) {
      const completedMode = pomodoroMode;
      pomodoroMode = completedMode === "focus" ? "rest" : "focus";
      pomodoroRemainingSec = pomodoroPhaseDurationSec(pomodoroMode);
      broadcastAll("pomodoro-complete", {
        completedMode,
        nextMode: pomodoroMode,
      });
      if (completedMode === "focus") {
        triggerStretchSequence();
      } else {
        triggerPomodoroFocusStartSequence();
      }
    }
    broadcastPomodoroState();
  }, 1000);
}

function startPomodoro() {
  pomodoroVisible = true;
  if (pomodoroRemainingSec <= 0) pomodoroRemainingSec = pomodoroPhaseDurationSec();
  pomodoroRunning = true;
  startPomodoroTimer();
  broadcastPomodoroState();
}

function pausePomodoro() {
  pomodoroRunning = false;
  stopPomodoroTimer();
  broadcastPomodoroState();
}

function resetPomodoro() {
  pomodoroRunning = false;
  pomodoroVisible = false;
  pomodoroMode = "focus";
  pomodoroRemainingSec = pomodoroPhaseDurationSec("focus");
  stopPomodoroTimer();
  broadcastPomodoroState();
}

function setPomodoroFocusMin(min) {
  pomodoroFocusMin = Math.max(1, Math.min(180, Math.round(min)));
  if (!pomodoroRunning && pomodoroMode === "focus") {
    pomodoroRemainingSec = pomodoroPhaseDurationSec("focus");
  }
  saveSettings();
  broadcastPomodoroState();
}

function setPomodoroRestSec(sec) {
  pomodoroRestSec = Math.max(30, Math.min(60 * 60, Math.round(sec)));
  if (!pomodoroRunning && pomodoroMode === "rest") {
    pomodoroRemainingSec = pomodoroPhaseDurationSec("rest");
  }
  saveSettings();
  broadcastPomodoroState();
}

const DEFAULT_SIZE = 100;
const PET_SIZE_OPTIONS = [60, 80, 100, 120, 140, 160, 200, 240];
// 윈도우 너비는 캐릭터 주변 여유와 말풍선 폭을 함께 담을 만큼 확보한다.
const WINDOW_WIDTH_RATIO = 2;
const MIN_WINDOW_WIDTH = 500;
const WINDOW_EXTRA_RIGHT_PX = 2;
let lastPetDragAt = 0;
let currentPetSize = DEFAULT_SIZE;
let currentPetPosition = null;

function windowDims(charSize, widthRatio = WINDOW_WIDTH_RATIO) {
  return {
    width: Math.max(MIN_WINDOW_WIDTH, charSize * widthRatio + WINDOW_EXTRA_RIGHT_PX),
    height: Math.round(charSize * STRETCH_RATIO),
  };
}

function defaultPetPosition(display, width, height) {
  const bounds = display.bounds;
  return {
    x: bounds.x + bounds.width - width - 80,
    y: bounds.y + bounds.height - height - 100,
  };
}

function petPositionIsVisible(position, width, height) {
  if (!position) return false;
  return screen.getAllDisplays().some((display) => {
    const bounds = display.bounds;
    return (
      position.x + width > bounds.x + 20 &&
      position.x < bounds.x + bounds.width - 20 &&
      position.y + height > bounds.y + 20 &&
      position.y < bounds.y + bounds.height - 20
    );
  });
}

function resizePetBy(delta) {
  if (!petWin || petWin.isDestroyed()) return;
  if (Date.now() - lastPetDragAt < 500) return;
  const b = petWin.getBounds();
  currentPetSize = normalizePetSize(currentPetSize + delta);
  const { width, height } = windowDims(currentPetSize);
  petWin.setBounds({ x: b.x, y: b.y, width, height });
  currentPetPosition = { x: b.x, y: b.y };
  saveSettings();
}

function setPetSize(size) {
  if (!petWin || petWin.isDestroyed()) return;
  if (Date.now() - lastPetDragAt < 500) return;
  const b = petWin.getBounds();
  currentPetSize = normalizePetSize(size);
  const { width, height } = windowDims(currentPetSize);
  petWin.setBounds({ x: b.x, y: b.y, width, height });
  currentPetPosition = { x: b.x, y: b.y };
  saveSettings();
}

function resetPetSize() {
  if (!petWin || petWin.isDestroyed()) return;
  const b = petWin.getBounds();
  currentPetSize = normalizePetSize(DEFAULT_SIZE);
  const { width, height } = windowDims(currentPetSize);
  petWin.setBounds({ x: b.x, y: b.y, width, height });
  currentPetPosition = { x: b.x, y: b.y };
  saveSettings();
}

function keepWindowOnTop(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setAlwaysOnTop(true, IS_MAC ? "screen-saver" : "pop-up-menu");
  } catch {
    win.setAlwaysOnTop(true);
  }
  if (!IS_WINDOWS && typeof win.setVisibleOnAllWorkspaces === "function") {
    try {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {}
  }
}

function attachWindowDiagnostics(win, label) {
  if (!win || !win.webContents) return;
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logError(`[Kiri] ${label} failed to load:`, { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    logError(`[Kiri] ${label} render process gone:`, details);
  });
  win.on("unresponsive", () => {
    logWarn(`[Kiri] ${label} window became unresponsive`);
  });
}

// ── Multi-character helpers ──
function charById(id) { return characters.find((c) => c.id === id) || null; }
function activeChar() { return charById(activeCharId); }

// Per-character memory: the recent-work context fed into prompts, and a helper
// to record a new entry for whichever character just did the work.
function activeMemoryContext() {
  return activeCharId ? aiMemory.recentContext(activeCharId) : "";
}
function rememberForActiveChar(kind, title, detail) {
  if (!activeCharId) return;
  const c = activeChar();
  aiMemory.add(activeCharId, { kind, title, detail }, c && c.name);
  if (memoryWin && !memoryWin.isDestroyed()) memoryWin.webContents.send("memory-changed");
}
function eachPetWin(cb) {
  for (const win of petWins.values()) { if (win && !win.isDestroyed()) cb(win); }
}
function broadcastAll(channel, payload) { eachPetWin((w) => w.webContents.send(channel, payload)); }
function charForSender(sender) {
  if (!sender) return null;
  const id = webContentsToChar.get(sender.id);
  return id ? charById(id) : null;
}

function syncGlobalsFromChar(char) {
  if (!char) return;
  catName = char.name || "Kiri";
  currentPattern = sanitizePattern(char.pattern || currentPattern);
  if (char.position) currentPetPosition = char.position;
  if (char.size) currentPetSize = normalizePetSize(char.size);
}
function syncActiveCharFromGlobals() {
  const c = activeChar();
  if (!c) return;
  c.name = catName;
  c.pattern = currentPattern;
  c.position = currentPetPosition;
  c.size = currentPetSize;
  charStore.save(characters);
}
// Make the interacted-with character active so the existing single-cat code
// (which reads the global state + petWin) operates on the right cat.
function setActiveChar(id) {
  if (!id) return;
  const w = petWins.get(id);
  if (id === activeCharId) { if (w) petWin = w; return; }
  syncActiveCharFromGlobals();
  activeCharId = id;
  syncGlobalsFromChar(charById(id));
  if (w) petWin = w;
}

function sendSharedState(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("user-name-changed", { name: userName });
  win.webContents.send("fixed-message-changed", { message: fixedMessage });
  win.webContents.send("pomodoro-state", pomodoroState());
  win.webContents.send("task-complete-sound-volume", taskCompleteSoundVolume);
  win.webContents.send("reminders-changed", reminderList());
  win.webContents.send("reminder-settings-changed", { showButtonOutside: showReminderButtonOutside });
  win.webContents.send("voice-config-changed", { enabled: aiConfig.voiceUsable() });
  win.webContents.send("language-changed", currentLanguage);
}

function createPetWindow(char) {
  if (!char) return null;
  const existing = petWins.get(char.id);
  if (existing && !existing.isDestroyed()) return existing;

  const size = char.size ? normalizePetSize(char.size) : currentPetSize;
  const { width: W, height: H } = windowDims(size);
  const display = screen.getPrimaryDisplay();
  const initialPosition = (char.position && petPositionIsVisible(char.position, W, H))
    ? char.position
    : defaultPetPosition(display, W, H);

  const win = new BrowserWindow({
    width: W,
    height: H,
    x: initialPosition.x,
    y: initialPosition.y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const wcId = win.webContents.id;
  petWins.set(char.id, win);
  webContentsToChar.set(wcId, char.id);

  attachWindowDiagnostics(win, "pet");
  keepWindowOnTop(win);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("pattern-changed", sanitizePattern(char.pattern || currentPattern));
    win.webContents.send("cat-name-changed", { name: char.name, visible: showCatName });
    win.webContents.send("character-art", { kind: char.kind, sprite: char.sprite, set: char.set, overlay: char.overlay });
    sendSharedState(win);
    if (char.id === activeCharId && !catNamePromptShown) {
      setTimeout(() => {
        if (!win || win.isDestroyed() || catNamePromptShown) return;
        win.webContents.send("cat-name-edit", char.name);
      }, 1000);
    }
  });
  if (!app.isPackaged && !process.env.KIRI_NO_DEVTOOLS) win.webContents.openDevTools({ mode: "detach" });

  win.on("closed", () => {
    webContentsToChar.delete(wcId);
    petWins.delete(char.id);
    if (activeCharId === char.id) {
      const next = characters.find((c) => petWins.has(c.id));
      activeCharId = next ? next.id : null;
      petWin = next ? petWins.get(next.id) : null;
      if (next) syncGlobalsFromChar(charById(next.id));
    }
  });
  return win;
}

function startCursorPoll() {
  if (cursorPollTimer) clearInterval(cursorPollTimer);
  cursorPollTimer = setInterval(() => {
    if (!petWins.size) return;
    const cursor = screen.getCursorScreenPoint();
    eachPetWin((win) => {
      const b = win.getBounds();
      win.webContents.send("cursor-pos", {
        dx: cursor.x - (b.x + b.width / 2),
        dy: cursor.y - (b.y + b.height / 2),
      });
    });
  }, 16);
}

function initCharacters() {
  characters = charStore.load();
  if (!characters.length) {
    // Fresh setup: the default companion is the illustrated "kiri" pose-set.
    // (Existing users keep whatever is already in characters.json.)
    characters = [charStore.sanitize({
      id: "char-primary",
      name: catName || "Kiri",
      persona: "",
      kind: "poseset",
      set: "kiri",
      pattern: currentPattern,
      position: currentPetPosition,
      size: currentPetSize,
    }, 0)];
    charStore.save(characters);
  }
  for (const c of characters) { if (!c.pattern) c.pattern = currentPattern; }
  activeCharId = characters[0].id;
  syncGlobalsFromChar(characters[0]);
}

// Replaces the old single createPetWindow() startup call.
function createAllPetWindows() {
  initCharacters();
  for (const c of characters) createPetWindow(c);
  petWin = petWins.get(activeCharId) || null;
  startCursorPoll();
}

function addCharacter(set = "kiri") {
  if (!charStore.POSESET_SETS.includes(set)) set = "kiri";
  const display = screen.getPrimaryDisplay();
  const { width: W, height: H } = windowDims(currentPetSize);
  const base = (activeChar() && activeChar().position) || defaultPetPosition(display, W, H);
  const idx = characters.length;
  // Only the illustrated pose-set characters (kiri / tori) can be added now.
  const char = charStore.sanitize({
    id: `char-${Date.now()}-${idx}`,
    name: set.charAt(0).toUpperCase() + set.slice(1),
    persona: "",
    kind: "poseset",
    set,
    pattern: currentPattern,
    position: { x: base.x + 70, y: base.y + 24 },
    size: currentPetSize,
  }, idx);
  characters.push(char);
  charStore.save(characters);
  createPetWindow(char);
  setActiveChar(char.id);
}

function removeCharacter(id) {
  if (characters.length <= 1) return;
  const win = petWins.get(id);
  characters = characters.filter((c) => c.id !== id);
  charStore.save(characters);
  aiMemory.deleteChar(id); // a removed character's history goes with it
  if (win && !win.isDestroyed()) {
    win.close(); // closed handler cleans the maps + reassigns active
  } else {
    petWins.delete(id);
  }
  if (!charById(activeCharId)) {
    activeCharId = characters[0].id;
    petWin = petWins.get(activeCharId) || null;
    syncGlobalsFromChar(characters[0]);
  }
}

ipcMain.handle("persona-set", (_evt, value) => {
  const c = activeChar();
  if (c) {
    c.persona = String(value || "").trim().slice(0, 500);
    charStore.save(characters);
  }
  return { ok: true };
});

function startApp() {
  createAllPetWindows();
  createTray();
  startKeyHook();
  startAgentIntegrations();
  startStretchTimer();
  startReminderTimer();
  startJournalReminder();
  if (!agentSweepTimer) agentSweepTimer = setInterval(sweepAgentSessions, 60 * 1000);
}

function stopKeyHook() {
  if (keyHookRetryTimer) {
    clearInterval(keyHookRetryTimer);
    keyHookRetryTimer = null;
  }
  if (keyHookStarted) {
    if (uIOhook) {
      try { uIOhook.stop(); } catch {}
    }
    keyHookStarted = false;
  }
}


// ── 패턴 에디터 윈도우 ──
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

ipcMain.handle("language-get", () => currentLanguage);
ipcMain.handle("language-set", (_evt, language) => {
  setLanguage(language);
  return currentLanguage;
});
ipcMain.handle("user-name-get", () => ({ name: userName }));
ipcMain.handle("user-name-set", (_evt, value) => setUserName(value));
ipcMain.handle("cat-name-get", () => ({ name: catName, visible: showCatName }));
ipcMain.handle("cat-name-set", (_evt, value) => setCatName(value));
ipcMain.handle("cat-name-visible-set", (_evt, visible) => setShowCatName(visible));
ipcMain.handle("fixed-message-get", () => ({ message: fixedMessage }));
ipcMain.handle("fixed-message-set", (_evt, value) => setFixedMessage(value));
ipcMain.handle("cat-name-prompt-shown", () => {
  markCatNamePromptShown();
  return { ok: true };
});
ipcMain.handle("task-complete-sound-volume-get", () => taskCompleteSoundVolume);
ipcMain.handle("task-complete-sound-volume-set", (_evt, volume) => setTaskCompleteSoundVolume(volume));
ipcMain.handle("reminders-get", () => reminderList());
ipcMain.handle("reminder-add", (_evt, payload) => addReminder(payload));
ipcMain.handle("reminder-update", (_evt, payload) => {
  return updateReminder(String(payload && payload.id || ""), payload);
});
ipcMain.handle("reminder-delete", (_evt, id) => deleteReminder(String(id || "")));
ipcMain.handle("reminder-enabled-set", (_evt, payload) => {
  return setReminderEnabled(String(payload && payload.id || ""), !!(payload && payload.enabled));
});
ipcMain.handle("pomodoro-get", () => pomodoroState());
ipcMain.handle("pomodoro-start", () => {
  startPomodoro();
  return pomodoroState();
});
ipcMain.handle("pomodoro-pause", () => {
  pausePomodoro();
  return pomodoroState();
});
ipcMain.handle("pomodoro-reset", () => {
  resetPomodoro();
  return pomodoroState();
});
ipcMain.handle("pomodoro-focus-set", (_evt, min) => {
  setPomodoroFocusMin(Number(min));
  return pomodoroState();
});

async function checkForUpdatesNow() {
  return { ok: false, reason: "updates-disabled" };
}

ipcMain.handle("update-check", async () => {
  return checkForUpdatesNow({ manual: true });
});
ipcMain.handle("update-download", async () => {
  return { ok: false, reason: "updates-disabled" };
});
function installDownloadedUpdate() {
  return { ok: false, reason: "updates-disabled" };
}
ipcMain.handle("update-install", () => {
  return installDownloadedUpdate();
});

// 윈도우 드래그 (relative pixel delta)
ipcMain.on("drag-window", (evt, dx, dy) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win || win.isDestroyed()) return;
  lastPetDragAt = Date.now();
  const b = win.getBounds();
  const nextBounds = { x: Math.round(b.x + dx), y: Math.round(b.y + dy), width: b.width, height: b.height };
  win.setBounds(nextBounds);
  if (win === petWin) {
    currentPetPosition = { x: nextBounds.x, y: nextBounds.y };
  }
});

ipcMain.on("drag-window-ended", (evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win || win.isDestroyed()) return;
  const ch = charForSender(evt.sender);
  if (ch) {
    const b = win.getBounds();
    ch.position = { x: b.x, y: b.y };
    setActiveChar(ch.id);
    currentPetPosition = { x: b.x, y: b.y };
    charStore.save(characters);
  }
});

ipcMain.on("set-mouse-events-enabled", (evt, enabled) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win || win.isDestroyed()) return;
  if (enabled) {
    win.setIgnoreMouseEvents(false);
  } else {
    win.setIgnoreMouseEvents(true, { forward: true });
  }
});

// Window height ratio — speech bubble and jump poses need extra vertical room.
const STRETCH_RATIO = 4.8;

ipcMain.on("set-stretch-mode", () => {
  // 더 이상 윈도우 사이즈 변경 안 함 (윈도우가 처음부터 stretch 비율) — no-op
});

ipcMain.on("set-hunting-mode", () => {
  // Hunting is an in-SVG animation now. Keep this IPC as a no-op so older
  // renderer calls never trigger BrowserWindow bounds changes on Windows.
});

// 우클릭 컨텍스트 메뉴
ipcMain.on("show-context-menu", (evt) => {
  const ch = charForSender(evt.sender);
  if (ch) setActiveChar(ch.id);
  if (!petWin || petWin.isDestroyed()) return;
  if (Date.now() - lastPetDragAt < 500) return;

  const menu = Menu.buildFromTemplate([
    { label: `${t("contextTitle")} v${app.getVersion()}`, enabled: false },
    { type: "separator" },
    {
      label: t("askScreen"),
      click: () => {
        if (petWin && !petWin.isDestroyed()) petWin.webContents.send("screen-ask-open");
      },
    },
    {
      label: t("aiCommand"),
      click: () => openAiCommand(),
    },
    {
      label: (() => { const d = aiJournal.dueCount(); return t("aiJournal") + (d > 0 ? ` (${d})` : ""); })(),
      click: () => openAiJournal(),
    },
    {
      label: t("aiMemory"),
      click: () => openMemoryWindow(),
    },
    {
      label: t("aiAssistant"),
      click: () => openAiSettings(),
    },
    { type: "separator" },
    {
      label: t("tasks"),
      submenu: [
        {
          label: t("reminders"),
          submenu: [
            {
              label: t("remindersOpen"),
              click: () => petWin.webContents.send("reminder-panel-open"),
            },
            {
              label: t("showReminderButtonOutside"),
              type: "checkbox",
              checked: showReminderButtonOutside,
              click: (item) => setShowReminderButtonOutside(item.checked),
            },
          ],
        },
        {
          label: t("pomodoro"),
          submenu: [
            {
              label: pomodoroRunning ? t("pomodoroPause") : (pomodoroRemainingSec < pomodoroPhaseDurationSec(pomodoroMode) ? t("pomodoroResume") : t("pomodoroStart")),
              click: () => {
                if (pomodoroRunning) pausePomodoro();
                else startPomodoro();
              },
            },
            { label: t("pomodoroReset"), click: () => resetPomodoro() },
            { type: "separator" },
            {
              label: t("pomodoroFocusTime"),
              submenu: [
                ...[15, 20, 25, 30, 40, 45, 50, 60].map((min) => ({
                  label: t("pomodoroMinutes", min),
                  type: "radio",
                  checked: pomodoroFocusMin === min,
                  click: () => setPomodoroFocusMin(min),
                })),
                { type: "separator" },
                {
                  label: t("pomodoroCustom"),
                  click: () => petWin.webContents.send("pomodoro-focus-edit", pomodoroFocusMin),
                },
              ],
            },
            {
              label: t("pomodoroRestTime"),
              submenu: [
                ...[5, 10, 15].map((min) => ({
                  label: t("pomodoroMinutes", min),
                  type: "radio",
                  checked: pomodoroRestSec === min * 60,
                  click: () => setPomodoroRestSec(min * 60),
                })),
              ],
            },
          ],
        },
      ],
    },
    { type: "separator" },
    {
      label: t("setUserName"),
      click: () => petWin.webContents.send("user-name-edit", userName),
    },
    {
      label: t("setCatName"),
      click: () => petWin.webContents.send("cat-name-edit", catName),
    },
    {
      label: t("setCatPersona"),
      click: () => petWin.webContents.send("persona-edit", (activeChar() && activeChar().persona) || ""),
    },
    ...(activeChar() && activeChar().kind === "poseset" ? [{
      label: t("pixelEditor"),
      click: () => openOverlayEditor(),
    }] : []),
    {
      label: t("addCharacter"),
      submenu: [
        { label: "Kiri", click: () => addCharacter("kiri") },
        { label: "Tori", click: () => addCharacter("tori") },
      ],
    },
    {
      label: t("removeCharacter"),
      enabled: characters.length > 1,
      click: () => removeCharacter(activeCharId),
    },
    {
      label: t("showCatName"),
      type: "checkbox",
      checked: showCatName,
      click: (item) => setShowCatName(item.checked),
    },
    { type: "separator" },
    {
      label: t("taskCompleteSound"),
      submenu: [
        { label: t("soundOff"), type: "radio", checked: taskCompleteSoundVolume === 0, click: () => setTaskCompleteSoundVolume(0) },
        { label: t("soundLow"), type: "radio", checked: taskCompleteSoundVolume === 0.1, click: () => setTaskCompleteSoundVolume(0.1) },
        { label: t("soundNormal"), type: "radio", checked: taskCompleteSoundVolume === 0.6, click: () => setTaskCompleteSoundVolume(0.6) },
        { label: t("soundHigh"), type: "radio", checked: taskCompleteSoundVolume === 0.9, click: () => setTaskCompleteSoundVolume(0.9) },
      ],
    },
    { type: "separator" },
    {
      label: t("size"),
      submenu: [
        ...PET_SIZE_OPTIONS.map((size) => ({
          label: t("petSizePixels", size),
          type: "radio",
          checked: currentPetSize === size,
          click: () => setPetSize(size),
        })),
        { type: "separator" },
        {
          label: t("smaller"),
          click: () => resizePetBy(-20),
        },
        {
          label: t("larger"),
          click: () => resizePetBy(20),
        },
        {
          label: t("resetSize"),
          click: () => resetPetSize(),
        },
      ],
    },
    { type: "separator" },
    {
      label: t("language"),
      submenu: [
        { label: t("english"), type: "radio", checked: currentLanguage === "en", click: () => setLanguage("en") },
        { label: t("korean"), type: "radio", checked: currentLanguage === "ko", click: () => setLanguage("ko") },
        { label: t("japanese"), type: "radio", checked: currentLanguage === "ja", click: () => setLanguage("ja") },
        { label: t("turkish"), type: "radio", checked: currentLanguage === "tr", click: () => setLanguage("tr") },
      ],
    },
    { type: "separator" },
    {
      label: t("checkForUpdates"),
      enabled: false,
    },
    { label: t("appMenuQuit"), accelerator: "Cmd+Q", click: () => app.quit() },
  ]);

  menu.popup({ window: petWin });
});

// ── 스트레칭 시퀀스: 윈도우 확대 + 중앙으로 → SVG 애니메이션 → 복원 ──
const STRETCH_DURATION_MS = 3000;
const STRETCH_GROW_MS = 400;       // 확대 transition 시간
const STRETCH_SHRINK_DELAY_MS = 200; // 종료 후 복원까지 여유
const STRETCH_FILL_RATIO = 0.90;    // 화면 높이의 90%를 채우도록 (정사각 윈도우)
let stretchInProgress = false;
let savedStretchBounds = null;
let focusStartInProgress = false;
let savedFocusStartBounds = null;

function triggerStretchSequence() {
  if (!petWin || petWin.isDestroyed() || stretchInProgress) return;
  // The break-stretch is a classic-cat animation; pose-set characters (kiri/tori)
  // have no stretch pose, so skip it for them (feature removed from the menu).
  if (activeChar() && activeChar().kind === "poseset") return;
  stretchInProgress = true;
  savedStretchBounds = petWin.getBounds();

  // 캣짱이 현재 있는 디스플레이에서 실행한다. 커서 기준이면 자동 스트레칭이
  // 다른 모니터로 튀어 애니메이션이 안 보이는 것처럼 느껴질 수 있다.
  const display = screen.getDisplayMatching(savedStretchBounds);
  const { x: dispX, y: dispY, width: dispW, height: dispH } = display.workArea;

  // 정사각 큰 윈도우 — 화면 높이 기준 STRETCH_FILL_RATIO
  const targetSize = Math.round(dispH * STRETCH_FILL_RATIO);
  const newX = dispX + Math.round((dispW - targetSize) / 2);
  const newY = dispY + Math.round((dispH - targetSize) / 2);

  petWin.setBounds(
    { x: newX, y: newY, width: targetSize, height: targetSize },
    true
  );

  // 윈도우 확대 transition 후 SVG 애니메이션 시작
  setTimeout(() => {
    if (petWin && !petWin.isDestroyed()) {
      petWin.webContents.send("do-stretch");
    }
  }, STRETCH_GROW_MS);

  // 시퀀스 종료 후 원래 bounds 복원
  setTimeout(() => {
    if (petWin && !petWin.isDestroyed() && savedStretchBounds) {
      petWin.setBounds(savedStretchBounds, true);
    }
    stretchInProgress = false;
  }, STRETCH_GROW_MS + STRETCH_DURATION_MS + STRETCH_SHRINK_DELAY_MS);
}

function triggerPomodoroFocusStartSequence() {
  if (!petWin || petWin.isDestroyed() || focusStartInProgress || stretchInProgress) return;
  focusStartInProgress = true;
  savedFocusStartBounds = petWin.getBounds();
  const display = screen.getDisplayMatching(savedFocusStartBounds);
  const { x: dispX, y: dispY, width: dispW, height: dispH } = display.workArea;
  const targetSize = Math.round(dispH * STRETCH_FILL_RATIO);
  const newX = dispX + Math.round((dispW - targetSize) / 2);
  const newY = dispY + Math.round((dispH - targetSize) / 2);

  petWin.setBounds({ x: newX, y: newY, width: targetSize, height: targetSize }, true);

  setTimeout(() => {
    if (petWin && !petWin.isDestroyed()) {
      petWin.webContents.send("pomodoro-focus-start");
    }
  }, 160);

  setTimeout(() => {
    if (petWin && !petWin.isDestroyed() && savedFocusStartBounds) {
      petWin.setBounds(savedFocusStartBounds, true);
    }
    focusStartInProgress = false;
    savedFocusStartBounds = null;
  }, 1400);
}

function triggerJumpSequence() {
  if (!petWin || petWin.isDestroyed()) return;
  petWin.webContents.send("do-jump");
}

// ── App lifecycle ──

function buildAppMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Kiri",
      submenu: [
        { label: t("appMenuAbout"), role: "about" },
        { type: "separator" },
        {
          label: t("checkForUpdates"),
          enabled: false,
        },
        { label: t("appMenuQuit"), accelerator: "Cmd+Q", click: () => app.quit() },
      ],
    },
    {
      label: t("editMenu"),
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function handleAgentStateEvent(event) {
  if (!event || typeof event !== "object") return;
  // When "watch AI agents" is off (tray toggle), ignore agent activity entirely.
  if (!agentMonitoringEnabled) return;
  const state = typeof event.state === "string" ? event.state : "";
  if (!state) return;
  const agentId = event.agentId || "agent";
  const sessionId = event.sessionId || agentId;
  const sessionKey = `${agentId}:${sessionId}`;
  const now = Date.now();
  const before = activeAgentSessions.size;
  for (const [key, active] of activeAgentSessions) {
    if (!active || now - active.lastActiveAt > AGENT_ACTIVE_TTL_MS) activeAgentSessions.delete(key);
  }
  if (state === "thinking" || state === "working") {
    activeAgentSessions.set(sessionKey, { agentId, sessionId, state, cwd: event.cwd || "", lastActiveAt: now });
  } else if (state === "complete") {
    if (!activeAgentSessions.has(sessionKey)) {
      console.warn(`[Kiri] ignored agent complete without active task: ${agentId} ${event.event || ""}`);
      return;
    }
    activeAgentSessions.delete(sessionKey);
  } else if (state === "idle" || state === "error") {
    activeAgentSessions.delete(sessionKey);
  }
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("ai-task-state", {
      agentId,
      sessionId,
      event: event.event || "",
      state,
    });
  }
  if (state === "complete") {
    if (petWin && !petWin.isDestroyed()) {
      petWin.webContents.send("ai-task-complete", {
        agentId,
        sessionId,
        event: event.event || "",
      });
    }
  } else if (state === "notification") {
    if (petWin && !petWin.isDestroyed()) {
      petWin.webContents.send("ai-task-notification", {
        agentId,
        sessionId,
        event: event.event || "",
      });
    }
  }
  if (activeAgentSessions.size !== before || state === "notification") refreshTray();
}

// Periodic sweep so sessions whose agent died without a terminal event still
// expire (otherwise the tray + pet animation stay "working" until a new event).
function sweepAgentSessions() {
  const now = Date.now();
  let removed = false;
  for (const [key, active] of activeAgentSessions) {
    if (!active || now - active.lastActiveAt > AGENT_ACTIVE_TTL_MS) {
      activeAgentSessions.delete(key);
      removed = true;
    }
  }
  if (!removed) return;
  refreshTray();
  if (activeAgentSessions.size === 0 && petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("ai-task-state", { agentId: "sweep", state: "idle" });
  }
}

// ── Menu-bar (tray) icon: AI-agent status + monitoring toggle + shortcuts ──
function activeAgentList() {
  const now = Date.now();
  const out = [];
  for (const [, s] of activeAgentSessions) {
    if (!s || now - s.lastActiveAt > AGENT_ACTIVE_TTL_MS) continue;
    out.push(s);
  }
  return out;
}

function buildTrayMenu() {
  const sessions = activeAgentList();
  const sessionItems = sessions.length
    ? sessions.map((s) => ({
        label: `   • ${AGENT_DISPLAY[s.agentId] || s.agentId} — ${t("agentWorking")}${s.cwd ? "  (" + path.basename(s.cwd) + ")" : ""}`,
        enabled: false,
      }))
    : [{ label: `   ${t("noActiveAgents")}`, enabled: false }];

  return Menu.buildFromTemplate([
    { label: `Kiri v${app.getVersion()}`, enabled: false },
    { type: "separator" },
    { label: t("aiAgents"), enabled: false },
    ...sessionItems,
    { type: "separator" },
    {
      label: t("agentMonitoring"),
      type: "checkbox",
      checked: agentMonitoringEnabled,
      click: (item) => {
        agentMonitoringEnabled = item.checked;
        if (agentMonitoringEnabled) {
          startAgentIntegrations();
        } else {
          stopAgentIntegrations();
          uninstallAgentHooks();
        }
        saveSettings();
        refreshTray();
      },
    },
    { type: "separator" },
    { label: t("aiCommand"), click: () => openAiCommand() },
    { label: t("aiAssistant"), click: () => openAiSettings() },
    { label: t("aiJournal"), click: () => openAiJournal() },
    { type: "separator" },
    { label: t("appMenuQuit"), accelerator: "Cmd+Q", click: () => app.quit() },
  ]);
}

function refreshTray() {
  if (!tray || (tray.isDestroyed && tray.isDestroyed())) return;
  try {
    tray.setContextMenu(buildTrayMenu());
    const n = activeAgentList().length;
    tray.setToolTip(n ? `Kiri — ${n} agent ${t("agentWorking")}` : "Kiri");
  } catch {}
}

function createTray() {
  if (tray) return;
  try {
    let img = nativeImage.createFromPath(APP_ICON_PATH);
    if (!img.isEmpty()) img = img.resize({ width: 18, height: 18 });
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip("Kiri");
    refreshTray();
    tray.on("click", () => refreshTray());
    tray.on("right-click", () => refreshTray());
  } catch (err) {
    console.warn("[Kiri] tray unavailable:", err && err.message);
    tray = null;
  }
}

function startAgentStateServer() {
  if (agentStateServer) return;
  const token = ensureAgentStateToken();
  agentStateServer = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/agent-state") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (String(req.headers["x-kiri-token"] || "") !== token) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= 8192) body += chunk;
    });
    req.on("end", () => {
      if (size > 8192) {
        res.writeHead(413);
        res.end("too large");
        return;
      }
      try {
        handleAgentStateEvent(JSON.parse(body || "{}"));
        res.writeHead(200);
        res.end("ok");
      } catch {
        res.writeHead(400);
        res.end("bad json");
      }
    });
  });
  agentStateServer.on("error", (err) => {
    console.warn("[Kiri] agent state server unavailable:", err && err.message);
    agentStateServer = null;
  });
  agentStateServer.listen(AGENT_STATE_PORT, "127.0.0.1", () => {
    console.log(`[Kiri] agent state server listening on 127.0.0.1:${AGENT_STATE_PORT}`);
  });
}

// ─────────────────────────── AI Assistant ───────────────────────────
// "Drop the cat → understand the region under it → run a task." The cat's
// position is the pointer; the AI panel/result lives in its own interactive
// window so it never disturbs the pet window's physics.

function sendCatThinking(on) {
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("ai-task-state", {
      agentId: "kiri-ai",
      state: on ? "thinking" : "idle",
    });
  }
}

function sendCatNotice(message) {
  if (message && petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("ai-notice", String(message));
  }
}

// Streaming screen-answer phases: "start" opens an empty bubble, "delta" replaces
// its text with the clean-so-far answer as tokens arrive. The final answer +
// paw point is delivered by sendScreenAnswer ("end").
function sendScreenStream(phase, text) {
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("screen-answer", { phase, text: text || "" });
  }
}

// Deliver a screen-question answer to the pet (speech bubble) and, if the model
// pointed at a UI element, draw the paw overlay there + have the cat look at it.
function sendScreenAnswer({ question, text, point } = {}) {
  let gaze = null;
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && petWin && !petWin.isDestroyed()) {
    // Normalized direction from the cat toward the pointed element, so the pet's
    // eyes/lean aim at it (same -1..1 convention as cursor tracking).
    const b = petWin.getBounds();
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.4;
    const vx = point.x - cx;
    const vy = point.y - cy;
    const mag = Math.hypot(vx, vy) || 1;
    gaze = { dx: vx / mag, dy: vy / mag };
  }
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("screen-answer", { question, text, point, gaze });
  }
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    showPawPoint(point);
  }
}

function createAiPanelWindow() {
  if (aiPanelWin && !aiPanelWin.isDestroyed()) return aiPanelWin;
  aiPanelReady = false;
  aiPanelWin = new BrowserWindow({
    width: 340,
    height: 260,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  keepWindowOnTop(aiPanelWin);
  aiPanelWin.loadFile(path.join(__dirname, "renderer", "ai-panel.html"));
  aiPanelWin.webContents.on("did-finish-load", () => {
    aiPanelReady = true;
    if (aiPanelPendingMenu) {
      aiPanelWin.webContents.send("ai-menu-show", aiPanelPendingMenu);
      aiPanelPendingMenu = null;
    }
  });
  aiPanelWin.on("closed", () => {
    aiPanelWin = null;
    aiPanelReady = false;
    aiPanelPendingMenu = null;
  });
  return aiPanelWin;
}

function positionAiWindow(win, size) {
  if (!win || win.isDestroyed() || !petWin || petWin.isDestroyed()) return;
  const b = petWin.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: b.x + Math.round(b.width / 2),
    y: b.y + Math.round(b.height / 2),
  });
  const wa = display.workArea;
  const cur = win.getBounds();
  const w = Math.round((size && size.width) || cur.width);
  const h = Math.round((size && size.height) || cur.height);
  // Prefer the right of the cat; fall back to the left if it would overflow.
  let x = b.x + b.width - 8;
  if (x + w > wa.x + wa.width) x = b.x - w + 8;
  x = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
  let y = b.y + Math.round(b.height * 0.4);
  y = Math.max(wa.y, Math.min(y, wa.y + wa.height - h));
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
}

function showAiPanel(data) {
  const win = createAiPanelWindow();
  positionAiWindow(win, { width: 340, height: 300 });
  if (aiPanelReady) win.webContents.send("ai-menu-show", data);
  else aiPanelPendingMenu = data;
  // Show focused so the first click on a task button registers (on macOS the
  // first click on an inactive window only activates it).
  win.show();
}

async function handleAiDrop(payload) {
  const cfg = aiConfig.loadConfig();
  if (!cfg.enabled) return;
  const shouldRun = cfg.alwaysAnalyzeOnDrop || !!(payload && payload.alt);
  if (!shouldRun) return;
  if (!aiConfig.providerReady()) {
    sendCatNotice(t("aiKeyRequired"));
    openAiSettings();
    return;
  }
  if (aiBusy) return;
  aiBusy = true;
  if (aiPanelWin && !aiPanelWin.isDestroyed()) aiPanelWin.hide();
  sendCatThinking(true);
  try {
    const data = await aiAssistant.analyzeDrop(petWin, { catName, persona: activeChar() && activeChar().persona, memory: activeMemoryContext() });
    if (data && data.ok) {
      showAiPanel(data);
    } else if (data && data.error && data.error !== "aborted" && data.error !== "disabled") {
      sendCatNotice(data.message || t("aiAnalyzeFailed"));
    }
  } catch (err) {
    sendCatNotice((err && err.message) || t("aiError"));
  } finally {
    aiBusy = false;
    sendCatThinking(false);
  }
}

function openAiSettings() {
  if (aiSettingsWin && !aiSettingsWin.isDestroyed()) {
    aiSettingsWin.show();
    aiSettingsWin.focus();
    return;
  }
  aiSettingsWin = new BrowserWindow({
    width: 460,
    height: 660,
    minWidth: 420,
    minHeight: 520,
    title: "Kiri AI",
    frame: false,
    transparent: false,
    backgroundColor: "#fbf4e4",
    resizable: true,
    skipTaskbar: false,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  aiSettingsWin.loadFile(path.join(__dirname, "renderer", "ai-settings.html"));
  aiSettingsWin.on("closed", () => {
    aiSettingsWin = null;
  });
}

ipcMain.on("ai-trigger-drop", (evt, payload) => {
  const ch = charForSender(evt.sender);
  if (ch) setActiveChar(ch.id);
  handleAiDrop(payload || {});
});

ipcMain.handle("ai-run-task", async (_evt, payload) => {
  sendCatThinking(true);
  try {
    const result = await aiAssistant.runTask({ ...(payload || {}), catName, persona: activeChar() && activeChar().persona, memory: activeMemoryContext() });
    if (result && result.ok && result.text) {
      const cfg = aiConfig.loadConfig();
      const tasks = localizedTasks(cfg.responseLanguage, cfg.customTasks);
      const task = tasks.find((t) => t.id === result.taskId);
      const label = (task && `${task.emoji || ""} ${task.label}`.trim()) || t("memoryKindTask");
      rememberForActiveChar("task", label, result.text);
    }
    return result;
  } finally {
    sendCatThinking(false);
  }
});

ipcMain.on("ai-cancel", () => aiAssistant.cancel());
ipcMain.on("ai-panel-close", () => {
  if (aiPanelWin && !aiPanelWin.isDestroyed()) aiPanelWin.hide();
});
ipcMain.on("ai-panel-resize", (_evt, size) => positionAiWindow(aiPanelWin, size));
ipcMain.on("ai-settings-close", () => {
  if (aiSettingsWin && !aiSettingsWin.isDestroyed()) aiSettingsWin.close();
});

ipcMain.handle("ai-config-get", () => aiConfig.redactedConfig());
ipcMain.handle("ai-config-set", (_evt, patch) => {
  aiConfig.saveConfig(patch || {});
  broadcastVoiceConfig();
  return aiConfig.redactedConfig();
});
ipcMain.handle("ai-set-key", (_evt, key) => aiConfig.setApiKey(key));
ipcMain.handle("ai-clear-key", () => aiConfig.clearApiKey());
ipcMain.handle("ai-tasks-get", () => {
  const cfg = aiConfig.loadConfig();
  return localizedTasks(cfg.responseLanguage, cfg.customTasks);
});
ipcMain.handle("ai-custom-task-save", (_evt, task) => {
  const cfg = aiConfig.loadConfig();
  const sanitized = aiConfig.sanitizeCustomTask(task, cfg.customTasks.length);
  if (sanitized) {
    const list = cfg.customTasks.filter((t) => t.id !== sanitized.id);
    list.push(sanitized);
    aiConfig.saveConfig({ customTasks: list });
  }
  return aiConfig.redactedConfig();
});
ipcMain.handle("ai-custom-task-delete", (_evt, id) => {
  const cfg = aiConfig.loadConfig();
  aiConfig.saveConfig({ customTasks: cfg.customTasks.filter((t) => t.id !== String(id)) });
  return aiConfig.redactedConfig();
});

// ── Command agent window (text-driven actions + skills) ──

function openAiCommand() {
  if (aiCommandWin && !aiCommandWin.isDestroyed()) {
    aiCommandWin.show();
    aiCommandWin.focus();
    return;
  }
  aiCommandReady = false;
  aiCommandWin = new BrowserWindow({
    width: 400,
    height: 360,
    minWidth: 360,
    minHeight: 240,
    title: "Kiri AI",
    frame: false,
    transparent: false,
    backgroundColor: "#fbf4e4",
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  keepWindowOnTop(aiCommandWin);
  aiCommandWin.loadFile(path.join(__dirname, "renderer", "ai-command.html"));
  aiCommandWin.webContents.on("did-finish-load", () => {
    aiCommandReady = true;
    if (aiCommandPendingVoice) {
      aiCommandWin.webContents.send("ai-voice-run", aiCommandPendingVoice);
      aiCommandPendingVoice = null;
    }
  });
  aiCommandWin.on("closed", () => {
    aiCommandWin = null;
    aiCommandReady = false;
    aiCommandPendingVoice = null;
  });
}

ipcMain.on("ai-command-close", () => {
  if (aiCommandWin && !aiCommandWin.isDestroyed()) aiCommandWin.close();
});
ipcMain.on("ai-command-resize", (_evt, size) => {
  if (!aiCommandWin || aiCommandWin.isDestroyed() || !size) return;
  const b = aiCommandWin.getBounds();
  const h = Math.max(240, Math.min(900, Math.round(size.height || b.height)));
  aiCommandWin.setBounds({ x: b.x, y: b.y, width: b.width, height: h });
});

ipcMain.handle("ai-agent-run", async (_evt, commandText) => {
  sendCatThinking(true);
  try {
    return await aiAgent.runCommand({ commandText, catName, persona: activeChar() && activeChar().persona, memory: activeMemoryContext() });
  } finally {
    sendCatThinking(false);
  }
});
ipcMain.handle("ai-agent-approve", async (_evt, planId) => {
  sendCatThinking(true);
  try {
    const res = await aiAgent.approve(planId);
    if (res && res.ok && res.results && res.results.some((r) => r.ok)) {
      if (petWin && !petWin.isDestroyed()) petWin.webContents.send("ai-task-complete", { agentId: "kiri-ai" });
      for (const r of res.results) {
        if (r && r.ok && r.name) {
          rememberForActiveChar("command", t("memoryFileCreated", r.name), r.path || "");
        }
      }
    }
    return res;
  } finally {
    sendCatThinking(false);
  }
});
ipcMain.on("ai-agent-cancel", (_evt, planId) => aiAgent.cancel(planId));
ipcMain.handle("ai-agent-undo", (_evt, payload) => aiAgent.undo(payload || {}));
ipcMain.on("ai-agent-open", (_evt, filePath) => aiAgent.openItem(filePath));

ipcMain.handle("ai-skills-list", () => aiAgent.listSkills());
ipcMain.handle("ai-skill-author", (_evt, description) => aiAgent.authorSkill(description));
ipcMain.handle("ai-skill-save", (_evt, skill) => {
  aiAgent.saveSkill(skill);
  return aiAgent.listSkills();
});
ipcMain.handle("ai-skill-delete", (_evt, id) => {
  aiAgent.deleteSkill(id);
  return aiAgent.listSkills();
});

// ── Voice (OpenAI STT-only) ──
// The cat's mic button records in the renderer; bytes come here, get
// transcribed by OpenAI, and the text is routed into the command agent.

function broadcastVoiceConfig() {
  broadcastAll("voice-config-changed", { enabled: aiConfig.voiceUsable() });
}

function runVoiceTranscript(text) {
  const spoken = String(text || "").trim();
  if (!spoken) {
    sendCatNotice(t("voiceNotUnderstood"));
    return;
  }
  sendCatNotice(`🎤 "${spoken.length > 48 ? spoken.slice(0, 48) + "…" : spoken}"`);
  openAiCommand();
  if (aiCommandWin && !aiCommandWin.isDestroyed()) {
    if (aiCommandReady) aiCommandWin.webContents.send("ai-voice-run", spoken);
    else aiCommandPendingVoice = spoken;
  }
}

ipcMain.handle("voice-config-get", () => ({ enabled: aiConfig.voiceUsable() }));
ipcMain.handle("voice-request-mic", async () => {
  try {
    if (systemPreferences && systemPreferences.askForMediaAccess) {
      return await systemPreferences.askForMediaAccess("microphone");
    }
  } catch {}
  return true;
});
ipcMain.handle("voice-audio", async (evt, payload) => {
  if (!aiConfig.voiceUsable()) return { error: "disabled" };
  const ch = charForSender(evt.sender);
  if (ch) setActiveChar(ch.id);
  sendCatThinking(true);
  try {
    const result = await aiVoice.transcribe(payload && payload.bytes, payload && payload.mime);
    if (result && result.ok) {
      runVoiceTranscript(result.text);
      return { ok: true, text: result.text };
    }
    if (result && result.error !== "too_short") {
      sendCatNotice((result && result.message) || t("voiceTranscribeFailed"));
    }
    return result || { error: "unknown" };
  } finally {
    sendCatThinking(false);
  }
});

ipcMain.handle("ai-set-openai-key", (_evt, key) => {
  const r = aiConfig.setOpenAiKey(key);
  broadcastVoiceConfig();
  return r;
});
ipcMain.handle("ai-clear-openai-key", () => {
  const r = aiConfig.clearOpenAiKey();
  broadcastVoiceConfig();
  return r;
});
ipcMain.handle("ai-set-gemini-key", (_evt, key) => aiConfig.setGeminiKey(key));
ipcMain.handle("ai-clear-gemini-key", () => aiConfig.clearGeminiKey());

function broadcastCharacterArt(c) {
  const win = petWins.get(c.id);
  if (win && !win.isDestroyed()) {
    win.webContents.send("character-art", { kind: c.kind, sprite: c.sprite, set: c.set, overlay: c.overlay });
  }
}

// ── Pixel-overlay editor (paint over the active pose-set character) ──
// ── Paw-point overlay: a transparent, click-through full-screen window that
// draws a paw + pulse ring where the vision answer pointed, then fades. ──
let pawWin = null;
let pawHideTimer = null;

function showPawPoint(point) {
  const display = screen.getDisplayNearestPoint({ x: point.x, y: point.y });
  const b = display.bounds;
  const local = { x: point.x - b.x, y: point.y - b.y };
  const send = () => {
    if (pawWin && !pawWin.isDestroyed()) pawWin.webContents.send("paw-point", local);
  };
  if (pawWin && !pawWin.isDestroyed()) {
    pawWin.setBounds(b);
    send();
  } else {
    pawWin = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, "renderer", "paw-overlay-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    pawWin.setIgnoreMouseEvents(true, { forward: true });
    keepWindowOnTop(pawWin);
    pawWin.on("closed", () => { pawWin = null; });
    pawWin.loadFile(path.join(__dirname, "renderer", "paw-overlay.html"));
    pawWin.webContents.once("did-finish-load", send);
  }
  // The paw animation runs ~2.6s; close a bit after so it never lingers.
  if (pawHideTimer) clearTimeout(pawHideTimer);
  pawHideTimer = setTimeout(() => {
    if (pawWin && !pawWin.isDestroyed()) pawWin.close();
    pawWin = null;
    pawHideTimer = null;
  }, 3200);
}

function openOverlayEditor() {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.show();
    overlayWin.focus();
    return;
  }
  overlayWin = new BrowserWindow({
    width: 720,
    height: 760,
    minWidth: 520,
    minHeight: 560,
    title: t("overlayEditorTitle"),
    frame: false,
    backgroundColor: "#16181c",
    resizable: true,
    alwaysOnTop: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  keepWindowOnTop(overlayWin);
  overlayWin.loadFile(path.join(__dirname, "editor", "overlay.html"));
  overlayWin.on("closed", () => { overlayWin = null; });
}
ipcMain.on("open-overlay-editor", () => openOverlayEditor());
ipcMain.on("overlay-editor-close", () => {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
});

// ── Pixel-overlay variants (named designs) + save/confirm flow ──
function overlayPresetsPath() { return path.join(app.getPath("userData"), "overlay-presets.json"); }
function loadOverlayPresets() {
  try {
    const d = JSON.parse(fs.readFileSync(overlayPresetsPath(), "utf8"));
    return Array.isArray(d.presets) ? d.presets : [];
  } catch { return []; }
}
function saveOverlayPresets(list) {
  try { fs.writeFileSync(overlayPresetsPath(), JSON.stringify({ version: 1, presets: list }, null, 2)); }
  catch (err) { console.warn("[Kiri] failed to save overlay presets:", err && err.message); }
}
function nowIso() { return new Date().toISOString(); }

ipcMain.handle("overlay-presets-get", () => {
  const c = activeChar();
  return { set: c ? c.set : "kiri", current: c ? c.overlay : null, presets: loadOverlayPresets() };
});
// Live, non-persisted preview on the pet while editing.
ipcMain.on("overlay-preview", (_e, overlay) => {
  const c = activeChar();
  if (!c) return;
  const win = petWins.get(c.id);
  if (win && !win.isDestroyed()) {
    win.webContents.send("overlay-preview", overlay ? charStore.sanitizeOverlay(overlay) : null);
  }
});
// "Save" — persist onto the active character.
ipcMain.handle("overlay-apply", (_e, overlay) => {
  const c = activeChar();
  if (!c) return { ok: false };
  c.overlay = overlay ? charStore.sanitizeOverlay(overlay) : null;
  charStore.save(characters);
  broadcastCharacterArt(c);
  return { ok: true };
});
// "Save as" — store a named variant AND apply it to the character.
ipcMain.handle("overlay-preset-save", (_e, payload) => {
  const c = activeChar();
  if (!c) return { ok: false };
  const overlay = charStore.sanitizeOverlay(payload && payload.overlay);
  if (!overlay) return { ok: false, error: "empty" };
  const name = String((payload && payload.name) || "").trim().slice(0, 40) || t("overlayDefaultName");
  const list = loadOverlayPresets();
  const id = (payload && payload.id && list.find((p) => p.id === payload.id)) ? payload.id : `ov-${Date.now()}`;
  const prev = list.find((p) => p.id === id);
  const rec = { id, name, set: c.set, overlay, createdAt: prev ? prev.createdAt : nowIso(), updatedAt: nowIso() };
  const i = list.findIndex((p) => p.id === id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  saveOverlayPresets(list);
  c.overlay = overlay;
  charStore.save(characters);
  broadcastCharacterArt(c);
  return { ok: true, preset: rec };
});
ipcMain.handle("overlay-preset-delete", (_e, id) => {
  saveOverlayPresets(loadOverlayPresets().filter((p) => p.id !== id));
  return { ok: true };
});
// Native confirm dialog (asked before saving / before discarding on close).
ipcMain.handle("overlay-confirm", async (_e, opts) => {
  const o = opts || {};
  const win = (overlayWin && !overlayWin.isDestroyed()) ? overlayWin : petWin;
  const r = await dialog.showMessageBox(win, {
    type: "question",
    buttons: [o.ok || t("confirmYes"), o.cancel || t("confirmCancel")],
    defaultId: 0,
    cancelId: 1,
    message: String(o.message || t("confirmQuestion")),
    detail: o.detail ? String(o.detail) : undefined,
  });
  return r.response === 0;
});

// ── Knowledge Journal (SM-2 spaced repetition) ──

function openAiJournal() {
  if (aiJournalWin && !aiJournalWin.isDestroyed()) {
    aiJournalWin.show();
    aiJournalWin.focus();
    return;
  }
  aiJournalWin = new BrowserWindow({
    width: 420,
    height: 480,
    minWidth: 360,
    minHeight: 320,
    title: t("journalWindowTitle"),
    frame: false,
    backgroundColor: "#fbf4e4",
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  keepWindowOnTop(aiJournalWin);
  aiJournalWin.loadFile(path.join(__dirname, "renderer", "ai-journal.html"));
  aiJournalWin.on("closed", () => {
    aiJournalWin = null;
  });
}

ipcMain.handle("ai-journal-due", () => aiJournal.dueCards());
ipcMain.handle("ai-journal-list", () => aiJournal.list());
ipcMain.handle("ai-journal-stats", () => aiJournal.stats());
ipcMain.handle("ai-journal-add", (_evt, card) => aiJournal.add(card || {}));
ipcMain.handle("ai-journal-add-from-text", async (_evt, text) => {
  const r = await aiCardgen.fromText(text);
  if (r && r.ok) {
    const card = aiJournal.add({ ...r.card, source: "ai" });
    return { ok: !!card, card };
  }
  return r;
});
ipcMain.handle("ai-journal-review", (_evt, payload) => {
  const p = payload || {};
  return aiJournal.review(p.id, p.quality);
});
ipcMain.handle("ai-journal-delete", (_evt, id) => aiJournal.remove(id));
ipcMain.on("ai-journal-close", () => {
  if (aiJournalWin && !aiJournalWin.isDestroyed()) aiJournalWin.close();
});
ipcMain.on("ai-journal-resize", (_evt, size) => {
  if (!aiJournalWin || aiJournalWin.isDestroyed() || !size) return;
  const b = aiJournalWin.getBounds();
  aiJournalWin.setBounds({
    x: b.x, y: b.y, width: b.width,
    height: Math.max(320, Math.min(900, Math.round(size.height || b.height))),
  });
});

// ── Per-character memory (work history + auto-context) ──

function openMemoryWindow() {
  if (memoryWin && !memoryWin.isDestroyed()) {
    memoryWin.show();
    memoryWin.focus();
    return;
  }
  memoryWin = new BrowserWindow({
    width: 440,
    height: 520,
    minWidth: 360,
    minHeight: 320,
    title: t("memoryTitle"),
    frame: false,
    backgroundColor: "#fbf4e4",
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: true,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "ai-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  keepWindowOnTop(memoryWin);
  memoryWin.loadFile(path.join(__dirname, "renderer", "ai-memory.html"));
  memoryWin.on("closed", () => { memoryWin = null; });
}

ipcMain.handle("memory-list", () => {
  const c = activeChar();
  return {
    charName: (c && c.name) || catName || "Kiri",
    entries: activeCharId ? aiMemory.list(activeCharId) : [],
  };
});
ipcMain.handle("memory-delete", (_evt, id) => {
  if (!activeCharId) return { ok: false };
  const r = aiMemory.remove(activeCharId, id);
  return r;
});
ipcMain.handle("memory-clear", () => {
  if (!activeCharId) return { ok: false };
  return aiMemory.clear(activeCharId);
});
ipcMain.handle("memory-open-file", () => {
  if (!activeCharId) return { ok: false };
  shell.openPath(aiMemory.mdPath(activeCharId));
  return { ok: true };
});
ipcMain.on("memory-close", () => {
  if (memoryWin && !memoryWin.isDestroyed()) memoryWin.close();
});

// Gentle proactive nudge when cards are due (at most once / 4h).
function checkJournalDue() {
  try {
    const due = aiJournal.dueCount();
    if (due > 0 && Date.now() - lastJournalNudgeAt > 4 * 60 * 60 * 1000) {
      lastJournalNudgeAt = Date.now();
      sendCatNotice(t("journalDueNudge", due));
    }
  } catch {}
}
function startJournalReminder() {
  if (journalReminderTimer) clearInterval(journalReminderTimer);
  journalReminderTimer = setInterval(checkJournalDue, 30 * 60 * 1000);
  setTimeout(checkJournalDue, 90 * 1000);
}

function agentHookDir() {
  return path.join(app.getPath("userData"), "hooks");
}

function ensureAgentHookRunner() {
  const { writeHookRunner } = require("./hooks/install");
  return writeHookRunner(agentHookDir(), process.execPath);
}

function installClaudeCodeHooks() {
  try {
    const { registerClaudeHooks } = require("./hooks/install");
    const hookDir = agentHookDir();
    fs.mkdirSync(hookDir, { recursive: true });
    for (const file of ["kiri-claude-hook.js", "server-config.js"]) {
      fs.copyFileSync(path.join(__dirname, "hooks", file), path.join(hookDir, file));
    }
    const result = registerClaudeHooks({
      hookScript: path.join(hookDir, "kiri-claude-hook.js"),
      runnerPath: ensureAgentHookRunner(),
    });
    if (result.added || result.updated) {
      console.log(`[Kiri] synced Claude Code hooks (added ${result.added}, updated ${result.updated})`);
    }
  } catch (err) {
    console.warn("[Kiri] failed to sync Claude Code hooks:", err && err.message);
  }
}

function installAntigravityHooks() {
  try {
    const { registerAntigravityHooks } = require("./hooks/install");
    const hookDir = agentHookDir();
    fs.mkdirSync(hookDir, { recursive: true });
    for (const file of ["kiri-antigravity-hook.js", "server-config.js"]) {
      fs.copyFileSync(path.join(__dirname, "hooks", file), path.join(hookDir, file));
    }
    const result = registerAntigravityHooks({
      hookScript: path.join(hookDir, "kiri-antigravity-hook.js"),
      runnerPath: ensureAgentHookRunner(),
    });
    if (result.added || result.updated) {
      console.log(`[Kiri] synced Antigravity hooks (added ${result.added}, updated ${result.updated})`);
    }
  } catch (err) {
    console.warn("[Kiri] failed to sync Antigravity hooks:", err && err.message);
  }
}

function installCursorHooks() {
  try {
    const { registerCursorHooks } = require("./hooks/install");
    const hookDir = agentHookDir();
    fs.mkdirSync(hookDir, { recursive: true });
    for (const file of ["kiri-cursor-hook.js", "server-config.js"]) {
      fs.copyFileSync(path.join(__dirname, "hooks", file), path.join(hookDir, file));
    }
    const result = registerCursorHooks({
      hookScript: path.join(hookDir, "kiri-cursor-hook.js"),
      runnerPath: ensureAgentHookRunner(),
    });
    if (result.added || result.updated) {
      console.log(`[Kiri] synced Cursor hooks (added ${result.added}, updated ${result.updated})`);
    }
  } catch (err) {
    console.warn("[Kiri] failed to sync Cursor hooks:", err && err.message);
  }
}

function startCodexMonitor() {
  if (codexMonitor) return;
  try {
    const CodexLogMonitor = require("./agents/codex-log-monitor");
    codexMonitor = new CodexLogMonitor(handleAgentStateEvent);
    codexMonitor.start();
  } catch (err) {
    console.warn("[Kiri] Codex log monitor unavailable:", err && err.message);
  }
}

function startKiroMonitor() {
  if (kiroMonitor) return;
  try {
    const KiroLogMonitor = require("./agents/kiro-log-monitor");
    kiroMonitor = new KiroLogMonitor(handleAgentStateEvent);
    kiroMonitor.start();
  } catch (err) {
    console.warn("[Kiri] Kiro log monitor unavailable:", err && err.message);
  }
}

function startCursorAgentMonitor() {
  if (cursorAgentMonitor) return;
  try {
    const CursorLogMonitor = require("./agents/cursor-log-monitor");
    cursorAgentMonitor = new CursorLogMonitor(handleAgentStateEvent);
    cursorAgentMonitor.start();
  } catch (err) {
    console.warn("[Kiri] Cursor log monitor unavailable:", err && err.message);
  }
}

function startAgentIntegrations() {
  // Respect the saved tray toggle: when monitoring is off we must not rewrite
  // third-party configs, run pollers, or hold the port.
  if (!agentMonitoringEnabled) return;
  startAgentStateServer();
  installClaudeCodeHooks();
  installAntigravityHooks();
  installCursorHooks();
  startCodexMonitor();
  startKiroMonitor();
  startCursorAgentMonitor();
}

function uninstallAgentHooks() {
  try {
    const { unregisterClaudeHooks, unregisterAntigravityHooks, unregisterCursorHooks } = require("./hooks/install");
    let removed = 0;
    for (const unregister of [unregisterClaudeHooks, unregisterAntigravityHooks, unregisterCursorHooks]) {
      try {
        removed += unregister().removed || 0;
      } catch (err) {
        console.warn("[Kiri] hook removal failed:", err && err.message);
      }
    }
    if (removed) console.log(`[Kiri] removed ${removed} agent hook entries`);
  } catch (err) {
    console.warn("[Kiri] failed to remove agent hooks:", err && err.message);
  }
}

function stopAgentIntegrations() {
  activeAgentSessions.clear();
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send("ai-task-state", { agentId: "sweep", state: "idle" });
  }
  if (codexMonitor) {
    codexMonitor.stop();
    codexMonitor = null;
  }
  if (kiroMonitor) {
    kiroMonitor.stop();
    kiroMonitor = null;
  }
  if (cursorAgentMonitor) {
    cursorAgentMonitor.stop();
    cursorAgentMonitor = null;
  }
  if (agentStateServer) {
    try { agentStateServer.close(); } catch {}
    agentStateServer = null;
  }
}

function registerGlobalShortcuts() {
  globalShortcut.unregister("CommandOrControl+-");
  globalShortcut.unregister("CommandOrControl+=");
  globalShortcut.unregister("CommandOrControl+0");
  globalShortcut.unregister("CommandOrControl+J");
  const shortcuts = [
    ...(!releaseBuildExcludesDevOptions() ? [["CommandOrControl+J", () => triggerJumpSequence()]] : []),
  ];
  for (const [accelerator, handler] of shortcuts) {
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`[Kiri] failed to register shortcut: ${accelerator}`);
    }
  }
}

function openMacPrivacyPane(anchor) {
  if (!IS_MAC) return;
  shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`).catch(() => {});
}

function requestAccessibilityPermission() {
  if (!IS_MAC) return true;
  try {
    return systemPreferences.isTrustedAccessibilityClient(true);
  } catch (err) {
    console.warn("[Kiri] accessibility permission check failed:", err && err.message);
    return false;
  }
}

function showAccessibilityPermissionGuideOnce() {
  if (!IS_MAC || accessibilityPermissionGuideShown) return;
  accessibilityPermissionGuideShown = true;
  setTimeout(async () => {
    try {
      const result = await dialog.showMessageBox({
        type: "info",
        title: t("accessibilityPermissionTitle"),
        message: t("accessibilityPermissionMessage"),
        detail: t("accessibilityPermissionDetail"),
        buttons: [t("openAccessibility"), t("later")],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) openMacPrivacyPane("Privacy_Accessibility");
    } catch {}
  }, 800);
}

function showInputPermissionGuideOnce() {
  if (!IS_MAC || inputPermissionGuideShown) return;
  inputPermissionGuideShown = true;
  setTimeout(async () => {
    try {
      const result = await dialog.showMessageBox({
        type: "info",
        title: t("inputPermissionTitle"),
        message: t("inputPermissionMessage"),
        detail: t("inputPermissionDetail"),
        buttons: [t("openInputMonitoring"), t("later")],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) openMacPrivacyPane("Privacy_ListenEvent");
    } catch {}
  }, 800);
}

function showGlobalInputPermissionGuideOnce() {
  if (IS_MAC || inputPermissionGuideShown) return;
  inputPermissionGuideShown = true;
  setTimeout(async () => {
    try {
      await dialog.showMessageBox({
        type: "info",
        title: t("globalInputPermissionTitle"),
        message: t("globalInputPermissionMessage"),
        detail: t("globalInputPermissionDetail"),
        buttons: [t("later")],
        defaultId: 0,
        cancelId: 0,
        icon: nativeImage.createFromPath(APP_ICON_PATH),
      });
    } catch {}
  }, 800);
}

// ── Push-to-talk: hold a modifier combo → ask about the whole screen ──
// The combo is evaluated on every modifier-key transition from the global input
// hook. On hold-start we snapshot the screen (so it reflects what the user is
// asking about) and tell the pet to start recording; on release the pet stops
// and sends the audio, which we transcribe and answer against that snapshot.
let pttActive = false;
let pttCapturePromise = null;

function pttComboFromHotkey(hotkey) {
  switch (hotkey) {
    case "ctrl+shift": return (e) => e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
    case "alt+shift": return (e) => e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;
    case "cmd+alt": return (e) => e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey;
    case "ctrl+alt":
    default: return (e) => e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey;
  }
}

function evaluatePttCombo(event) {
  if (!event || !aiConfig.pttUsable()) {
    if (pttActive) stopPtt();
    return;
  }
  const held = pttComboFromHotkey(aiConfig.loadConfig().pttHotkey)(event);
  if (held && !pttActive) startPtt();
  else if (!held && pttActive) stopPtt();
}

function startPtt() {
  if (pttActive) return;
  pttActive = true;
  // Snapshot the screen now (async), stash the promise for the audio handler.
  pttCapturePromise = aiAssistant.captureScreen(petWin).catch((err) => ({
    error: "capture",
    message: (err && err.message) || "capture failed",
  }));
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send("ptt-start");
}

function stopPtt() {
  if (!pttActive) return;
  pttActive = false;
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send("ptt-stop");
}

ipcMain.handle("ptt-audio", async (evt, payload) => {
  if (!aiConfig.pttUsable()) return { error: "disabled" };
  const ch = charForSender(evt.sender);
  if (ch) setActiveChar(ch.id);
  const capResult = pttCapturePromise ? await pttCapturePromise : null;
  pttCapturePromise = null;
  sendCatThinking(true);
  try {
    const stt = await aiVoice.transcribe(payload && payload.bytes, payload && payload.mime);
    if (!stt || !stt.ok) {
      if (stt && stt.error !== "too_short") sendCatNotice((stt && stt.message) || t("voiceTranscribeFailed"));
      return stt || { error: "unknown" };
    }
    if (!capResult || !capResult.ok) {
      sendCatNotice((capResult && capResult.message) || t("aiAnalyzeFailed"));
      return { error: (capResult && capResult.error) || "capture" };
    }
    const c = activeChar();
    let started = false;
    const answer = await aiAssistant.answerScreenQuestion(capResult.capture, {
      question: stt.text,
      catName,
      persona: c && c.persona,
      memory: activeMemoryContext(),
    }, (textSoFar) => {
      if (!started) { sendScreenStream("start"); started = true; }
      sendScreenStream("delta", textSoFar);
    });
    if (answer && answer.ok) {
      sendScreenAnswer({ question: stt.text, text: answer.text, point: answer.point });
      rememberForActiveChar("screen", stt.text, answer.text);
      return { ok: true };
    }
    if (answer && answer.error !== "aborted") {
      sendCatNotice((answer && answer.message) || t("aiError"));
    }
    return answer || { error: "unknown" };
  } finally {
    sendCatThinking(false);
  }
});

// Typed "ask about my screen": text twin of push-to-talk. Captures the whole
// screen and answers with a bubble + paw point. Only needs a vision provider
// (no OpenAI/STT), so it works on Ollama / any provider.
ipcMain.handle("ask-screen", async (evt, question) => {
  const q = String(question || "").trim();
  if (!q) return { error: "empty" };
  const cfg = aiConfig.loadConfig();
  if (!cfg.enabled || !aiConfig.providerReady()) {
    sendCatNotice(t("aiKeyRequired"));
    openAiSettings();
    return { error: "no_key" };
  }
  const ch = charForSender(evt.sender);
  if (ch) setActiveChar(ch.id);
  sendCatThinking(true);
  let started = false;
  try {
    const answer = await aiAssistant.askAboutScreen(petWin, {
      question: q,
      catName,
      persona: activeChar() && activeChar().persona,
      memory: activeMemoryContext(),
    }, (textSoFar) => {
      if (!started) { sendScreenStream("start"); started = true; }
      sendScreenStream("delta", textSoFar);
    });
    if (answer && answer.ok) {
      sendScreenAnswer({ question: q, text: answer.text, point: answer.point });
      rememberForActiveChar("screen", q, answer.text);
      return { ok: true };
    }
    if (answer && answer.error !== "aborted") {
      sendCatNotice((answer && answer.message) || t("aiError"));
    }
    return answer || { error: "unknown" };
  } finally {
    sendCatThinking(false);
  }
});

function startKeyHook() {
  if (keyHookStarted) return;
  if (!uIOhook) {
    console.warn("[Kiri] global input hook unavailable: uiohook-napi is not loaded");
    showGlobalInputPermissionGuideOnce();
    return;
  }
  try {
    const accessibilityTrusted = requestAccessibilityPermission();
    if (!accessibilityTrusted) showAccessibilityPermissionGuideOnce();
    if (!keyHookListenersAttached) {
      uIOhook.on("keydown", (event) => {
        broadcastAll("key-pressed");
        evaluatePttCombo(event);
      });
      uIOhook.on("keyup", (event) => {
        evaluatePttCombo(event);
      });
      uIOhook.on("wheel", (event) => {
        broadcastAll("mouse-wheel", {
          rotation: event && typeof event.rotation === "number" ? event.rotation : 0,
        });
      });
      keyHookListenersAttached = true;
    }
    uIOhook.start();
    keyHookStarted = true;
    if (keyHookRetryTimer) {
      clearInterval(keyHookRetryTimer);
      keyHookRetryTimer = null;
    }
    console.log("[Kiri] global input hook started");
  } catch (err) {
    // Global input hooks may fail when OS permissions or security policy blocks native hooks.
    console.warn("[Kiri] global key hook unavailable:", err && err.message);
    if (IS_MAC) {
      if (requestAccessibilityPermission()) showInputPermissionGuideOnce();
      else showAccessibilityPermissionGuideOnce();
    } else {
      showGlobalInputPermissionGuideOnce();
    }
    if (!keyHookRetryTimer) {
      keyHookRetryTimer = setInterval(() => {
        if (!keyHookStarted) startKeyHook();
      }, 5000);
    }
  }
}

function sendUpdateState(state) {
  broadcastAll("update-state", state);
}

function isVersionNewer(candidate, current) {
  const next = String(candidate || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const base = String(current || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(next.length, base.length, 3); i += 1) {
    if ((next[i] || 0) > (base[i] || 0)) return true;
    if ((next[i] || 0) < (base[i] || 0)) return false;
  }
  return false;
}

function sendAvailableUpdateState(kind, info) {
  const version = info && info.version ? info.version : null;
  if (!isVersionNewer(version, app.getVersion())) {
    sendUpdateState({ state: pendingManualUpdateCheck ? "none" : "idle" });
    pendingManualUpdateCheck = false;
    return;
  }
  sendUpdateState({ state: kind, version });
  pendingManualUpdateCheck = false;
}

function setupAutoUpdater() {
}

async function regular_check() {
  if (regularCheckRunning) return;
  regularCheckRunning = true;
  try {
    await checkForUpdatesNow();
  } finally {
    regularCheckRunning = false;
  }
}

function scheduleRegularChecks() {
  if (!app.isPackaged) return;
  if (regularCheckTimer) clearInterval(regularCheckTimer);
  setTimeout(() => regular_check().catch(() => {}), 10_000);
  regularCheckTimer = setInterval(() => {
    regular_check().catch(() => {});
  }, REGULAR_CHECK_INTERVAL_MS);
}

// A second instance would lose the 23456 port race yet still install hooks,
// start monitors, and show a second tray — quit it instead. The smoke test
// bypasses the lock so it can run while the real app is open.
const hasSingleInstanceLock = IS_SMOKE_TEST || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}
app.on("second-instance", () => {
  if (petWin && !petWin.isDestroyed()) {
    petWin.show();
  }
});

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  try {
    logInfo("[Kiri] starting", {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      node: process.versions.node,
      logPath: STARTUP_LOG_PATH,
      smokeTest: IS_SMOKE_TEST,
    });
    if (IS_SMOKE_TEST) {
      logInfo("[Kiri] smoke test passed");
      app.quit();
      return;
    }
    app.setName("Kiri");
    if (app.dock && fs.existsSync(APP_ICON_PATH)) {
      app.dock.setIcon(nativeImage.createFromPath(APP_ICON_PATH));
    }
    currentLanguage = defaultLanguage();
    loadSettings();
    loadPattern();
    buildAppMenu();
    registerGlobalShortcuts();
    startApp();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length > 0) return;
      startApp();
    });
  } catch (error) {
    logError("[Kiri] startup failed:", error);
    try {
      dialog.showErrorBox("Kiri failed to start", error && error.message ? error.message : String(error || "Unknown error"));
    } catch {}
  }
});

app.on("will-quit", () => {
  stopKeyHook();
  if (cursorPollTimer) {
    clearInterval(cursorPollTimer);
    cursorPollTimer = null;
  }
  if (journalReminderTimer) {
    clearInterval(journalReminderTimer);
    journalReminderTimer = null;
  }
  if (stretchTimer) {
    clearInterval(stretchTimer);
    stretchTimer = null;
  }
  stopReminderTimer();
  stopPomodoroTimer();
  stopAgentIntegrations();
  if (agentSweepTimer) {
    clearInterval(agentSweepTimer);
    agentSweepTimer = null;
  }
  if (regularCheckTimer) {
    clearInterval(regularCheckTimer);
    regularCheckTimer = null;
  }
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (!IS_MAC) app.quit();
});
