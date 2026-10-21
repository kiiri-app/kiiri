"use strict";

// Starter skills seeded into the store on first run so the command window ships
// with something useful (instead of empty). Triggers include a few languages so
// matching works regardless of the seeded UI language; name + instruction are
// localized to the app language at seed time. The user owns them afterwards
// (edit / delete freely). Stable ids keep them recognizable.
//
// v2 ("job packs"): the document-shaped skills follow a source-fidelity
// discipline — owners/dates only when the source says them, otherwise a
// "[to confirm]" placeholder; tentative items kept apart from decisions; and
// some skills produce TWO files (a doc + a companion sheet). store.syncBundled
// upgrades unedited v1 copies in place (matched by LEGACY_HASHES).

const crypto = require("crypto");

// Shared multilingual triggers per skill id — union of common phrasings.
const TRIGGERS = {
  "report-table": ["rapor tablosu", "tablo yap", "report table", "make a table", "표 만들기", "レポート表", "テーブル作成"],
  "csv-data": ["csv", "csv oluştur", "csv verisi", "make csv", "csv 만들기", "csv 作成"],
  "meeting-notes": ["toplantı notu", "toplantı notları", "tutanak", "meeting notes", "meeting minutes", "회의록", "議事録", "ミーティングメモ"],
  "summary-doc": ["özet belge", "özet çıkar", "summary doc", "summarize to doc", "요약 문서", "要約ドキュメント"],
  "slide-deck": ["sunum", "slayt", "slide deck", "make slides", "presentation", "발표 자료", "スライド", "プレゼン"],
  "sop-doc": ["sop", "süreç belgesi", "prosedür", "process doc", "procedure", "업무 절차", "절차서", "手順書"],
  // ≤ 8 triggers (store cap); longer phrasings ("araştırma raporu", "research report") contain these.
  "research-report": ["araştır", "pdf rapor", "research", "pdf report", "조사해", "조사 보고서", "調べて", "調査レポート"],
};

// Per-language name + instruction for each starter skill.
const LOCALE = {
  tr: {
    "report-table": {
      name: "Rapor tablosu", emoji: "📊",
      instruction: "Kullanıcının verdiği konu ya da veriden düzenli bir tablo kur: uygun sütun başlıklarını belirle, satırları doldur ve create_xlsx ile kaydet. Sayısal değerleri sayı olarak ver. Kullanıcının vermediği rakamları uydurma; eksik hücreye [teyit edilecek] yaz.",
    },
    "csv-data": {
      name: "CSV verisi", emoji: "🗂",
      instruction: "İstenen veriyi taşınabilir bir CSV tablosuna dök: sütun başlıkları + satırlar belirle ve create_csv ile kaydet. Kullanıcının vermediği değerleri uydurma.",
    },
    "meeting-notes": {
      name: "Toplantı tutanağı", emoji: "📝",
      instruction: [
        "Kullanıcının verdiği toplantı dökümünü ya da notlarını tutanağa çevir ve İKİ dosya üret (iki aracı da çağır):",
        "1) create_docx — bölümler: Toplantı bilgileri (başlık, tarih, katılımcılar; metinde yoksa [teyit edilecek]); Kararlar (her biri tek cümle + kararı veren/onaylayan kişi + dayanak alıntı ya da zaman damgası); Aksiyonlar; Henüz karar verilmedi (\"muhtemelen\", \"bakarız\" gibi kesinleşmemiş konular ve neyi beklediği); Açık sorular; Kısa takip e-postası taslağı.",
        "2) create_xlsx — aksiyon tablosu, sütunlar: Aksiyon, Sorumlu, Tarih, Dayanak.",
        "Kurallar: Sorumlu ve tarihi YALNIZCA metinde açıkça söylendiyse yaz; yoksa [sorumlu teyit edilecek] / [tarih teyit edilecek]. Kararı ilk öneren kişiye değil onaylayan kişiye ata. Metinde olmayan hiçbir bilgi ekleme.",
      ].join("\n"),
    },
    "summary-doc": {
      name: "Özet belge", emoji: "📄",
      instruction: "Verilen metni kaynağa sadık bir özete indir ve create_docx ile kaydet. Bölümler: Tek cümlede özet; Ana noktalar (maddeli); Rakamlar ve tarihler (kaynaktaki gibi, aynen); Açık kalanlar. Kaynakta olmayan bilgi ekleme; kendi yorumunu ayrı bir \"Değerlendirme\" bölümünde ve yorum olduğunu belirterek ver.",
    },
    "slide-deck": {
      name: "Sunum taslağı", emoji: "🎞",
      instruction: "Verilen konudan 5-7 slaytlık bir sunum taslağı üret ve create_pptx ile kaydet. Her slayt başlığı konu adı değil, slaytın vardığı sonucu söyleyen tam bir cümle olsun (ör. \"Gelir\" değil \"Gelir ikinci çeyrekte %12 arttı\"); altına bu sonucu destekleyen kısa maddeler koy. Kullanıcının vermediği rakamları uydurma.",
    },
    "sop-doc": {
      name: "Süreç belgesi (SOP)", emoji: "🧭",
      instruction: [
        "Kullanıcının anlattığı ya da yapıştırdığı süreç anlatımını (kayıt dökümü, sesli not, adım listesi) bir SOP'ye çevir ve İKİ dosya üret (iki aracı da çağır):",
        "1) create_docx — bölümler: Amaç; Kim uygular; Gerekenler; Adımlar (yapıldığı sırayla, maddeli); Dallanmalar. Yalnızca anlatılanı yaz.",
        "2) create_xlsx — \"Örtük kararlar\" tablosu: anlatıcının kuralını söylemeden geçtiği her karar (\"duruma göre\", \"genelde\", \"anlarsın\", \"mantıklı olanı\" gibi) için bir satır. Sütunlar: Adım, Söylenen ifade (aynen alıntı), Sorulacak soru (tek cümlede yanıtlanabilir), Yanlış tahminin riski (Yüksek/Orta/Düşük). Riske göre sırala.",
      ].join("\n"),
    },
  },
  en: {
    "report-table": { name: "Report table", emoji: "📊", instruction: "Turn the given topic or data into a tidy table: choose sensible column headers, fill the rows, and save it with create_xlsx. Keep numeric values as numbers. Don't invent figures the user didn't give; put [to confirm] in missing cells." },
    "csv-data": { name: "CSV data", emoji: "🗂", instruction: "Put the requested data into a portable CSV table: define column headers + rows and save with create_csv. Don't invent values the user didn't give." },
    "meeting-notes": {
      name: "Meeting minutes", emoji: "📝",
      instruction: [
        "Turn the meeting transcript or notes the user gave into minutes and produce TWO files (call both tools):",
        "1) create_docx — sections: Meeting details (title, date, attendees; [to confirm] if not in the text); Decisions (one sentence each + who made/confirmed it + the supporting quote or timestamp); Action items; Not yet decided (tentative items like \"probably\", \"we'll see\" and what each waits on); Open questions; A short follow-up email draft.",
        "2) create_xlsx — action table with columns: Action, Owner, Due, Source.",
        "Rules: write an owner or date ONLY if the text explicitly says it; otherwise [owner to confirm] / [date to confirm]. Credit a decision to whoever confirmed it, not whoever first suggested it. Add nothing that isn't in the text.",
      ].join("\n"),
    },
    "summary-doc": { name: "Summary doc", emoji: "📄", instruction: "Condense the given text into a summary faithful to the source and save it with create_docx. Sections: One-line summary; Key points (bulleted); Figures and dates (exactly as in the source); Still open. Add nothing that isn't in the source; put your own interpretation in a separate \"Assessment\" section, marked as interpretation." },
    "slide-deck": { name: "Slide deck", emoji: "🎞", instruction: "Produce a 5-7 slide deck from the given topic, saved with create_pptx. Each slide title is a full sentence stating the slide's conclusion, not a topic label (e.g. not \"Revenue\" but \"Revenue grew 12% in Q2\"), followed by short bullets that support it. Don't invent figures the user didn't give." },
    "sop-doc": {
      name: "Process doc (SOP)", emoji: "🧭",
      instruction: [
        "Turn the process walkthrough the user described or pasted (recording transcript, voice note, step list) into an SOP and produce TWO files (call both tools):",
        "1) create_docx — sections: Purpose; Who performs it; What you need; Steps (in the order performed, bulleted); Branches. Write only what was described.",
        "2) create_xlsx — \"Unstated decisions\" sheet: one row for every judgement the speaker made without stating the rule (\"it depends\", \"usually\", \"you'll know\", \"whichever makes sense\"). Columns: Step, What they said (exact quote), Question to ask (answerable in one sentence), Risk if guessed wrong (High/Medium/Low). Sort by risk.",
      ].join("\n"),
    },
  },
  ko: {
    "report-table": { name: "보고 표", emoji: "📊", instruction: "주어진 주제나 데이터를 깔끔한 표로 만들어요: 적절한 열 머리글을 정하고 행을 채워 create_xlsx로 저장. 숫자 값은 숫자로. 사용자가 주지 않은 수치는 지어내지 말고 빈 칸에는 [확인 필요]를 적어요." },
    "csv-data": { name: "CSV 데이터", emoji: "🗂", instruction: "요청한 데이터를 이식성 좋은 CSV 표로: 열 머리글 + 행을 정해 create_csv로 저장. 사용자가 주지 않은 값은 지어내지 않아요." },
    "meeting-notes": {
      name: "회의록", emoji: "📝",
      instruction: [
        "사용자가 준 회의 녹취록이나 메모를 회의록으로 정리하고 파일 두 개를 만들어요(두 도구 모두 호출):",
        "1) create_docx — 섹션: 회의 정보(제목, 날짜, 참석자; 본문에 없으면 [확인 필요]); 결정 사항(각각 한 문장 + 결정/확정한 사람 + 근거 인용 또는 타임스탬프); 실행 항목; 미결정(\"아마\", \"검토해 볼게요\" 같은 잠정 사항과 무엇을 기다리는지); 열린 질문; 짧은 후속 이메일 초안.",
        "2) create_xlsx — 실행 항목 표, 열: 실행 항목, 담당자, 기한, 근거.",
        "규칙: 담당자와 기한은 본문에 명시된 경우에만 적고, 아니면 [담당자 확인 필요] / [기한 확인 필요]. 결정은 처음 제안한 사람이 아니라 확정한 사람에게 귀속해요. 본문에 없는 내용은 추가하지 않아요.",
      ].join("\n"),
    },
    "summary-doc": { name: "요약 문서", emoji: "📄", instruction: "주어진 텍스트를 원문에 충실한 요약으로 만들어 create_docx로 저장. 섹션: 한 문장 요약; 핵심 내용(불릿); 수치와 날짜(원문 그대로); 남은 과제. 원문에 없는 정보는 추가하지 말고, 자신의 해석은 별도의 \"평가\" 섹션에 해석임을 밝혀 적어요." },
    "slide-deck": { name: "슬라이드", emoji: "🎞", instruction: "주어진 주제로 5-7장 슬라이드 초안을 만들어 create_pptx로 저장. 각 슬라이드 제목은 주제명이 아니라 그 슬라이드의 결론을 말하는 완전한 문장으로(예: \"매출\"이 아니라 \"2분기 매출 12% 증가\"), 아래에 이를 뒷받침하는 짧은 불릿. 사용자가 주지 않은 수치는 지어내지 않아요." },
    "sop-doc": {
      name: "업무 절차서(SOP)", emoji: "🧭",
      instruction: [
        "사용자가 설명하거나 붙여 넣은 업무 과정(녹취록, 음성 메모, 단계 목록)을 SOP로 바꾸고 파일 두 개를 만들어요(두 도구 모두 호출):",
        "1) create_docx — 섹션: 목적; 수행자; 준비물; 단계(수행 순서대로, 불릿); 분기. 설명된 내용만 적어요.",
        "2) create_xlsx — \"암묵적 판단\" 표: 설명자가 규칙을 말하지 않고 넘어간 모든 판단(\"상황에 따라\", \"보통\", \"보면 알아요\", \"적당한 걸로\")마다 한 행. 열: 단계, 실제 표현(그대로 인용), 물어볼 질문(한 문장으로 답할 수 있게), 잘못 짐작할 때 위험(높음/중간/낮음). 위험 순으로 정렬.",
      ].join("\n"),
    },
  },
  ja: {
    "report-table": { name: "レポート表", emoji: "📊", instruction: "与えられたテーマやデータを整った表に: 適切な列見出しを決めて行を埋め、create_xlsx で保存。数値は数値のまま。ユーザーが示していない数値は作らず、欠けたセルには [要確認] と書く。" },
    "csv-data": { name: "CSV データ", emoji: "🗂", instruction: "要求されたデータを可搬な CSV 表に: 列見出しと行を決めて create_csv で保存。ユーザーが示していない値は作らない。" },
    "meeting-notes": {
      name: "議事録", emoji: "📝",
      instruction: [
        "ユーザーが渡した会議の書き起こしやメモを議事録にまとめ、ファイルを 2 つ作る（両方のツールを呼ぶ）:",
        "1) create_docx — セクション: 会議情報（タイトル・日付・参加者。本文になければ [要確認]）; 決定事項（各 1 文 + 決定・承認した人 + 根拠となる引用またはタイムスタンプ）; アクション項目; 未決定（「たぶん」「検討します」など暫定の事項と、何待ちか）; 未解決の質問; 短いフォローアップメールの下書き。",
        "2) create_xlsx — アクション表。列: アクション、担当者、期限、根拠。",
        "ルール: 担当者と期限は本文で明言された場合のみ書き、なければ [担当者要確認] / [期限要確認]。決定は最初に提案した人ではなく承認した人に帰属させる。本文にないことは追加しない。",
      ].join("\n"),
    },
    "summary-doc": { name: "要約ドキュメント", emoji: "📄", instruction: "与えられた文章を原文に忠実な要約にして create_docx で保存。セクション: 一文要約; 要点（箇条書き）; 数値と日付（原文どおり）; 未解決の点。原文にない情報は加えず、自分の解釈は別の「評価」セクションに解釈であると明記して書く。" },
    "slide-deck": { name: "スライド", emoji: "🎞", instruction: "与えられたテーマから 5〜7 枚のスライド草案を作り create_pptx で保存。各スライドのタイトルはトピック名ではなく、そのスライドの結論を述べる完全な文にする（例:「売上」ではなく「第2四半期の売上は12%増」）。その下に結論を支える短い箇条書き。ユーザーが示していない数値は作らない。" },
    "sop-doc": {
      name: "手順書（SOP）", emoji: "🧭",
      instruction: [
        "ユーザーが説明・貼り付けした業務の流れ（録画の書き起こし、音声メモ、手順リスト）を SOP にまとめ、ファイルを 2 つ作る（両方のツールを呼ぶ）:",
        "1) create_docx — セクション: 目的; 実施者; 必要なもの; 手順（実施順、箇条書き）; 分岐。説明された内容だけを書く。",
        "2) create_xlsx —「暗黙の判断」表: 話し手がルールを言わずに済ませた判断（「場合による」「だいたい」「見ればわかる」「適当なほう」など）ごとに 1 行。列: 手順、発言（そのまま引用）、確認する質問（一文で答えられる形）、推測を誤ったときのリスク（高/中/低）。リスク順に並べる。",
      ].join("\n"),
    },
  },
};

// v3: research → PDF. Web search is on when the provider allows it (see
// config.webSearchUsable); the instruction covers both cases honestly.
LOCALE.tr["research-report"] = {
  name: "Araştırma raporu (PDF)", emoji: "🔎",
  instruction: [
    "Kullanıcının verdiği konuyu araştır ve create_pdf ile bir PDF raporu üret.",
    "Web araması kullanabiliyorsan önce birkaç farklı kaynaktan güncel bilgiyi topla ve kullandığın sayfaları sources alanına ekle.",
    "Bölümler: Özet (3-4 cümle); Bulgular (maddeli, rakam ve tarihleriyle); Bağlam ve karşılaştırma; Sonuç ve öneriler; Belirsizlikler (kaynakların çeliştiği ya da bilginin eksik olduğu yerler).",
    "Kaynakta olmayan rakam ya da alıntı uydurma. Web erişimin yoksa raporun başında bilgilerin güncel olmayabileceğini ve hangi tarihe kadar olduğunu belirt.",
  ].join("\n"),
};
LOCALE.en["research-report"] = {
  name: "Research report (PDF)", emoji: "🔎",
  instruction: [
    "Research the topic the user gave and produce a PDF report with create_pdf.",
    "If you can use web search, first gather current information from a few different sources and list the pages you used in the sources field.",
    "Sections: Summary (3-4 sentences); Findings (bulleted, with figures and dates); Context and comparison; Conclusion and recommendations; Uncertainties (where sources disagree or information is missing).",
    "Don't invent figures or quotes that aren't in a source. If you have no web access, say at the top that the information may be out of date and up to when it runs.",
  ].join("\n"),
};
LOCALE.ko["research-report"] = {
  name: "조사 보고서 (PDF)", emoji: "🔎",
  instruction: [
    "사용자가 준 주제를 조사해 create_pdf로 PDF 보고서를 만들어요.",
    "웹 검색을 쓸 수 있으면 먼저 여러 출처에서 최신 정보를 모으고, 사용한 페이지를 sources 필드에 넣어요.",
    "섹션: 요약(3-4문장); 발견 사항(불릿, 수치와 날짜 포함); 맥락과 비교; 결론과 제안; 불확실한 점(출처가 엇갈리거나 정보가 부족한 곳).",
    "출처에 없는 수치나 인용은 만들지 마요. 웹 접근이 없으면 보고서 첫머리에 정보가 최신이 아닐 수 있고 언제까지의 정보인지 밝혀요.",
  ].join("\n"),
};
LOCALE.ja["research-report"] = {
  name: "調査レポート（PDF）", emoji: "🔎",
  instruction: [
    "ユーザーが示したテーマを調べ、create_pdf で PDF レポートを作成する。",
    "Web 検索が使えるなら、まず複数の情報源から最新情報を集め、使ったページを sources フィールドに入れる。",
    "セクション: 概要（3〜4文）; 調査結果（箇条書き、数値と日付つき）; 背景と比較; 結論と提案; 不確かな点（情報源が食い違う、または情報が足りない箇所）。",
    "情報源にない数値や引用は作らない。Web にアクセスできない場合は、冒頭で情報が最新でない可能性と、いつ時点の情報かを明記する。",
  ].join("\n"),
};

const TOOLS = {
  "report-table": ["create_xlsx"],
  "csv-data": ["create_csv"],
  "meeting-notes": ["create_docx", "create_xlsx"],
  "summary-doc": ["create_docx"],
  "slide-deck": ["create_pptx"],
  "sop-doc": ["create_docx", "create_xlsx"],
  "research-report": ["create_pdf"],
};

const ORDER = ["research-report", "meeting-notes", "sop-doc", "summary-doc", "report-table", "slide-deck", "csv-data"];

// Ids shipped by the first (v1) seed — an existing install that has no sync
// metadata yet was seeded with exactly these.
const V1_IDS = ["report-table", "csv-data", "meeting-notes", "summary-doc", "slide-deck"].map((k) => `bundled-${k}`);

// sha1(instruction).slice(0,16) of every v1 instruction in all four languages.
// A stored skill whose instruction hashes to one of these was never edited by
// the user, so it is safe to replace with the current version.
const LEGACY_HASHES = new Set([
  "434fbc14f55ecac9", "feaf6b4c17e156db", "46f903d85d327d09", "4e9a71c0385a03ed",
  "62ef80897b956910", "a5b74aab9fffdc21", "07aca30dda5ff2c5", "ec63e01b2882af2c",
  "ac4ef105272334ee", "0697c01ab43708a0", "a567e8a47ff99c5f", "e6e8f08825f6f886",
  "242826f0bcee093f", "407a45aeb51fbdf3", "20bc1135a1f0185d", "cecbd23af10dc447",
  "1eda0f9eac302210", "2450ccc5b9be10fa", "d56abfb5c8f1eeda", "5541e576a4b0571f",
]);

function instructionHash(text) {
  return crypto.createHash("sha1").update(String(text || "")).digest("hex").slice(0, 16);
}

// Build the starter skill list localized to `lang` (falls back to English).
function bundledSkills(lang) {
  const loc = LOCALE[lang] || LOCALE.en;
  return ORDER.map((key) => {
    const l = loc[key] || LOCALE.en[key];
    return {
      id: `bundled-${key}`,
      name: l.name,
      emoji: l.emoji,
      triggers: TRIGGERS[key],
      instruction: l.instruction,
      tools: TOOLS[key],
    };
  });
}

module.exports = { bundledSkills, instructionHash, LEGACY_HASHES, V1_IDS };
