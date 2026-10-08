# Kiri AI Asistan (Mentat-tarzı mekânsal AI)

Kiri artık sadece bir masaüstü peti değil — kediyi ekrandaki bir içeriğin
üzerine **bıraktığında** o bölgeyi anlayan, komutla **özetleyen / soruyu çözen /
açıklayan / çeviren / metni çıkaran** bir AI asistanı. Tasarım, `mentat/`
projesinin desenlerinden (Claude vision, bağlam algılama, denetimli sonuç,
düz-metin yapılandırma, "ekran görüntüsü diske yazılmaz" gizlilik invariant'ı)
ilham alır; ama Mentat'ın push-to-talk + tüm-ekran yaklaşımı yerine **kedinin
konumunu işaretçi** olarak kullanır.

## Nasıl çalışır

```
Kediyi içeriğin üstüne sürükle
   └─(Option/Alt basılı bırak)─▶ main: kedinin altındaki ekran bölgesini yakala
                                   (kedi yakalama anında görünmez yapılır)
                                          │
                                   Claude vision: içeriği sınıflandır
                                   (yazı / soru / kod / tablo / görsel …)
                                          │
                                   Kedinin yanında görev menüsü:
                                   📝 Özetle  ✅ Soruyu çöz  💡 Açıkla
                                   🌐 Çevir   📋 Metni çıkar  ✨ Özel…
                                          │
                                   Seç ──▶ Claude vision görevi çalıştırır
                                          │
                                   Sonuç panelde (kaydır / Kopyala) +
                                   kedi "düşünme/tamamlandı" animasyonu
```

## Kullanım

1. Kediye sağ tıkla → **🐾 AI Asistan…** → açılan pencerede:
   - **AI Asistanı aç**
   - **Anthropic API anahtarını** gir (`sk-ant-…`) → Kaydet
   - (isteğe bağlı) Model, yanıt dili, özel görevler
2. Kediyi bir yazının/sorunun üzerine sürükle ve **Option/Alt** tuşunu basılı
   tutarak bırak. (Ayarlardan "Her bırakışta analiz et"i açarsan modifier
   gerekmez.)
3. Açılan menüden görevi seç. Önerilen görev sarı **Önerilen** rozetiyle gelir.

## Komut & Skiller (aksiyon üreten agent — Faz A+B)

Bırak-ve-anla **okur**; komut agent'ı **iş yapar**: dosya/sunum/belge üretip kaydeder.

Kediye sağ tıkla → **💬 Kiri'a komut ver…**

- **Komut sekmesi:** "yapay zeka hakkında 5 slaytlık sunum yap" yaz → Kiri planlar →
  **onay kartı** ("📊 PowerPoint — 'yapay zeka' (5 slayt) → Kiri/sunumlar/ [Onayla]
  [İptal]") → onayla → `.pptx` üretilir, kaydedilir → **[Klasörü aç]** / **[Geri al]** (çöp).
- **Skiller sekmesi:** *"Sana 'sunum yap' dediğimde verdiğim konuda PowerPoint oluştur ve
  kaydet"* diye tarif et → Claude bunu yeniden-çalıştırılabilir bir **skill**'e çevirir →
  kaydet. Sonra komut kutusunda "sunum yap …" yazınca skill tetik ile çalışır.

**Çıktılar yalnızca `~/Documents/Kiri/` altına yazılır** (sunumlar/ belgeler/ dosyalar/).
Path-traversal engellenir; her yazım **onay** ister ve **geri alınabilir** (çöpe gönderme).
Mevcut araçlar: `create_pptx` (pptxgenjs), `create_docx` (docx), `write_file` (md/txt/html).

Mimari: `ai/actions/` (executor + registry + planner + ledger + sandbox `paths.js`),
`ai/skills/` (store + NL→skill author + trigger router), `ai/agent.js` (orkestratör);
UI `renderer/ai-command.*`. Planlama Claude **tool-use** ile yapılır — içeriği Claude üretir,
executor deterministik olarak dosyaya render eder. Detaylı yol haritası: `AI-ROADMAP.md`.

## Sesli komut (STT-only — Faz C)

Mentat'ın push-to-talk + AssemblyAI'sının yerine: kedide **🎤 düğmesi**, OpenAI ile STT.
"OpenAI sadece kulak, Claude beyin" — ses metne çevrilir, sonra **aynı komut agent'ına**
(Faz A+B) gider.

**Açmak için:** sağ tık → 🐾 AI Asistan… → **"Ses (OpenAI)"** bölümü → "Sesli komutu aç" +
OpenAI anahtarını gir. Açıkken kedinin yanında 🎤 düğmesi belirir.

**Akış:** 🎤 tıkla → kedi "Dinliyorum…" (kırmızı nabız) → konuş → **konuşmayı bırakınca
otomatik durur** (sessizlik VAD; ayrıca 🎤'ya tekrar tıkla = durdur, 30sn üst sınır) →
main sesi OpenAI'a gönderir (`gpt-4o-mini-transcribe`) → metin → komut penceresi açılır ve
komutu otomatik çalıştırır (skill tetik / aksiyon planı / genel yanıt).

**Gizlilik/güvenlik:**
- **OpenAI anahtarı yalnızca main process'te** (ayrı `openai-key.bin`, safeStorage).
  Ses baytları renderer→main→OpenAI gider; anahtar renderer'a hiç geçmez.
- Mikrofon yalnızca düğmeye basınca açılır; sessizlikte ya da konuşma algılanmazsa
  hiçbir şey gönderilmez. macOS'ta `NSMicrophoneUsageDescription` + izin istemi.

**Mimari:** `ai/voice.js` (main — OpenAI transcription), pet `renderer.js` (mic + MediaRecorder
+ RMS sessizlik-VAD), `main.js` (`voice-audio`/`voice-config` IPC → `runVoiceTranscript` →
komut penceresi). AI ayarlarında ikinci anahtar + transkripsiyon modeli seçimi.

> v1 streaming Realtime değil, `/v1/audio/transcriptions` kullanır (robust, canlı partial yok).
> Streaming Realtime + konuşan yanıt = P2; bkz. `AI-ROADMAP.md`.

## Karakter görünümü

> **2026-10 itibarıyla kaldırıldı:** klasik "rigli" piksel kedi ve parametrik sprite
> karakterler (Kedibüs / Papyonlu Kedi / Orman Ruhu). Tek yerleşik karakter türü
> kiri/tori pose-set'leridir (`art/src/` → `scripts/build-pose-sheets.py` →
> `svg/<set>_<durum>.png` + `renderer/pose-manifest.js`); eski kayıtlar açılışta
> kiri'ye dönüştürülür (`characters.js`). Topluluk petdex sayfaları da desteklenir.

## Çoklu karakter (bağımsız persona — Faz D)

Birden çok kedi, her biri **kendi adı, görünümü (rengi), konumu ve kişiliği (persona)** ile.
Skiller ve AI ayarları **ortak havuzdur** (tüm kediler paylaşır).

**Yönetim** — kediye sağ tık:
- **➕ Kedi ekle** — yeni bir kedi (farklı renk + ofsetli konum) açılır.
- **Kişilik ayarla…** — bu kediye bir persona ver (ör. "neşeli ve özlü bir hoca").
  Persona, o kedi bir AI işi yaptığında (bırak/ses/komut) sistem promptuna eklenir.
- **➖ Kediyi kaldır** — (en az bir kedi kalır).
- "Set Kiri name" / desen editörü artık **o kediye** özeldir.

**Nasıl çalışır (mimari):** Her kedi pencere aynı `renderer`'ı çalıştırır; `main.js` her
pencereye kendi durumunu (desen/isim/konum) yönlendirir. Etkileşim gelen IPC'lerde
(`drag`/`show-context-menu`/`ai-trigger-drop`/`voice-audio`) gönderen pencere → karakter
eşlenir ve **o karakter "aktif"** yapılır; böylece mevcut tekil-kedi mantığı doğru kediye
uygulanır ve o kedinin adı+persona'sı AI'a geçer. Paylaşılan durum (hatırlatıcı, pomodoro,
dil, isim çağrısı, ses-config, yazı/tekerlek tepkileri) tüm pencerelere yayınlanır.
Kayıt: `characters.js` → `{userData}/characters.json` (eski tek-kediden otomatik migrasyon).
İmleç takibi tüm kediler için (her pencere kendi ofsetiyle).

## Bilgi Defteri + SM-2 aralıklı tekrar

Kedi sana çözdürdüğü/açıkladığı şeyleri **flashcard** olarak deftere yazabilir ve
**SM-2 (SuperMemo-2)** algoritmasıyla doğru aralıklarla seni sınar — öğrenmeyi pekiştirir.
(Clicky-Windows fork'unda var; Mentat/orijinal Clicky'de yok.)

- **Kart ekleme:** Bir AI sonucu (özet/çözüm/açıklama) panelinde **"📚 Deftere ekle"** →
  LLM o içerikten kısa bir soru-cevap kartı üretir ve kaydeder. Ayrıca defterin **"Ekle"**
  sekmesinden elle kart eklenir.
- **Tekrar:** Sağ tık → **📚 Bilgi Defteri…** → "Tekrar" sekmesi tekrar zamanı gelen kartları
  tek tek gösterir: soru → "Cevabı göster" → **Tekrar / Zor / İyi / Kolay** ile kendini
  derecelendir. SM-2 bir sonraki tekrar tarihini hesaplar (1 → 6 → 15… gün; yanlışta sıfırlar).
- **Proaktif hatırlatma:** tekrar zamanı gelen kart varsa kedi sessizce **"📚 N kart tekrar
  zamanı"** balonu gösterir (en çok 4 saatte bir). Bağlam menüsünde de tekrar sayısı rozeti.

**Mimari:** `ai/journal/sm2.js` (saf algoritma), `ai/journal/store.js`
(`{userData}/ai-journal.json` + zamanlama), `ai/journal/cardgen.js` (içerik→kart, aktif
sağlayıcı ile). UI `renderer/ai-journal.*` (Tekrar / Kartlar / Ekle). Kart üretimi tüm
sağlayıcılarla çalışır (Ollama dahil, yerel/ücretsiz).

## Çok sağlayıcı + Ollama (yerel/offline)

AI artık tek sağlayıcıya kilitli değil. Sağ tık → 🐾 AI Asistan… → **"Sağlayıcı (LLM)"**:

| Sağlayıcı | Model (örnek) | Anahtar | Not |
|---|---|---|---|
| **Claude** (Anthropic) | claude-opus-4-8 | Anthropic anahtarı (üst bölüm) | Varsayılan |
| **OpenAI** | gpt-4o | OpenAI anahtarı (**Ses bölümüyle paylaşılır**) | — |
| **Gemini** (Google) | gemini-2.0-flash | Gemini anahtarı (sağlayıcı bölümünde) | OpenAI-uyumlu endpoint |
| **Ollama** (yerel) | llama3.2-vision | **Yok** | **Offline, $0** — `ollama pull llama3.2-vision` |

Tüm AI işleri (bırak-ve-anla vision, soru çöz, komut planlama/tool-use, skill yazımı) seçili
sağlayıcıya gider. **Ollama ile her şey yerel ve ücretsiz** çalışır (gizlilik + maliyet).

**Mimari:** `ai/llm.js` bir **dispatcher** — `config.resolveProvider()` ile aktif sağlayıcıyı
çözer ve çağrıyı yönlendirir. OpenAI/Gemini/Ollama hepsi **OpenAI Chat Completions** formatını
paylaştığı için tek `ai/providers/openai-compat.js` (fetch tabanlı, ekstra bağımlılık yok)
üçünü de karşılar; Anthropic kendi SDK'sıyla (`ai/claude.js`). Çağıranlar (assistant/planner/
author) sadece `llm.callVision`/`llm.callWithTools` kullanır — anahtar/model'i config çözer.
Anahtarlar ayrı şifreli dosyalarda (`ai-key.bin` / `openai-key.bin` / `gemini-key.bin`, safeStorage).

> Not: Ollama tool-use (komut→aksiyon planlama) modelin yeteneğine bağlıdır; küçük yerel
> modeller fonksiyon-çağrısını desteklemeyebilir. Vision Q&A (özetle/çöz/açıkla) vision
> modellerinde (llama3.2-vision, llava…) çalışır.

## Mimari

| Dosya | Görev |
|---|---|
| `ai/config.js` | Yapılandırma (`ai-config.json`) + **safeStorage** ile şifreli API anahtarı (`ai-key.bin`). Anahtar asla renderer'a gitmez. |
| `ai/prompts.js` | Sistem promptu + sınıflandırma + görev promptları (dile göre) |
| `ai/tasks.js` | Yerleşik görev kayıtları + özel görev birleştirme/çözümleme |
| `ai/claude.js` | `@anthropic-ai/sdk` vision sarmalayıcı (model varsayılanı `claude-opus-4-8`; düşünme gereken görevlerde `thinking: {type:"adaptive"}`; tiplenmiş hata eşleme) |
| `ai/capture.js` | Kedinin altındaki bölgeyi yakalar; kediyi geçici görünmez yapar; ≤1568px'e küçültür; **yalnızca bellekte** |
| `ai/assistant.js` | Orkestratör: yakala → (sınıflandır) → menü verisi; görev çalıştır; bellekte yakalama önbelleği (5 dk TTL) + iptal |
| `renderer/ai-panel.*` | Görev menüsü + sonuç paneli (ayrı, bağımsız etkileşimli pencere) |
| `renderer/ai-settings.*` | AI ayar penceresi (anahtar/model/dil/görevler) |
| `renderer/ai-preload.js` | AI pencereleri için `aiAPI` köprüsü |

`main.js` bunları IPC ile bağlar (`ai-trigger-drop`, `ai-run-task`,
`ai-config-*`, `ai-set-key`, `ai-custom-task-*`, …) ve pencereleri yönetir.
Pet penceresinin hassas sürükleme/fizik mantığına dokunulmaz — AI etkileşimi
ayrı pencerelerde yaşar; pet yalnızca tetikleyiciyi gönderir ve mevcut
"düşünme/tamamlandı" animasyonlarını oynatır.

## Gizlilik

- **Ekran görüntüleri diske yazılmaz** — yalnızca bellekte tutulur (5 dk TTL).
- **API anahtarı** macOS Keychain / Windows DPAPI / Linux libsecret üzerinden
  (Electron `safeStorage`) şifrelenir; güvenli depolama yoksa uyarı gösterilir.
- Anahtar yalnızca **main process** tarafından okunur; renderer'a hiç geçmez.
- AI varsayılan olarak **kapalıdır**; açıkken yalnızca sen bıraktığında çalışır.

## Notlar / sonraki adımlar

- Yakalama bölgesi kedinin merkezine göre sabit boyuttadır (ayarlardaki
  `captureWidth/Height` ile değişebilir). İleride "kedinin altındaki pencereyi"
  pencere yöneticisi API'leriyle tam algılamak P2 işi.
- Üretim için anahtarı istemciden tamamen çıkarmak istersen `ai/claude.js`'i
  bir proxy (Mentat'ın Cloudflare Worker'ı gibi) üzerinden çağıracak şekilde
  değiştir — istek şekli aynı kalır.
