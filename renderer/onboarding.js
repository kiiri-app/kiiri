"use strict";

// First-run welcome: pick a companion + names → how it works + consent to
// watching AI coding agents → optional AI brain → permissions explained.
// Everything is applied once, on "Done" (or defaults on "Skip").

const api = window.onboardingAPI;
const $ = (id) => document.getElementById(id);

const I18N = {
  en: {
    title: "Welcome to Kiiri",
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
    aiCloud: "Kiiri Cloud — coming soon",
    aiCloudBody: "Free with just your email, no key needed. Opening soon — pick another option for now.",
    cloudSend: "Send link",
    cloudWaiting: (e) => `Check ${e} and click the link — I'll wait here.`,
    cloudDone: (e) => `Signed in as ${e}. I'm ready!`,
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
    tryTitle: "Then try asking me:",
    try1: "Right-click ▸ Ask about my screen ▸ “What does this error mean?”",
    try2: "Drop me onto a long article ▸ “Summarize”",
    try3: "Right-click ▸ Give Kiri a command ▸ “Turn these meeting notes into minutes”",
  },
  tr: {
    title: "Kiiri'ye hoş geldin",
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
    aiCloud: "Kiiri Cloud — yakında",
    aiCloudBody: "Sadece e-postanla, anahtarsız ve ücretsiz. Çok yakında açılıyor; şimdilik başka bir seçenek seç.",
    cloudSend: "Bağlantı gönder",
    cloudWaiting: (e) => `${e} adresine gelen bağlantıya tıkla, ben burada bekliyorum.`,
    cloudDone: (e) => `${e} ile giriş yapıldı. Hazırım!`,
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
    tryTitle: "Sonra bana şunları sorabilirsin:",
    try1: "Sağ tık ▸ Ekranımı sor ▸ “Bu hata ne demek?”",
    try2: "Beni uzun bir makalenin üstüne bırak ▸ “Özetle”",
    try3: "Sağ tık ▸ Kiri'ye komut ver ▸ “Bu toplantı notlarını tutanağa çevir”",
  },
  ko: {
    title: "Kiiri에 오신 걸 환영해요",
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
    aiCloud: "Kiiri Cloud — 곧 출시",
    aiCloudBody: "이메일만으로 키 없이 무료로 쓸 수 있어요. 곧 열려요. 지금은 다른 옵션을 골라 주세요.",
    cloudSend: "링크 보내기",
    cloudWaiting: (e) => `${e}에서 링크를 눌러 주세요. 여기서 기다릴게요.`,
    cloudDone: (e) => `${e}(으)로 로그인했어요. 준비 완료!`,
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
    tryTitle: "그다음 이렇게 물어보세요:",
    try1: "오른쪽 클릭 ▸ 내 화면에 대해 묻기 ▸ “이 오류는 무슨 뜻이야?”",
    try2: "긴 글 위에 나를 놓기 ▸ “요약”",
    try3: "오른쪽 클릭 ▸ 명령하기 ▸ “이 회의 메모를 회의록으로 정리해 줘”",
  },
  ja: {
    title: "Kiiri へようこそ",
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
    aiCloud: "Kiiri Cloud — 近日公開",
    aiCloudBody: "メールアドレスだけ、キー不要で無料。もうすぐ公開です。今は別の選択肢を選んでね。",
    cloudSend: "リンクを送る",
    cloudWaiting: (e) => `${e} に届いたリンクをクリックしてね。ここで待ってるよ。`,
    cloudDone: (e) => `${e} でサインインしたよ。準備OK！`,
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
    tryTitle: "そのあと、こう聞いてみて:",
    try1: "右クリック ▸ 画面について聞く ▸「このエラーはどういう意味？」",
    try2: "長い記事の上に私を置く ▸「要約」",
    try3: "右クリック ▸ Kiri に指示する ▸「この会議メモを議事録にして」",
  },
};

const steps = [...document.querySelectorAll(".step")];
const dots = [...document.querySelectorAll(".dots i")];
let lang = "en";
let step = 0;
let pickedSet = "kiri";
let nameTouched = false;

const L = (key, ...args) => {
  const v = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  return typeof v === "function" ? v(...args) : v;
};

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

// Kiiri Cloud: the email field only shows while that choice is picked. Sign-in
// is polled in the main process, so finishing before the link is clicked is fine.
let cloudEmailSent = "";
function syncCloudChoice() {
  const ai = document.querySelector('input[name="ai"]:checked');
  $("cloud-signin").hidden = !ai || ai.value !== "cloud";
}
function showCloud(state) {
  const status = $("cloud-status");
  status.classList.remove("err", "ok");
  if (state && state.signedIn) {
    $("cloud-form").hidden = true;
    status.textContent = L("cloudDone", state.email || cloudEmailSent);
    status.classList.add("ok");
  } else if (state && state.signingIn) {
    $("cloud-form").hidden = true;
    status.textContent = L("cloudWaiting", cloudEmailSent || state.email || "");
  } else {
    $("cloud-form").hidden = false;
    if (state && state.result && !state.result.ok) { status.textContent = state.result.message || ""; status.classList.add("err"); }
    else status.textContent = "";
  }
}
for (const r of document.querySelectorAll('input[name="ai"]')) r.addEventListener("change", syncCloudChoice);
$("cloud-send").addEventListener("click", async () => {
  const email = $("cloud-email").value.trim();
  const r = await api.cloudSignIn(email).catch(() => null);
  if (!r || !r.ok) { showCloud({ result: r || { ok: false, message: "" } }); return; }
  cloudEmailSent = r.email || email;
  showCloud({ signingIn: true });
});
$("cloud-email").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); $("cloud-send").click(); } });
api.onCloudAuth((state) => showCloud(state));

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
  syncCloudChoice();
  try { showCloud(await api.cloudStatus()); } catch {}
  if (state.petName && state.petName !== "Kiri" && state.petName !== "Tori") {
    $("pet-name").value = state.petName;
    nameTouched = true;
  }
  applyI18n();
})();
