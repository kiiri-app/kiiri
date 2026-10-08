"use strict";

// First-run welcome: pick a companion + names → how it works + consent to
// watching AI coding agents → optional AI brain → permissions explained.
// Everything is applied once, on "Done" (or defaults on "Skip").

const api = window.onboardingAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    title: "Welcome to Kiri",
    s1Title: "Hi! Who will keep you company?",
    petName: "Its name",
    yourName: "Your name (optional)",
    s2Title: "How we get along",
    tipDrag: "Drag me anywhere — I hang on while you carry me.",
    tipClick: "Click me and I'll perk up and listen.",
    tipMenu: "Right-click for everything: pomodoro, reminders, AI, settings.",
    agentsTitle: "Watch my AI coding agents",
    agentsBody: "I'll show when Claude Code, Cursor, Codex… are working and ping you when they need approval. This adds a small hook to their settings; turn it off anytime from the menu-bar icon.",
    s3Title: "Give me a brain (optional)",
    s3Lead: "With an AI model I can look at your screen, answer questions and make files. You can always set this up later.",
    aiLater: "Later",
    aiLaterBody: "Just be my desk buddy for now.",
    aiLocal: "Local & private (Ollama)",
    aiLocalBody: "Free, runs on this computer. Needs Ollama installed.",
    aiKey: "I have an API key",
    aiKeyBody: "Claude, OpenAI or Gemini — I'll open the settings next.",
    s4Title: "About permissions",
    s4Lead: "Nothing is needed right now. Your system asks only when you first use a feature:",
    permScreen: "Screen recording",
    permScreenBody: "only when you ask me about your screen. Screenshots stay in memory.",
    permMic: "Microphone",
    permMicBody: "only for voice questions.",
    permKeys: "Accessibility",
    permKeysBody: "only if you turn on hold-to-talk.",
    skip: "Skip",
    back: "Back",
    next: "Next",
    done: "Let's go!",
  },
  tr: {
    title: "Kiri'ye hoş geldin",
    s1Title: "Merhaba! Sana kim eşlik etsin?",
    petName: "Adı",
    yourName: "Senin adın (isteğe bağlı)",
    s2Title: "Nasıl anlaşırız",
    tipDrag: "Beni istediğin yere sürükle — taşırken ensemden sarkarım.",
    tipClick: "Bana tıklarsan kulak kabartıp dinlerim.",
    tipMenu: "Her şey sağ tıkta: pomodoro, hatırlatıcılar, yapay zekâ, ayarlar.",
    agentsTitle: "Yapay zekâ kodlama ajanlarımı izle",
    agentsBody: "Claude Code, Cursor, Codex… çalışırken bunu gösteririm, onay beklediklerinde haber veririm. Bunun için ayarlarına küçük bir hook eklerim; menü çubuğu simgesinden istediğin an kapatabilirsin.",
    s3Title: "Bana bir beyin ver (isteğe bağlı)",
    s3Lead: "Bir yapay zekâ modeliyle ekranına bakıp soruları yanıtlayabilir, dosya hazırlayabilirim. Bunu sonra da kurabilirsin.",
    aiLater: "Sonra",
    aiLaterBody: "Şimdilik sadece masa arkadaşın olayım.",
    aiLocal: "Yerel ve gizli (Ollama)",
    aiLocalBody: "Ücretsiz, bu bilgisayarda çalışır. Ollama kurulu olmalı.",
    aiKey: "API anahtarım var",
    aiKeyBody: "Claude, OpenAI ya da Gemini — ardından ayarları açarım.",
    s4Title: "İzinler hakkında",
    s4Lead: "Şu an hiçbir izin gerekmiyor. Sistemin yalnızca bir özelliği ilk kullandığında sorar:",
    permScreen: "Ekran kaydı",
    permScreenBody: "yalnızca bana ekranını sorduğunda. Ekran görüntüleri sadece bellekte kalır.",
    permMic: "Mikrofon",
    permMicBody: "yalnızca sesli sorular için.",
    permKeys: "Erişilebilirlik",
    permKeysBody: "yalnızca bas-konuş'u açarsan.",
    skip: "Geç",
    back: "Geri",
    next: "İleri",
    done: "Hadi başlayalım!",
  },
  ko: {
    title: "Kiri에 오신 걸 환영해요",
    s1Title: "안녕! 누가 함께할까요?",
    petName: "이름",
    yourName: "내 이름 (선택)",
    s2Title: "이렇게 지내요",
    tipDrag: "아무 데로나 끌어 옮겨요 — 옮기는 동안 매달려 있을게요.",
    tipClick: "클릭하면 귀를 쫑긋 세우고 들어요.",
    tipMenu: "오른쪽 클릭으로 뽀모도로, 알림, AI, 설정을 열어요.",
    agentsTitle: "AI 코딩 에이전트 지켜보기",
    agentsBody: "Claude Code, Cursor, Codex… 가 작업 중이면 보여 주고, 승인이 필요하면 알려 줘요. 이를 위해 해당 설정에 작은 훅을 추가하며, 메뉴 막대 아이콘에서 언제든 끌 수 있어요.",
    s3Title: "두뇌 연결하기 (선택)",
    s3Lead: "AI 모델이 있으면 화면을 보고 질문에 답하고 파일도 만들 수 있어요. 나중에 설정해도 돼요.",
    aiLater: "나중에",
    aiLaterBody: "지금은 책상 친구로만 지낼게요.",
    aiLocal: "로컬 & 비공개 (Ollama)",
    aiLocalBody: "무료, 이 컴퓨터에서 실행돼요. Ollama 설치가 필요해요.",
    aiKey: "API 키가 있어요",
    aiKeyBody: "Claude, OpenAI, Gemini — 다음에 설정을 열게요.",
    s4Title: "권한 안내",
    s4Lead: "지금은 아무 권한도 필요 없어요. 기능을 처음 쓸 때만 시스템이 물어봐요:",
    permScreen: "화면 기록",
    permScreenBody: "화면에 대해 물어볼 때만. 스크린샷은 메모리에만 머물러요.",
    permMic: "마이크",
    permMicBody: "음성 질문에만.",
    permKeys: "손쉬운 사용",
    permKeysBody: "눌러서 말하기를 켤 때만.",
    skip: "건너뛰기",
    back: "이전",
    next: "다음",
    done: "시작하자!",
  },
  ja: {
    title: "Kiri へようこそ",
    s1Title: "こんにちは！だれと一緒に過ごす？",
    petName: "名前",
    yourName: "あなたの名前（任意）",
    s2Title: "なかよくする方法",
    tipDrag: "どこへでもドラッグしてね — 運ぶ間ぶら下がってるよ。",
    tipClick: "クリックすると耳をすませて聞くよ。",
    tipMenu: "右クリックでポモドーロ、通知、AI、設定がそろうよ。",
    agentsTitle: "AI コーディングエージェントを見守る",
    agentsBody: "Claude Code、Cursor、Codex… の作業中を表示し、承認が必要なときに知らせます。そのため各設定に小さなフックを追加します。メニューバーのアイコンからいつでもオフにできます。",
    s3Title: "頭脳をつなぐ（任意）",
    s3Lead: "AI モデルがあれば画面を見て質問に答えたり、ファイルを作ったりできます。あとで設定してもOK。",
    aiLater: "あとで",
    aiLaterBody: "今はデスクの相棒でいるね。",
    aiLocal: "ローカル＆プライベート（Ollama）",
    aiLocalBody: "無料、このコンピューターで動きます。Ollama のインストールが必要です。",
    aiKey: "API キーを持っている",
    aiKeyBody: "Claude、OpenAI、Gemini — 次に設定を開きます。",
    s4Title: "権限について",
    s4Lead: "今は何も必要ありません。機能を初めて使うときだけシステムが確認します：",
    permScreen: "画面収録",
    permScreenBody: "画面について質問したときだけ。スクリーンショットはメモリ内だけ。",
    permMic: "マイク",
    permMicBody: "音声で質問するときだけ。",
    permKeys: "アクセシビリティ",
    permKeysBody: "押して話すをオンにしたときだけ。",
    skip: "スキップ",
    back: "戻る",
    next: "次へ",
    done: "はじめよう！",
  },
};

const steps = [...document.querySelectorAll(".step")];
const dots = [...document.querySelectorAll(".dots i")];
let lang = "en";
let step = 0;
let pickedSet = "kiri";
let nameTouched = false;

const L = (key) => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;

function applyI18n() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = L(el.dataset.i18n);
  $("lang").value = lang;
  render();
}

function render() {
  steps.forEach((el, i) => { el.hidden = i !== step; });
  dots.forEach((el, i) => el.classList.toggle("on", i === step));
  $("back").hidden = step === 0;
  $("next").textContent = step === steps.length - 1 ? L("done") : L("next");
}

function pick(set) {
  pickedSet = set === "tori" ? "tori" : "kiri";
  for (const b of document.querySelectorAll(".pet")) b.classList.toggle("selected", b.dataset.set === pickedSet);
  // Suggest the companion's own name until the user types one.
  if (!nameTouched) $("pet-name").value = pickedSet === "tori" ? "Tori" : "Kiri";
}

function choices() {
  const ai = document.querySelector('input[name="ai"]:checked');
  return {
    set: pickedSet,
    petName: $("pet-name").value.trim(),
    userName: $("user-name").value.trim(),
    agentMonitoring: $("agents").checked,
    ai: ai ? ai.value : "later",
  };
}

for (const b of document.querySelectorAll(".pet")) b.addEventListener("click", () => pick(b.dataset.set));
$("pet-name").addEventListener("input", () => { nameTouched = true; });
$("lang").addEventListener("change", async () => {
  lang = I18N[$("lang").value] ? $("lang").value : "en";
  applyI18n();
  try { await api.setLanguage(lang); } catch {}
});
$("back").addEventListener("click", () => { if (step > 0) { step -= 1; render(); } });
$("next").addEventListener("click", async () => {
  if (step < steps.length - 1) { step += 1; render(); return; }
  $("next").disabled = true;
  try { await api.finish(choices()); } catch { $("next").disabled = false; }
});
// Skip keeps the defaults shown (companion/names as picked so far).
$("skip").addEventListener("click", () => api.finish({ ...choices(), skipped: true }).catch(() => {}));
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "BUTTON") $("next").click();
});

(async () => {
  let state = {};
  try { state = (await api.get()) || {}; } catch {}
  lang = I18N[state.language] ? state.language : "en";
  if (state.userName) $("user-name").value = state.userName;
  $("agents").checked = state.agentMonitoring !== false;
  pick(state.set);
  if (state.petName && state.petName !== "Kiri" && state.petName !== "Tori") {
    $("pet-name").value = state.petName;
    nameTouched = true;
  }
  applyI18n();
})();
