"use strict";

const I18N = {
  en: {
    windowTitle: "Kiri AI Assistant Settings",
    titlebar: "🐾 AI Assistant",
    close: "Close",
    enableAssistant: "Turn on AI Assistant",
    profilesHeading: "Quick profiles",
    profilesHint: "Pick a mode — it flips the provider, voice and spoken-answer settings together. You can still fine-tune anything below.",
    profileLocalName: "Local",
    profileLocalDesc: "Offline & private. Ollama brain, built-in voice, no cloud.",
    profileFastName: "Fast",
    profileFastDesc: "Snappy & cheap. Small cloud model, no voice.",
    profileQualityName: "Quality",
    profileQualityDesc: "Best answers + full voice. Needs an OpenAI key.",
    styleHeading: "Writing style",
    stylePresetLabel: "Quick pick:",
    styleHint: "How the files I make and my task results should read. The cat's personality (how it talks) is set separately per character.",
    styleNotePlaceholder: "Anything else? (e.g. address the reader as \"you\", use metric units)",
    presetProfessional: "Professional",
    presetFriendly: "Friendly",
    presetAcademic: "Academic",
    presetPlain: "Plain",
    presetClear: "Clear",
    tag_professional: "Professional",
    tag_friendly: "Friendly",
    tag_warm: "Warm",
    tag_direct: "Direct",
    tag_concise: "Concise",
    tag_detailed: "Detailed",
    tag_formal: "Formal",
    tag_plain: "Plain language",
    tag_bullets: "Bullet lists",
    tag_activeVoice: "Active voice",
    tag_noEmDash: "No em dashes",
    tag_noEmoji: "No emoji",
    anthropicKeyHeading: "Anthropic API key",
    save: "Save",
    remove: "Remove",
    noKey: "No key yet",
    keySaved: "Key saved ✓",
    encWarning: "⚠️ No secure storage on this device — the key is stored unencrypted in a local file.",
    providerHeading: "Provider (LLM)",
    providerLabel: "Provider",
    responseLanguage: "Response language",
    modelLabel: "Model",
    ollamaAddress: "Ollama address",
    geminiKeyPlaceholder: "Gemini API key",
    providerOllama: "Ollama (local / offline)",
    hintAnthropic: "Key: the 'Anthropic API key' section above.",
    hintOpenai: "Key: the key in the 'Voice (OpenAI)' section below (shared).",
    hintGemini: "Key: the Gemini key here.",
    providerProxy: "Your own proxy (self-host)",
    proxyAddress: "Proxy address",
    proxyTokenPlaceholder: "Proxy token",
    proxyTest: "Test connection",
    proxyTesting: "Testing…",
    proxyOk: "Connected ✓ Models: {models}",
    proxyErrAuth: "The proxy rejected this token.",
    proxyErrUnreachable: "Can't reach the proxy. Check the address.",
    proxyErrTimeout: "The proxy didn't answer in time.",
    proxyErrNotConfigured: "Add the address and a token first (and PROXY_TOKENS on the proxy).",
    proxyErrStatus: "The proxy answered with an error ({status}).",
    proxyUrlInvalid: "Use an https:// address (http:// only for localhost).",
    hintProxy: "Your API keys stay on your own server (kiiri-proxy on Cloudflare, or any OpenAI-compatible endpoint). Kiiri only keeps the token. Models: kiiri-smart, kiiri-fast.",
    audioViaProxy: "Voice goes through your proxy — no OpenAI key needed here.",
    hintOllama: "Local/offline — no key needed. Ollama must be running with a vision model pulled (e.g. `ollama pull llama3.2-vision`).",
    autoDetect: "Detect content and suggest tasks",
    alwaysDrop: "Analyze on every drop",
    appContext: "App awareness (tell answers which app you're in)",
    appContextHint: "When on, screen answers know your frontmost app (name only, e.g. \"VS Code\") for sharper replies. macOS only; no extra permission.",
    triggerHint: "When off: hold <b>Option/Alt</b> and drop the cat → analysis starts.",
    voiceHeading: "Voice (OpenAI) — voice commands",
    voiceEnable: "Enable voice commands",
    transcribeModel: "Transcription model",
    fastCheap: "fast/cheap",
    better: "better",
    voiceHint: "When on, a 🎤 button appears next to the cat. Click → speak → the command runs (it stops automatically when you stop talking).",
    pttEnable: "Push-to-talk: ask about my screen",
    pttHotkey: "Push-to-talk hotkey",
    pttHint: "Hold the hotkey, ask out loud about what's on your screen, release — the cat looks at your screen (especially near where it sits) and answers, pointing with a 🐾 when helpful. Needs voice on + an OpenAI key.",
    ttsEnable: "Spoken answers (the cat reads them aloud)",
    ttsVoice: "Speaking voice",
    ttsHint: "Screen-question answers are also spoken. Uses OpenAI voices when a key is set; otherwise the built-in macOS voice for your language. Volume follows the notification-sound slider.",
    customTasksHeading: "Custom tasks",
    noCustomTasks: "No custom tasks yet.",
    taskNamePlaceholder: "Task name (e.g. Fix)",
    taskPromptPlaceholder: "What should the cat do? (e.g. Fix the typos in the image and return the clean text)",
    deepThink: "Use deep thinking (for math / logic)",
    addTask: "Add task",
    saveFailed: "Couldn't save: ",
    errorWord: "error",
  },
  tr: {
    windowTitle: "Kiri AI Asistan Ayarları",
    titlebar: "🐾 AI Asistan",
    close: "Kapat",
    enableAssistant: "AI Asistanı aç",
    profilesHeading: "Hızlı profiller",
    profilesHint: "Bir kip seç — sağlayıcı, ses ve sesli-yanıt ayarlarını birlikte değiştirir. Aşağıdan yine de ince ayar yapabilirsin.",
    profileLocalName: "Yerel",
    profileLocalDesc: "Çevrimdışı ve özel. Ollama beyni, yerleşik ses, bulut yok.",
    profileFastName: "Hızlı",
    profileFastDesc: "Çevik ve ucuz. Küçük bulut modeli, ses yok.",
    profileQualityName: "Kaliteli",
    profileQualityDesc: "En iyi yanıt + tam ses. OpenAI anahtarı gerekir.",
    styleHeading: "Yazım üslubu",
    stylePresetLabel: "Hızlı seçim:",
    styleHint: "Hazırladığım dosyalar ve görev sonuçları nasıl yazılsın. Kedinin kişiliği (nasıl konuştuğu) her karakter için ayrıca ayarlanır.",
    styleNotePlaceholder: "Eklemek istediğin bir şey var mı? (ör. okura \"siz\" diye hitap et, metrik birim kullan)",
    presetProfessional: "Profesyonel",
    presetFriendly: "Samimi",
    presetAcademic: "Akademik",
    presetPlain: "Sade",
    presetClear: "Temizle",
    tag_professional: "Profesyonel",
    tag_friendly: "Samimi",
    tag_warm: "Sıcak",
    tag_direct: "Doğrudan",
    tag_concise: "Kısa",
    tag_detailed: "Ayrıntılı",
    tag_formal: "Resmî",
    tag_plain: "Sade dil",
    tag_bullets: "Maddeli",
    tag_activeVoice: "Etken çatı",
    tag_noEmDash: "Uzun tire yok",
    tag_noEmoji: "Emoji yok",
    anthropicKeyHeading: "Anthropic API anahtarı",
    save: "Kaydet",
    remove: "Sil",
    noKey: "Anahtar yok",
    keySaved: "Anahtar kayıtlı ✓",
    encWarning: "⚠️ Bu cihazda güvenli depolama yok — anahtar yerel dosyada şifrelenmeden saklanır.",
    providerHeading: "Sağlayıcı (LLM)",
    providerLabel: "Sağlayıcı",
    responseLanguage: "Yanıt dili",
    modelLabel: "Model",
    ollamaAddress: "Ollama adresi",
    geminiKeyPlaceholder: "Gemini API anahtarı",
    providerOllama: "Ollama (yerel / offline)",
    hintAnthropic: "Anahtar: yukarıdaki 'Anthropic API anahtarı' bölümü.",
    hintOpenai: "Anahtar: aşağıdaki 'Ses (OpenAI)' bölümündeki anahtar (paylaşılır).",
    hintGemini: "Anahtar: buradaki Gemini anahtarı.",
    providerProxy: "Kendi proxy'n (self-host)",
    proxyAddress: "Proxy adresi",
    proxyTokenPlaceholder: "Proxy token'ı",
    proxyTest: "Bağlantıyı test et",
    proxyTesting: "Test ediliyor…",
    proxyOk: "Bağlandı ✓ Modeller: {models}",
    proxyErrAuth: "Proxy bu token'ı kabul etmedi.",
    proxyErrUnreachable: "Proxy'ye ulaşılamıyor. Adresi kontrol et.",
    proxyErrTimeout: "Proxy zamanında yanıt vermedi.",
    proxyErrNotConfigured: "Önce adresi ve token'ı gir (proxy'de de PROXY_TOKENS tanımlı olmalı).",
    proxyErrStatus: "Proxy hata döndürdü ({status}).",
    proxyUrlInvalid: "https:// ile başlayan bir adres kullan (http:// yalnızca localhost için).",
    hintProxy: "API anahtarların kendi sunucunda kalır (Cloudflare'de kiiri-proxy ya da OpenAI-uyumlu herhangi bir uç). Kiiri yalnızca token'ı saklar. Modeller: kiiri-smart, kiiri-fast.",
    audioViaProxy: "Ses de proxy'n üzerinden gider; burada OpenAI anahtarı gerekmez.",
    hintOllama: "Yerel/offline — anahtar gerekmez. Ollama çalışıyor olmalı ve bir vision modeli indirilmeli (ör. `ollama pull llama3.2-vision`).",
    autoDetect: "İçeriği algıla ve görev öner",
    alwaysDrop: "Her bırakışta analiz et",
    appContext: "Uygulama farkındalığı (yanıtlar hangi uygulamada olduğunu bilsin)",
    appContextHint: "Açıkken ekran yanıtları öndeki uygulamanı bilir (yalnızca ad, ör. \"VS Code\") ve daha isabetli olur. Yalnızca macOS; ek izin gerekmez.",
    triggerHint: "Kapalıyken: <b>Option/Alt</b> tuşunu basılı tutup kediyi bırak → analiz başlar.",
    voiceHeading: "Ses (OpenAI) — sesli komut",
    voiceEnable: "Sesli komutu aç",
    transcribeModel: "Transkripsiyon modeli",
    fastCheap: "hızlı/ucuz",
    better: "daha iyi",
    voiceHint: "Açıkken kedinin yanında 🎤 düğmesi belirir. Tıkla → konuş → komut çalışır (konuşmayı bırakınca otomatik durur).",
    pttEnable: "Bas-konuş: ekranımı sor",
    pttHotkey: "Bas-konuş kısayolu",
    pttHint: "Kısayolu basılı tut, ekranındaki şey hakkında sesli sor, bırak — kedi ekranına (özellikle durduğu yerin yakınına) bakıp yanıtlar, gerekince 🐾 ile gösterir. Ses açık + OpenAI anahtarı gerekir.",
    ttsEnable: "Sesli yanıt (kedi cevabı okur)",
    ttsVoice: "Konuşma sesi",
    ttsHint: "Ekran sorusu yanıtları sesli de okunur. OpenAI anahtarı varsa OpenAI sesleri, yoksa diline uygun yerleşik macOS sesi kullanılır. Ses düzeyi bildirim sesi ayarını izler.",
    customTasksHeading: "Özel görevler",
    noCustomTasks: "Henüz özel görev yok.",
    taskNamePlaceholder: "Görev adı (ör. Düzelt)",
    taskPromptPlaceholder: "Kediye ne yapmasını söyleyeyim? (ör. Görüntüdeki yazım hatalarını düzeltip temiz metni ver)",
    deepThink: "Derin düşünme kullan (matematik / mantık için)",
    addTask: "Görev ekle",
    saveFailed: "Kaydedilemedi: ",
    errorWord: "hata",
  },
  ko: {
    windowTitle: "Kiri AI 어시스턴트 설정",
    titlebar: "🐾 AI 어시스턴트",
    close: "닫기",
    enableAssistant: "AI 어시스턴트 켜기",
    profilesHeading: "빠른 프로필",
    profilesHint: "모드를 선택하면 제공자, 음성, 음성 답변 설정이 함께 바뀌어요. 아래에서 세부 조정도 가능해요.",
    profileLocalName: "로컬",
    profileLocalDesc: "오프라인 & 비공개. Ollama 두뇌, 내장 음성, 클라우드 없음.",
    profileFastName: "빠름",
    profileFastDesc: "빠르고 저렴. 작은 클라우드 모델, 음성 없음.",
    profileQualityName: "고품질",
    profileQualityDesc: "최고의 답변 + 전체 음성. OpenAI 키가 필요해요.",
    styleHeading: "글쓰기 스타일",
    stylePresetLabel: "빠른 선택:",
    styleHint: "내가 만드는 파일과 작업 결과가 어떻게 쓰일지 정해요. 고양이의 성격(말투)은 캐릭터마다 따로 설정해요.",
    styleNotePlaceholder: "더 원하는 게 있나요? (예: 독자를 \"당신\"이라고 부르기, 미터법 사용)",
    presetProfessional: "전문적",
    presetFriendly: "친근함",
    presetAcademic: "학술적",
    presetPlain: "쉬운 글",
    presetClear: "지우기",
    tag_professional: "전문적",
    tag_friendly: "친근함",
    tag_warm: "따뜻함",
    tag_direct: "직설적",
    tag_concise: "간결함",
    tag_detailed: "자세함",
    tag_formal: "격식체",
    tag_plain: "쉬운 말",
    tag_bullets: "글머리표",
    tag_activeVoice: "능동태",
    tag_noEmDash: "긴 대시 없음",
    tag_noEmoji: "이모지 없음",
    anthropicKeyHeading: "Anthropic API 키",
    save: "저장",
    remove: "삭제",
    noKey: "키 없음",
    keySaved: "키 저장됨 ✓",
    encWarning: "⚠️ 이 기기에는 보안 저장소가 없어요 — 키가 로컬 파일에 암호화 없이 저장됩니다.",
    providerHeading: "제공자 (LLM)",
    providerLabel: "제공자",
    responseLanguage: "응답 언어",
    modelLabel: "모델",
    ollamaAddress: "Ollama 주소",
    geminiKeyPlaceholder: "Gemini API 키",
    providerOllama: "Ollama (로컬 / 오프라인)",
    hintAnthropic: "키: 위의 'Anthropic API 키' 섹션.",
    hintOpenai: "키: 아래 '음성 (OpenAI)' 섹션의 키 (공유됨).",
    hintGemini: "키: 여기의 Gemini 키.",
    providerProxy: "내 프록시 (셀프 호스팅)",
    proxyAddress: "프록시 주소",
    proxyTokenPlaceholder: "프록시 토큰",
    proxyTest: "연결 테스트",
    proxyTesting: "테스트 중…",
    proxyOk: "연결됨 ✓ 모델: {models}",
    proxyErrAuth: "프록시가 이 토큰을 거부했어요.",
    proxyErrUnreachable: "프록시에 연결할 수 없어요. 주소를 확인해 주세요.",
    proxyErrTimeout: "프록시가 제때 응답하지 않았어요.",
    proxyErrNotConfigured: "먼저 주소와 토큰을 입력하세요 (프록시에도 PROXY_TOKENS가 필요해요).",
    proxyErrStatus: "프록시가 오류를 반환했어요 ({status}).",
    proxyUrlInvalid: "https:// 주소를 사용하세요 (http://는 localhost만).",
    hintProxy: "API 키는 내 서버에 남아요 (Cloudflare의 kiiri-proxy 또는 OpenAI 호환 엔드포인트). Kiiri는 토큰만 보관해요. 모델: kiiri-smart, kiiri-fast.",
    audioViaProxy: "음성도 프록시를 거쳐요. 여기에는 OpenAI 키가 필요 없어요.",
    hintOllama: "로컬/오프라인 — 키가 필요 없어요. Ollama가 실행 중이고 vision 모델이 설치되어 있어야 해요 (예: `ollama pull llama3.2-vision`).",
    autoDetect: "내용을 인식해 작업 추천",
    alwaysDrop: "떨어뜨릴 때마다 분석",
    appContext: "앱 인식 (답변이 현재 앱을 알도록)",
    appContextHint: "켜면 화면 답변이 최상위 앱(이름만, 예: \"VS Code\")을 알아 더 정확해져요. macOS 전용; 추가 권한 불필요.",
    triggerHint: "꺼져 있을 때: <b>Option/Alt</b> 키를 누른 채 고양이를 놓으면 → 분석이 시작돼요.",
    voiceHeading: "음성 (OpenAI) — 음성 명령",
    voiceEnable: "음성 명령 켜기",
    transcribeModel: "전사 모델",
    fastCheap: "빠름/저렴",
    better: "더 좋음",
    voiceHint: "켜면 고양이 옆에 🎤 버튼이 나타나요. 클릭 → 말하기 → 명령 실행 (말을 멈추면 자동으로 멈춰요).",
    pttEnable: "푸시투토크: 내 화면에 대해 묻기",
    pttHotkey: "푸시투토크 단축키",
    pttHint: "단축키를 누른 채 화면에 있는 것을 소리내어 묻고 놓으면, 고양이가 화면(특히 자기가 앉은 근처)을 보고 답하며 필요하면 🐾로 가리켜요. 음성 켜기 + OpenAI 키가 필요해요.",
    ttsEnable: "음성 답변 (고양이가 소리내어 읽어요)",
    ttsVoice: "말하는 목소리",
    ttsHint: "화면 질문의 답변을 소리로도 읽어줘요. OpenAI 키가 있으면 OpenAI 음성을, 없으면 언어에 맞는 macOS 내장 음성을 사용해요. 볼륨은 알림음 설정을 따라요.",
    customTasksHeading: "커스텀 작업",
    noCustomTasks: "아직 커스텀 작업이 없어요.",
    taskNamePlaceholder: "작업 이름 (예: 교정)",
    taskPromptPlaceholder: "고양이에게 뭘 시킬까요? (예: 이미지의 오타를 고쳐서 깔끔한 텍스트로 줘)",
    deepThink: "깊은 사고 사용 (수학 / 논리용)",
    addTask: "작업 추가",
    saveFailed: "저장 실패: ",
    errorWord: "오류",
  },
  ja: {
    windowTitle: "Kiri AI アシスタント設定",
    titlebar: "🐾 AI アシスタント",
    close: "閉じる",
    enableAssistant: "AI アシスタントをオン",
    profilesHeading: "クイックプロファイル",
    profilesHint: "モードを選ぶと、プロバイダー・音声・音声回答の設定がまとめて切り替わります。下で細かい調整もできます。",
    profileLocalName: "ローカル",
    profileLocalDesc: "オフライン & プライベート。Ollama の頭脳、内蔵音声、クラウドなし。",
    profileFastName: "高速",
    profileFastDesc: "軽快で低コスト。小さなクラウドモデル、音声なし。",
    profileQualityName: "高品質",
    profileQualityDesc: "最高の回答 + フル音声。OpenAI キーが必要です。",
    styleHeading: "文章スタイル",
    stylePresetLabel: "クイック選択:",
    styleHint: "私が作るファイルやタスク結果の書き方です。猫の性格（話し方）はキャラクターごとに別に設定します。",
    styleNotePlaceholder: "ほかに希望は？（例: 読み手を「あなた」と呼ぶ、メートル法を使う）",
    presetProfessional: "ビジネス",
    presetFriendly: "親しみやすく",
    presetAcademic: "学術的",
    presetPlain: "やさしく",
    presetClear: "クリア",
    tag_professional: "ビジネス",
    tag_friendly: "親しみやすい",
    tag_warm: "あたたかい",
    tag_direct: "率直",
    tag_concise: "簡潔",
    tag_detailed: "詳しく",
    tag_formal: "丁寧・格式",
    tag_plain: "やさしい言葉",
    tag_bullets: "箇条書き",
    tag_activeVoice: "能動態",
    tag_noEmDash: "ダッシュなし",
    tag_noEmoji: "絵文字なし",
    anthropicKeyHeading: "Anthropic API キー",
    save: "保存",
    remove: "削除",
    noKey: "キーなし",
    keySaved: "キー保存済み ✓",
    encWarning: "⚠️ このデバイスには安全なストレージがありません — キーはローカルファイルに暗号化なしで保存されます。",
    providerHeading: "プロバイダー (LLM)",
    providerLabel: "プロバイダー",
    responseLanguage: "応答言語",
    modelLabel: "モデル",
    ollamaAddress: "Ollama アドレス",
    geminiKeyPlaceholder: "Gemini API キー",
    providerOllama: "Ollama (ローカル / オフライン)",
    hintAnthropic: "キー: 上の「Anthropic API キー」セクション。",
    hintOpenai: "キー: 下の「音声 (OpenAI)」セクションのキー（共有）。",
    hintGemini: "キー: ここの Gemini キー。",
    providerProxy: "自分のプロキシ（セルフホスト）",
    proxyAddress: "プロキシのアドレス",
    proxyTokenPlaceholder: "プロキシのトークン",
    proxyTest: "接続をテスト",
    proxyTesting: "テスト中…",
    proxyOk: "接続しました ✓ モデル: {models}",
    proxyErrAuth: "プロキシがこのトークンを拒否しました。",
    proxyErrUnreachable: "プロキシに接続できません。アドレスを確認してください。",
    proxyErrTimeout: "プロキシが時間内に応答しませんでした。",
    proxyErrNotConfigured: "先にアドレスとトークンを入力してください（プロキシ側にも PROXY_TOKENS が必要です）。",
    proxyErrStatus: "プロキシがエラーを返しました（{status}）。",
    proxyUrlInvalid: "https:// のアドレスを使ってください（http:// は localhost のみ）。",
    hintProxy: "API キーは自分のサーバーに残ります（Cloudflare の kiiri-proxy、または OpenAI 互換のエンドポイント）。Kiiri はトークンだけを保存します。モデル: kiiri-smart、kiiri-fast。",
    audioViaProxy: "音声もプロキシ経由です。ここで OpenAI キーは不要です。",
    hintOllama: "ローカル/オフライン — キー不要。Ollama が起動していて vision モデルが必要です（例: `ollama pull llama3.2-vision`）。",
    autoDetect: "内容を検出してタスクを提案",
    alwaysDrop: "ドロップのたびに分析",
    appContext: "アプリ認識（回答が今どのアプリか把握）",
    appContextHint: "オンにすると画面回答が最前面のアプリ（名前のみ、例:\"VS Code\"）を把握し、より的確になります。macOS のみ; 追加権限不要。",
    triggerHint: "オフのとき: <b>Option/Alt</b> を押しながら猫をドロップ → 分析が始まります。",
    voiceHeading: "音声 (OpenAI) — 音声コマンド",
    voiceEnable: "音声コマンドをオン",
    transcribeModel: "文字起こしモデル",
    fastCheap: "速い/安い",
    better: "高精度",
    voiceHint: "オンにすると猫のそばに 🎤 ボタンが現れます。クリック → 話す → コマンド実行（話し終わると自動で止まります）。",
    pttEnable: "プッシュトゥトーク: 画面について聞く",
    pttHotkey: "プッシュトゥトークのキー",
    pttHint: "キーを押しながら画面のことを声で尋ね、離すと、猫が画面（特に自分のいる近く）を見て答え、必要なら 🐾 で指し示します。音声オン + OpenAI キーが必要です。",
    ttsEnable: "音声で答える（猫が読み上げます）",
    ttsVoice: "話す声",
    ttsHint: "画面質問の答えを声でも読み上げます。OpenAI キーがあれば OpenAI の声、なければ言語に合った macOS 内蔵の声を使います。音量は通知音の設定に従います。",
    customTasksHeading: "カスタムタスク",
    noCustomTasks: "カスタムタスクはまだありません。",
    taskNamePlaceholder: "タスク名（例: 修正）",
    taskPromptPlaceholder: "猫に何をさせる？（例: 画像の誤字を直してきれいなテキストを返して）",
    deepThink: "深い思考を使う（数学 / 論理向け）",
    addTask: "タスクを追加",
    saveFailed: "保存できませんでした: ",
    errorWord: "エラー",
  },
};

let lang = "en";
function L(key) {
  const table = I18N[lang] || I18N.en;
  return table[key] || I18N.en[key] || key;
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = L("windowTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = L(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", L(node.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => { node.setAttribute("placeholder", L(node.dataset.i18nPh)); });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = L(node.dataset.i18nHtml); });
}

function providerLabels() {
  return {
    anthropic: "Claude (Anthropic)",
    openai: "OpenAI (GPT-4o)",
    gemini: "Google Gemini",
    ollama: L("providerOllama"),
    proxy: L("providerProxy"),
  };
}
const MODEL_FIELD = {
  anthropic: "model",
  openai: "openaiModel",
  gemini: "geminiModel",
  ollama: "ollamaModel",
  proxy: "proxyModel",
};
const MODEL_SUGGESTIONS = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
  ollama: ["llama3.2-vision", "llava", "qwen2.5vl", "minicpm-v"],
  proxy: ["kiiri-smart", "kiiri-fast"],
};
const PROVIDER_HINT_KEY = {
  anthropic: "hintAnthropic",
  openai: "hintOpenai",
  gemini: "hintGemini",
  ollama: "hintOllama",
  proxy: "hintProxy",
};
const LANG_LABELS = { tr: "Türkçe", en: "English", ko: "한국어", ja: "日本語" };
function transcribeLabels() {
  return {
    "gpt-4o-mini-transcribe": `gpt-4o-mini-transcribe (${L("fastCheap")})`,
    "gpt-4o-transcribe": `gpt-4o-transcribe (${L("better")})`,
    "whisper-1": "whisper-1",
  };
}

// Quick-profile metadata: id → i18n keys for its name + one-line description.
const PROFILE_META = {
  local:   { name: "profileLocalName",   desc: "profileLocalDesc" },
  fast:    { name: "profileFastName",    desc: "profileFastDesc" },
  quality: { name: "profileQualityName", desc: "profileQualityDesc" },
};

const el = (id) => document.getElementById(id);
const enabled = el("enabled");
const profileButtonsEl = el("profile-buttons");
const apiKey = el("api-key");
const saveKey = el("save-key");
const clearKey = el("clear-key");
const keyStatus = el("key-status");
const encWarning = el("enc-warning");
const providerSel = el("provider");
const providerModel = el("provider-model");
const modelSuggestions = el("model-suggestions");
const ollamaBaseRow = el("ollama-base-row");
const ollamaBase = el("ollama-base");
const geminiKeyRow = el("gemini-key-row");
const geminiKeyEl = el("gemini-key");
const saveGeminiKey = el("save-gemini-key");
const clearGeminiKey = el("clear-gemini-key");
const geminiKeyStatus = el("gemini-key-status");
const providerHint = el("provider-hint");
const proxyRow = el("proxy-row");
const proxyBase = el("proxy-base");
const proxyTokenEl = el("proxy-token");
const saveProxyToken = el("save-proxy-token");
const clearProxyToken = el("clear-proxy-token");
const proxyTokenStatus = el("proxy-token-status");
const testProxyBtn = el("test-proxy");
const proxyTestStatus = el("proxy-test-status");
const audioViaProxyEl = el("audio-via-proxy");
// Models the last successful proxy test reported (feeds the model datalist).
let proxyModels = null;
const langSel = el("response-language");
const autoDetect = el("auto-detect");
const alwaysDrop = el("always-drop");
const appContextEl = el("app-context");
const customList = el("custom-list");
const customForm = el("custom-form");
const vEnabled = el("voice-enabled");
const openaiKeyEl = el("openai-key");
const saveOpenaiKey = el("save-openai-key");
const clearOpenaiKey = el("clear-openai-key");
const openaiKeyStatus = el("openai-key-status");
const transcribeModelEl = el("transcribe-model");
const pttEnabledEl = el("ptt-enabled");
const pttHotkeyEl = el("ptt-hotkey");
const ttsEnabledEl = el("tts-enabled");
const ttsVoiceEl = el("tts-voice");
const stylePresetsEl = el("style-presets");
const styleTagsEl = el("style-tags");
const styleNoteEl = el("style-note");

// Writing-style presets just set a tag combination (the tags are the truth).
const STYLE_PRESETS = [
  { id: "professional", label: "presetProfessional", tags: ["professional", "concise", "activeVoice"] },
  { id: "friendly", label: "presetFriendly", tags: ["friendly", "warm", "plain"] },
  { id: "academic", label: "presetAcademic", tags: ["formal", "detailed"] },
  { id: "plain", label: "presetPlain", tags: ["plain", "concise", "bullets"] },
  { id: "clear", label: "presetClear", tags: [] },
];

// OpenAI voice ids are proper names — shown capitalized, no translation.
const TTS_VOICE_LABELS = {
  alloy: "Alloy", nova: "Nova", shimmer: "Shimmer", echo: "Echo",
  onyx: "Onyx", fable: "Fable", coral: "Coral", sage: "Sage",
};

const PTT_HOTKEY_LABELS = {
  "ctrl+alt": "Ctrl + Alt",
  "ctrl+shift": "Ctrl + Shift",
  "alt+shift": "Alt + Shift",
  "cmd+alt": "Cmd + Alt",
};

let config = null;

function fillSelect(select, values, labels, current) {
  select.innerHTML = "";
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = (labels && labels[v]) || v;
    if (v === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderKeyStatus() {
  if (config.hasApiKey) {
    keyStatus.textContent = L("keySaved");
    keyStatus.classList.add("ok");
    clearKey.hidden = false;
  } else {
    keyStatus.textContent = L("noKey");
    keyStatus.classList.remove("ok");
    clearKey.hidden = true;
  }
  encWarning.hidden = !!config.encryptionAvailable;
}

function renderCustomTasks() {
  customList.innerHTML = "";
  const tasks = config.customTasks || [];
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "custom-empty";
    empty.textContent = L("noCustomTasks");
    customList.appendChild(empty);
    return;
  }
  for (const t of tasks) {
    const item = document.createElement("div");
    item.className = "custom-item";
    item.innerHTML = `
      <span class="ci-emoji"></span>
      <span class="ci-label"></span>
      <span class="ci-prompt"></span>
      <button type="button" class="ci-del">×</button>`;
    item.querySelector(".ci-del").setAttribute("aria-label", L("remove"));
    item.querySelector(".ci-emoji").textContent = t.emoji || "✨";
    item.querySelector(".ci-label").textContent = t.label;
    item.querySelector(".ci-prompt").textContent = t.prompt;
    item.querySelector(".ci-del").addEventListener("click", async () => {
      config = await window.aiAPI.customTaskDelete(t.id);
      renderCustomTasks();
    });
    customList.appendChild(item);
  }
}

function renderOpenAiStatus() {
  if (config.hasOpenAiKey) {
    openaiKeyStatus.textContent = L("keySaved");
    openaiKeyStatus.classList.add("ok");
    clearOpenaiKey.hidden = false;
  } else {
    openaiKeyStatus.textContent = L("noKey");
    openaiKeyStatus.classList.remove("ok");
    clearOpenaiKey.hidden = true;
  }
}

function renderGeminiStatus() {
  if (config.hasGeminiKey) {
    geminiKeyStatus.textContent = L("keySaved");
    geminiKeyStatus.classList.add("ok");
    clearGeminiKey.hidden = false;
  } else {
    geminiKeyStatus.textContent = L("noKey");
    geminiKeyStatus.classList.remove("ok");
    clearGeminiKey.hidden = true;
  }
}

function renderProxyStatus() {
  if (config.hasProxyToken) {
    proxyTokenStatus.textContent = L("keySaved");
    proxyTokenStatus.classList.add("ok");
    clearProxyToken.hidden = false;
  } else {
    proxyTokenStatus.textContent = L("noKey");
    proxyTokenStatus.classList.remove("ok");
    clearProxyToken.hidden = true;
  }
  if (audioViaProxyEl) audioViaProxyEl.hidden = config.audioVia !== "proxy";
}

function applyProviderUI() {
  const p = config.provider || "anthropic";
  providerModel.value = config[MODEL_FIELD[p]] || "";
  const suggestions = p === "proxy" && proxyModels && proxyModels.length ? proxyModels : MODEL_SUGGESTIONS[p];
  modelSuggestions.innerHTML = (suggestions || [])
    .map((m) => `<option value="${m}"></option>`)
    .join("");
  ollamaBaseRow.hidden = p !== "ollama";
  ollamaBase.value = config.ollamaBaseUrl || "";
  geminiKeyRow.hidden = p !== "gemini";
  proxyRow.hidden = p !== "proxy";
  if (document.activeElement !== proxyBase) proxyBase.value = config.proxyBaseUrl || "";
  renderProxyStatus();
  providerHint.textContent = PROVIDER_HINT_KEY[p] ? L(PROVIDER_HINT_KEY[p]) : "";
  renderGeminiStatus();
}

function renderProfiles() {
  if (!profileButtonsEl) return;
  profileButtonsEl.innerHTML = "";
  for (const id of config.profiles || []) {
    const meta = PROFILE_META[id];
    if (!meta) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profile-btn" + (config.activeProfile === id ? " active" : "");
    const name = document.createElement("span");
    name.className = "pb-name";
    name.textContent = L(meta.name);
    const desc = document.createElement("span");
    desc.className = "pb-desc";
    desc.textContent = L(meta.desc);
    btn.append(name, desc);
    btn.addEventListener("click", async () => {
      config = await window.aiAPI.profileApply(id);
      render();          // a profile touches provider/voice/tts — redraw everything
    });
    profileButtonsEl.appendChild(btn);
  }
}

function currentStyle() {
  const ws = (config && config.writingStyle) || {};
  return { tags: Array.isArray(ws.tags) ? ws.tags.slice() : [], note: ws.note || "" };
}

function renderWritingStyle() {
  if (!styleTagsEl) return;
  const style = currentStyle();
  stylePresetsEl.innerHTML = "";
  const label = document.createElement("span");
  label.className = "sp-label";
  label.textContent = L("stylePresetLabel");
  stylePresetsEl.appendChild(label);
  for (const preset of STYLE_PRESETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "style-preset";
    btn.textContent = L(preset.label);
    btn.addEventListener("click", async () => {
      await patch({ writingStyle: { ...currentStyle(), tags: preset.tags.slice() } });
      renderWritingStyle();
    });
    stylePresetsEl.appendChild(btn);
  }
  styleTagsEl.innerHTML = "";
  for (const tag of config.supportedWritingStyleTags || []) {
    const on = style.tags.includes(tag);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "style-tag" + (on ? " on" : "");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = L(`tag_${tag}`);
    btn.addEventListener("click", async () => {
      const cur = currentStyle();
      cur.tags = cur.tags.includes(tag) ? cur.tags.filter((t) => t !== tag) : [...cur.tags, tag];
      await patch({ writingStyle: cur });
      renderWritingStyle();
    });
    styleTagsEl.appendChild(btn);
  }
  if (document.activeElement !== styleNoteEl) styleNoteEl.value = style.note;
}

function render() {
  renderProfiles();
  renderWritingStyle();
  enabled.checked = config.enabled;
  autoDetect.checked = config.autoDetect;
  if (appContextEl) appContextEl.checked = config.appContextEnabled !== false;
  alwaysDrop.checked = config.alwaysAnalyzeOnDrop;
  fillSelect(providerSel, config.supportedProviders || [], providerLabels(), config.provider);
  fillSelect(langSel, config.supportedResponseLanguages || [], LANG_LABELS, config.responseLanguage);
  applyProviderUI();
  vEnabled.checked = config.voiceEnabled;
  fillSelect(transcribeModelEl, config.supportedTranscribeModels || [], transcribeLabels(), config.transcribeModel);
  if (pttEnabledEl) pttEnabledEl.checked = !!config.pttEnabled;
  if (pttHotkeyEl) fillSelect(pttHotkeyEl, config.supportedPttHotkeys || [], PTT_HOTKEY_LABELS, config.pttHotkey);
  if (ttsEnabledEl) ttsEnabledEl.checked = !!config.ttsEnabled;
  if (ttsVoiceEl) fillSelect(ttsVoiceEl, config.supportedTtsVoices || [], TTS_VOICE_LABELS, config.ttsVoice);
  renderKeyStatus();
  renderOpenAiStatus();
  renderCustomTasks();
}

async function patch(p) {
  config = await window.aiAPI.configSet(p);
}

enabled.addEventListener("change", () => patch({ enabled: enabled.checked }));
autoDetect.addEventListener("change", () => patch({ autoDetect: autoDetect.checked }));
alwaysDrop.addEventListener("change", () => patch({ alwaysAnalyzeOnDrop: alwaysDrop.checked }));
if (appContextEl) appContextEl.addEventListener("change", () => patch({ appContextEnabled: appContextEl.checked }));
if (styleNoteEl) styleNoteEl.addEventListener("change", () => patch({ writingStyle: { ...currentStyle(), note: styleNoteEl.value.trim() } }));
providerSel.addEventListener("change", async () => {
  await patch({ provider: providerSel.value });
  applyProviderUI();
});
providerModel.addEventListener("change", () => {
  const field = MODEL_FIELD[config.provider] || "model";
  patch({ [field]: providerModel.value.trim() });
});
ollamaBase.addEventListener("change", () => patch({ ollamaBaseUrl: ollamaBase.value.trim() }));
proxyBase.addEventListener("change", async () => {
  const value = proxyBase.value.trim();
  await patch({ proxyBaseUrl: value });
  // Main normalises (drops "/v1", trailing "/") and rejects non-https URLs.
  proxyBase.value = config.proxyBaseUrl || "";
  setProxyTestStatus(value && !config.proxyBaseUrl ? L("proxyUrlInvalid") : "", false);
  renderProxyStatus();
});
saveProxyToken.addEventListener("click", async () => {
  const value = proxyTokenEl.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setProxyToken(value);
  if (res && res.ok) {
    proxyTokenEl.value = "";
    config = await window.aiAPI.configGet();
    renderProxyStatus();
  } else {
    proxyTokenStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
  }
});
clearProxyToken.addEventListener("click", async () => {
  await window.aiAPI.clearProxyToken();
  config = await window.aiAPI.configGet();
  renderProxyStatus();
});
function setProxyTestStatus(text, ok) {
  proxyTestStatus.textContent = text;
  proxyTestStatus.classList.toggle("ok", !!ok);
}
const PROXY_ERRORS = { auth: "proxyErrAuth", unreachable: "proxyErrUnreachable", timeout: "proxyErrTimeout", not_configured: "proxyErrNotConfigured", status: "proxyErrStatus" };
testProxyBtn.addEventListener("click", async () => {
  testProxyBtn.disabled = true;
  setProxyTestStatus(L("proxyTesting"), false);
  try {
    const r = await window.aiAPI.proxyTest();
    if (r && r.ok) {
      proxyModels = r.models || [];
      setProxyTestStatus(L("proxyOk").replace("{models}", proxyModels.join(", ") || "—"), true);
      applyProviderUI();
    } else {
      const key = PROXY_ERRORS[r && r.reason] || "proxyErrUnreachable";
      setProxyTestStatus(L(key).replace("{status}", String((r && r.status) || "")), false);
    }
  } finally {
    testProxyBtn.disabled = false;
  }
});
saveGeminiKey.addEventListener("click", async () => {
  const value = geminiKeyEl.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setGeminiKey(value);
  if (res && res.ok) {
    geminiKeyEl.value = "";
    config = await window.aiAPI.configGet();
    renderGeminiStatus();
  } else {
    geminiKeyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
  }
});
clearGeminiKey.addEventListener("click", async () => {
  await window.aiAPI.clearGeminiKey();
  config = await window.aiAPI.configGet();
  renderGeminiStatus();
});
langSel.addEventListener("change", () => patch({ responseLanguage: langSel.value }));

saveKey.addEventListener("click", async () => {
  const value = apiKey.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setKey(value);
  if (res && res.ok) {
    apiKey.value = "";
    config = await window.aiAPI.configGet();
    renderKeyStatus();
  } else {
    keyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
  }
});

clearKey.addEventListener("click", async () => {
  await window.aiAPI.clearKey();
  config = await window.aiAPI.configGet();
  renderKeyStatus();
});

vEnabled.addEventListener("change", () => patch({ voiceEnabled: vEnabled.checked }));
transcribeModelEl.addEventListener("change", () => patch({ transcribeModel: transcribeModelEl.value }));
if (pttEnabledEl) pttEnabledEl.addEventListener("change", () => patch({ pttEnabled: pttEnabledEl.checked }));
if (pttHotkeyEl) pttHotkeyEl.addEventListener("change", () => patch({ pttHotkey: pttHotkeyEl.value }));
if (ttsEnabledEl) ttsEnabledEl.addEventListener("change", () => patch({ ttsEnabled: ttsEnabledEl.checked }));
if (ttsVoiceEl) ttsVoiceEl.addEventListener("change", () => patch({ ttsVoice: ttsVoiceEl.value }));

saveOpenaiKey.addEventListener("click", async () => {
  const value = openaiKeyEl.value.trim();
  if (!value) return;
  const res = await window.aiAPI.setOpenAiKey(value);
  if (res && res.ok) {
    openaiKeyEl.value = "";
    config = await window.aiAPI.configGet();
    renderOpenAiStatus();
  } else {
    openaiKeyStatus.textContent = L("saveFailed") + ((res && res.reason) || L("errorWord"));
  }
});

clearOpenaiKey.addEventListener("click", async () => {
  await window.aiAPI.clearOpenAiKey();
  config = await window.aiAPI.configGet();
  renderOpenAiStatus();
});

customForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = {
    emoji: el("ct-emoji").value.trim() || "✨",
    label: el("ct-label").value.trim(),
    prompt: el("ct-prompt").value.trim(),
    think: el("ct-think").checked,
  };
  if (!task.label || !task.prompt) return;
  config = await window.aiAPI.customTaskSave(task);
  el("ct-emoji").value = "";
  el("ct-label").value = "";
  el("ct-prompt").value = "";
  el("ct-think").checked = false;
  renderCustomTasks();
});

el("close-btn").addEventListener("click", () => window.aiAPI.closeSettings());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.aiAPI.closeSettings();
});

if (window.aiAPI.onLanguageChanged) {
  window.aiAPI.onLanguageChanged((language) => {
    if (I18N[language]) lang = language;
    applyI18n();
    if (config) render();
  });
}

(async () => {
  try {
    const language = await window.aiAPI.languageGet();
    if (I18N[language]) lang = language;
  } catch {}
  applyI18n();
  config = await window.aiAPI.configGet();
  render();
})();
