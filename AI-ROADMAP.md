# Kiri AI — Genişleme Yol Haritası

Üç yeni özellik için araştırma + tasarım planı:

1. **Çoklu karakter desteği** — birden çok kedi/karakter
2. **Doğal-dilden agent şablonları** — "şunu söylediğimde sunum yapıp kaydet" → LLM bir
   yeniden-çalıştırılabilir skill üretir; komut gelince çalışır (Mentat'ın *Prompt-to-Plan*
   + *Show Me Once* deseni)
3. **Sesli dinleme modu** — kedide bir "dinle" düğmesi; tıkla → dinle → komutu anla → yap
   (Mentat'ın AssemblyAI'sı yerine **OpenAI Realtime**)

> Araştırma kaynakları: OpenAI Realtime/doc-gen (web), Mentat Swift kaynak desenleri,
> mevcut Kiri iç yapısı. Tarih: 2026-06.

## Durum (kilitlenen kararlar)

- **Faz A+B: ✅ UYGULANDI** — executor + onay + skill omurgası + `create_pptx`/`create_docx`/
  `write_file` + doğal-dilden skill yaz/kaydet/çalıştır. Bkz. `AI-ASSISTANT.md` → "Komut & Skiller".
- **Faz C (Ses, STT-only): ✅ UYGULANDI** — kedide 🎤 düğmesi → mikrofon kaydı → OpenAI
  transcription → metin → komut agent'ına yönlenir. OpenAI anahtarı yalnızca main'de.
  *Not:* v1 streaming Realtime yerine **`/v1/audio/transcriptions`** (gpt-4o-mini-transcribe)
  kullanır — tıkla-konuş-bırak (sessizlik VAD ile otomatik durma), canlı kısmi metin yok.
  Streaming Realtime (canlı partial + konuşan yanıt) bir P2 yükseltmesi; ses-yakalama katmanı
  o şekilde değiştirilebilir tasarlandı. Bkz. `AI-ASSISTANT.md` → "Sesli komut".
- **Faz D (Çoklu karakter): ✅ UYGULANDI** — bağımsız persona: her kedi kendi penceresi,
  adı, görünümü (renk), konumu ve kişiliği; skiller/AI ayarları ortak havuz. Kediye sağ tık →
  "➕ Kedi ekle / ➖ Kaldır / Kişilik ayarla". Etkileşim olan kedi (sürükle/sağ-tık/AI/ses)
  otomatik "aktif" olur; o kedinin adı+persona'sı AI yanıtlarına yansır. Bkz. `AI-ASSISTANT.md`
  → "Çoklu karakter".

---

## 0. Büyük resim — neyin eksik olduğu

Şu an Kiri AI katmanı **yalnızca okur**: kediyi bırak → vision → cevap balonu. Hiç
**aksiyon** yok (dosya yazma, sunum üretme). "Sunum yap ve kaydet" demek için Kiri'a
şu an olmayan bir katman gerekiyor — Mentat'ta var:

```
Girdi katmanı:   bırak-analiz (VAR) · sesli komut (YENİ) · metin
        ↓
Yönlendirici:    skill tetik eşleşmesi · vision görevi · genel soru
        ↓
Planlayıcı:      Claude tool-use → Aksiyon[]  (sıralı, şemalı)
        ↓
Denetim (YENİ):  Supervision Card — 3 katman onay + geri-al   [Mentat-lite]
        ↓
Executor'lar:    create_pptx · create_docx · create_pdf · write_file · web_research
                 (+ mevcut vision görevleri)
        ↓
Çıktı:           ~/Documents/Kiri/...  +  sonuç paneli  +  (ses) TTS
Skill deposu:    Doğal dil → kayıtlı skill/agent (tetik + plan + çıktı) → tekrar çalıştır
Karakterler:     N pet penceresi; her biri bir persona/skill'e bağlanabilir
```

**Sonuç:** Özellik 2 ve 3 ortak bir **executor + onay + skill omurgasına** dayanır. Bu
omurga bir kez kurulunca ses (Özellik 3) onun bir *girdi modu*, çoklu karakter (Özellik 1)
ise bir *UI çoğaltıcısı* olur. Bu yüzden önerilen sıra **omurga → şablonlar → ses →
çoklu karakter**.

---

## 1. Ortak omurga (Faz A) — Executor + Onay + Skill altyapısı

Mentat'tan **tasarımı** taşıyoruz (Swift kodu değil). Hepsi OS-bağımsız, JS'e birebir uyar.

### 1.1 Executor arabirimi (`ai/actions/executor.js`)

```js
// Her executor: tipini, onay seviyesini bilir; önizleme + çalıştır + geri-al verir.
class Executor {
  get type() { return "create_pptx"; }          // tool adı
  get approval() { return "localMutate"; }       // localMutate | external | irreversible
  get toolSchema() { return { name, description, input_schema }; }  // Claude'a verilir
  async preview(payload) { /* "PowerPoint: 5 slayt → ~/Documents/Kiri/sunumlar/x.pptx" */ }
  async execute(payload) { /* dosyayı yaz, sonucu döndür {path, undoToken} */ }
  async rollback(result) { /* dosyayı çöpe gönder (shell.trashItem) */ }
}
```

| Mentat → Kiri | Karşılık |
|---|---|
| `ActionExecutor` protokolü | `Executor` sınıfı (yukarıda) |
| `ExecutorRegistry` | `ai/actions/registry.js` — type→executor |
| `ApprovalLevel` (yeşil/kırmızı/mor) | `localMutate`/`external`/`irreversible` |
| `ApprovalStateMachine` | `ai/actions/approval.js` (durum makinesi) |
| `ActionLedger` (JSON) | `ai/actions/ledger.js` → `{userData}/action-ledger.json` |

### 1.2 İlk executor'lar (hepsi `localMutate` = yeşil, 30sn geri-al)

| Tool | Kütüphane (saf JS, native yok) | Çıktı klasörü |
|---|---|---|
| `create_pptx` | **pptxgenjs** v4 (sıfır bağımlılık) | `~/Documents/Kiri/sunumlar/` |
| `create_docx` | **docx** (dolanmiu) | `~/Documents/Kiri/belgeler/` |
| `create_pdf` | **pdfkit** veya Electron `webContents.printToPDF` | `~/Documents/Kiri/pdf/` |
| `write_file` | Node `fs` (md/txt/html) | `~/Documents/Kiri/dosyalar/` |
| `web_research` | (sonra) web arama + Claude özet | `~/Documents/Kiri/arastirma/` |

**Kırmızı çizgi (Mentat'tan):** Tüm yazma **yalnızca `~/Documents/Kiri/` altında**.
Path traversal (`../`) engellenir. `external`/`irreversible` katman MVP'de yok — sadece
yerel dosya. (İleride Notion/mail eklenirse Mentat'ın allow-list mantığı.)

### 1.3 Onay (Supervision Card)

- Mentat'ın durum makinesi: `idle → planning → reviewing → executing → completed`
  (+ `rollback`). MVP'de tek katman: **yeşil/30sn geri-al** (çöpe gönderme).
- UI: mevcut `ai-panel` penceresine **onay görünümü** eklenir — "Şunu yapacağım: … [Onayla]
  [İptal]" + tamamlanınca "[Geri al (30sn)]". (Yeni pencere gerekmez; panel zaten var.)

### 1.4 Planlayıcı (`ai/actions/planner.js`)

- Claude **tool-use** (function calling) — `claude-api` skill'i: araçlar
  `client.messages.create({ tools: [...] })` ile verilir, `stop_reason: "tool_use"` gelince
  executor çalıştırılır, `tool_result` geri gönderilir, döngü `end_turn`'e kadar.
- Mevcut `ai/claude.js`'i tool-use destekleyecek şekilde genişlet (yeni `callWithTools`).
- Sistem promptu Mentat'taki gibi: her executor için kurallar (dosya adı snake-case,
  klasör, onay tonu).

**Faz A çıktısı:** Kiri "bana X hakkında 5 slaytlık sunum yap" yazınca/duyunca →
planlar → onay → `.pptx` üretir → klasöre kaydeder → "Geri al" sunar. (Henüz "kaydet ve
sonra tekrar çalıştır" yok — o Faz B.)

---

## 2. Faz B — Doğal-dilden agent şablonları (sunum örneği)

Kullanıcının istediği: *"Sana 'şu konuda sunum yap' dediğimde sunum oluşturup klasöre
kaydet"* → bu **bir kez** tarif edilir, **kalıcı bir skill** olur, sonra komutla tekrar
çalışır. Bu Mentat'ın **SavedPlan/PlanStore** + **SkillPack** deseni.

### 2.1 Skill veri şekli (`ai/skills/skill.js` → `{userData}/skills/<id>.json`)

```js
{
  id: "sunum-yap",
  name: "Sunum yap",
  emoji: "📊",
  triggers: ["sunum yap", "bana sunum", "presentation"],   // ses/metin eşleşmesi
  params: [{ name: "konu", required: true, prompt: "Hangi konuda?" }],
  instruction: "Verilen konuda 5-7 slaytlık özet bir sunum hazırla.",
  outputs: [{ tool: "create_pptx", folder: "sunumlar" }],   // izinli executor'lar
  approval: "localMutate",
  createdAt: "..."
}
```

### 2.2 İki akış

**A) Skill yaratma (NL → skill):** Kullanıcı tarif eder ("…dediğimde sunum yapıp kaydet").
Claude bunu yukarıdaki şemaya çevirir (tek bir "skill yarat" tool-use çağrısı veya
structured output). Önizleme gösterilir → kullanıcı onaylar → `PlanStore.save`. Mentat'ın
*Prompt-to-Plan*'i (`SavedPlan`/`PlanStore`) birebir bu.

**B) Skill çalıştırma (komut → çıktı):** Kullanıcı "yapay zeka hakkında sunum yap" der →
yönlendirici `triggers` ile `sunum-yap` skill'ini bulur, `konu="yapay zeka"` çıkarır →
Planlayıcı skill.instruction + param ile `create_pptx` çağırır → onay → kaydet.

### 2.3 Skill yönetimi UI

- `ai-settings` penceresine **"Skiller / Agentlar"** sekmesi: liste + sil + (ileri) düzenle.
- Mentat'ın `PlanStepEditor`'ı = ileride sürükle-sırala adım editörü (P2).
- Mevcut "özel görev" (custom task) yapısı bunun hafif öncülü; skiller onun *aksiyon
  üretebilen* üst sürümü.

### 2.4 (Opsiyonel P2) Göstererek öğretme — *Show Me Once*

Mentat'ın `FlowRecorder` → `RecordedFlowSynthesizer` → SkillPack zinciri. Kiri'da
karşılığı: kullanıcı bir işi bir kez yapar (ekran/komut adımları), Kiri bunu skill'e
çevirir. Güçlü ama büyük; ilk sürümde **NL-tarif yeterli**, demonstration P2.

---

## 3. Faz C — Sesli dinleme (OpenAI Realtime)

### 3.1 Mimari karar (araştırmadan)

- **SDK:** `@openai/agents-realtime` (Agents SDK'nın realtime parçası), **renderer**'da
  **WebRTC** ile. WebRTC mikrofon yakalama + oynatmayı kendi halleder (manuel PCM yok).
- **Model:** `gpt-realtime` (GA, `gpt-realtime-2025-08-28`) ya da ucuz `gpt-realtime-mini`.
- **Güvenlik:** OpenAI **standart anahtarı yalnızca main process'te**. Main,
  `POST https://api.openai.com/v1/realtime/client_secrets` ile **ephemeral token** üretir,
  yalnızca token'ı IPC ile renderer'a verir. (Uyarı: standart anahtar yine de pakette
  bulunur — masaüstü uygulamalarda kaçınılmaz; ephemeral token blast-radius'u küçültür.)
- **VAD/sıra:** sunucu tarafı `turn_detection` (server_vad / semantic_vad) hazır.
- **Ses formatı:** pcm16 / 24kHz — WebRTC ile otomatik.

### 3.2 İki mod (karar gerek — aşağıda soru)

| Mod | Nasıl | Artı / Eksi |
|---|---|---|
| **STT-only** | transcription session (`gpt-4o-mini-transcribe`) → metin → **mevcut Claude omurgasına** ver | Ucuz; akıl yürütme Claude'da kalır; tek beyin (tutarlı). Konuşarak yanıt yok. |
| **Speech-to-speech** | `gpt-realtime` tool-use ile **doğrudan** executor'ları çağırır, sesli yanıtlar | En "Mentat" hissi (konuşur); ama akıl iki modele bölünür, daha pahalı, araçları OpenAI'a da tanıtmak gerekir |

**Öneri:** Başlangıçta **STT-only** — OpenAI sadece *kulak*, Claude *beyin*. Komut metni
mevcut yönlendiriciye (skill tetik / vision görevi / genel) gider. İleride konuşan yanıt
istenirse TTS eklenir ya da speech-to-speech'e geçilir.

### 3.3 Buton + akış

- Kedinin yanına **mic düğmesi** (mevcut `reminder-clock-button` deseni: HTML buton +
  click handler + `shouldReceiveMouseAt`'e ekle ki şeffaf pencereden tıklanabilsin).
- Tıkla → `getUserMedia({audio:true})` (renderer; share videoda zaten kullanılıyor) →
  Realtime oturumu → kullanıcı konuşur → transcript → `voice-command` IPC → main
  yönlendirici → (skill/vision/genel) → onay/sonuç. Tekrar tıkla → durdur.
- Kedi mevcut "düşünme" animasyonu + (ileri) ağız hareketi/dinleme rozeti.

### 3.4 Yönlendirici (`ai/router.js`)

Gelen komut metni → öncelik:
1. **Skill tetik** eşleşmesi (`triggers`) → skill çalıştır (Faz B).
2. "Ekranda ne var", "özetle" vb. → **vision görevi** (kedinin altını yakala — Faz mevcut).
3. Aksi halde → **genel soru** (Claude metin yanıtı, balonda).

---

## 4. Faz D — Çoklu karakter

### 4.1 Mevcut tekil varsayımlar (refactor noktaları)

`main.js`: `let petWin` tek singleton (`main.js:87`, `createPetWindow` `:1192`). Tüm
yayınlar (`pattern-changed`, `cursor-pos` 60Hz, `reminders-changed`, `ai-task-state`…)
tek pencereye gider. Pattern/konum/boyut/isim global (`currentPattern`, `currentPetPosition`,
`currentPetSize`, `catName`).

### 4.2 Plan

- `petWin` → `petWins = new Map<charId, win>`. `createPetWindow(charId)`.
- Karakter kaydı (`{userData}/characters.json`):
  ```js
  [{ id, name, pattern, position, size,
     persona,           // sistem promptuna eklenir
     skillIds: [...],   // bu karaktere bağlı skiller
     voice: true|false  // dinle düğmesi bu karakterde mi
  }]
  ```
- Yayınlar: tek `.send()` → tüm pencereler üzerinde döngü (her birine kendi
  `cursor-pos` offset'i ile).
- `uiohook` tek global kalır → tüm pencerelere broadcast.
- Pattern/preset sistemi karakter başına (her kedi farklı görünüm). `cell-mappings` ortak.
- Bağlam menüsü: "Karakter ekle / kaldır / bu karakterin ayarları".

### 4.3 Karakter ↔ skill bağlama (asıl güç)

Her karakter bir **persona + skill seti**: ör. "📊 Sunum Kedisi" sadece sunum skill'ini
çalıştırır; "🔍 Araştırma Kedisi" web_research yapar. Sesli komutta hangi kedi dinliyorsa
onun persona/skill'i devreye girer. Bu, çoklu karakteri özellik 2/3 ile birleştirir.

### 4.4 Kapsam kararı (soru — aşağıda)

- (A) **Görsel-çoklu:** birden çok kedi, **tek ortak AI/ayar**. En basit.
- (B) **Bağımsız persona:** her kedi kendi adı/görünümü + kendi persona.
- (C) **Karakter = agent:** her kedi belirli skill'lere bağlı (yukarıdaki güç). En zengin,
  en çok iş.

---

## 5. Yeni bağımlılıklar / anahtarlar

| Ne | Neden | Not |
|---|---|---|
| `@openai/agents-realtime` + `openai` | Ses (Realtime) | renderer, WebRTC |
| `pptxgenjs` | Sunum üret | saf JS |
| `docx` | Word üret | saf JS |
| `pdfkit` (veya printToPDF) | PDF | saf JS / Electron yerleşik |
| **OpenAI API anahtarı** | Realtime için (Anthropic'e ek) | main'de saklanır, ephemeral token'la kullanılır; `ai/config.js` safeStorage'a ikinci anahtar |

---

## 6. Önerilen sıra ve eforlar (kaba)

| Faz | İçerik | Bağımlı | Efor |
|---|---|---|---|
| **A** | Executor + onay + ledger + planner + `create_pptx`/`create_docx`/`write_file` | — | Büyük (omurga) |
| **B** | Skill deposu (NL→skill, çalıştır) + ayar sekmesi | A | Orta |
| **C** | Sesli dinleme (Realtime STT-only) + buton + yönlendirici | A (+B tetik için) | Orta-Büyük |
| **D** | Çoklu karakter (petWins refactor) + persona/skill bağlama | A/B | Büyük |

Kullanıcı çoklu karakteri ilk istedi; ama teknik bağımlılık zinciri **A→B→C→D**. D'yi öne
almak istenirse "görsel-çoklu" (4.4-A) hızlı yapılabilir, zengin C-varyantı sonraya kalır.

---

## 7. Riskler / dikkat

- **İki sağlayıcı, iki anahtar** (Anthropic + OpenAI) — ayar UX'i ve maliyet iletişimi.
- **Masaüstü anahtar gerçeği:** ne Anthropic ne OpenAI anahtarı pakette %100 gizli olamaz;
  ephemeral token + safeStorage en iyi pratik. Üretim için Mentat tarzı Worker proxy şart
  olursa ayrı iş.
- **Dosya yazma güvenliği:** sandbox `~/Documents/Kiri/`, path-traversal reddi, her
  yazımda onay + 30sn geri-al (çöp). Bu kırmızı çizgi gevşetilmez.
- **pptx kalitesi:** pptxgenjs gerçek düzenlenebilir OOXML üretir; Marp'ın pptx'i resimdir
  → pptxgenjs tercih.
- **Realtime model adları** taşınma halinde (`gpt-realtime` GA güvenli; `-2`/`-mini`/
  transcribe varyantları bağlantı anında canlı listeden doğrulanmalı).
- **Çoklu karakter performansı:** N şeffaf always-on-top pencere + 60Hz cursor + SVG fizik;
  3-4 karakterle test edilmeli.
