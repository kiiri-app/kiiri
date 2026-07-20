"use strict";

// Starter skills seeded into the store on first run so the command window ships
// with something useful (instead of empty). Triggers include a few languages so
// matching works regardless of the seeded UI language; name + instruction are
// localized to the app language at seed time. The user owns them afterwards
// (edit / delete freely). Stable ids keep them recognizable.

// Shared multilingual triggers per skill id — union of common phrasings.
const TRIGGERS = {
  "report-table": ["rapor tablosu", "tablo yap", "report table", "make a table", "표 만들기", "レポート表", "テーブル作成"],
  "csv-data": ["csv", "csv oluştur", "csv verisi", "make csv", "csv 만들기", "csv 作成"],
  "meeting-notes": ["toplantı notu", "toplantı notları", "meeting notes", "회의록", "議事録", "ミーティングメモ"],
  "summary-doc": ["özet belge", "özet çıkar", "summary doc", "summarize to doc", "요약 문서", "要約ドキュメント"],
  "slide-deck": ["sunum", "sunum taslağı", "slayt", "slide deck", "make slides", "presentation", "발표 자료", "スライド", "プレゼン"],
};

// Per-language name + instruction for each starter skill.
const LOCALE = {
  tr: {
    "report-table": {
      name: "Rapor tablosu", emoji: "📊",
      instruction: "Kullanıcının verdiği konu ya da veriden düzenli bir tablo kur: uygun sütun başlıklarını belirle, satırları doldur ve create_xlsx ile kaydet. Sayısal değerleri sayı olarak ver.",
    },
    "csv-data": {
      name: "CSV verisi", emoji: "🗂",
      instruction: "İstenen veriyi taşınabilir bir CSV tablosuna dök: sütun başlıkları + satırlar belirle ve create_csv ile kaydet.",
    },
    "meeting-notes": {
      name: "Toplantı notu", emoji: "📝",
      instruction: "Kullanıcının anlattığı toplantıyı düzenli bir nota çevir: başlık, katılımcılar, kararlar, aksiyon maddeleri bölümleriyle create_docx ile bir Word belgesi oluştur.",
    },
    "summary-doc": {
      name: "Özet belge", emoji: "📄",
      instruction: "Verilen metni ya da konuyu kısa, maddeli bir özete indir ve create_docx ile bir belge olarak kaydet. Giriş, ana noktalar ve sonuç bölümleri kullan.",
    },
    "slide-deck": {
      name: "Sunum taslağı", emoji: "📊",
      instruction: "Verilen konudan 5-7 slaytlık bir sunum taslağı üret: her slayta başlık ve kısa maddeler koy, create_pptx ile kaydet.",
    },
  },
  en: {
    "report-table": { name: "Report table", emoji: "📊", instruction: "Turn the given topic or data into a tidy table: choose sensible column headers, fill the rows, and save it with create_xlsx. Keep numeric values as numbers." },
    "csv-data": { name: "CSV data", emoji: "🗂", instruction: "Put the requested data into a portable CSV table: define column headers + rows and save with create_csv." },
    "meeting-notes": { name: "Meeting notes", emoji: "📝", instruction: "Turn the described meeting into tidy notes: create a Word doc with create_docx containing title, attendees, decisions, and action items." },
    "summary-doc": { name: "Summary doc", emoji: "📄", instruction: "Condense the given text or topic into a short, bulleted summary and save it as a document with create_docx. Use intro, key points, conclusion." },
    "slide-deck": { name: "Slide deck", emoji: "📊", instruction: "Produce a 5-7 slide deck from the given topic: a title and short bullets per slide, saved with create_pptx." },
  },
  ko: {
    "report-table": { name: "보고 표", emoji: "📊", instruction: "주어진 주제나 데이터를 깔끔한 표로 만들어요: 적절한 열 머리글을 정하고 행을 채워 create_xlsx로 저장. 숫자 값은 숫자로." },
    "csv-data": { name: "CSV 데이터", emoji: "🗂", instruction: "요청한 데이터를 이식성 좋은 CSV 표로: 열 머리글 + 행을 정해 create_csv로 저장." },
    "meeting-notes": { name: "회의록", emoji: "📝", instruction: "설명한 회의를 깔끔한 노트로: 제목, 참석자, 결정 사항, 실행 항목을 담아 create_docx로 Word 문서 생성." },
    "summary-doc": { name: "요약 문서", emoji: "📄", instruction: "주어진 텍스트나 주제를 짧은 불릿 요약으로 만들어 create_docx로 문서 저장. 도입·핵심·결론 사용." },
    "slide-deck": { name: "슬라이드", emoji: "📊", instruction: "주어진 주제로 5-7장 슬라이드 초안: 각 장에 제목과 짧은 불릿, create_pptx로 저장." },
  },
  ja: {
    "report-table": { name: "レポート表", emoji: "📊", instruction: "与えられたテーマやデータを整った表に: 適切な列見出しを決めて行を埋め、create_xlsx で保存。数値は数値のまま。" },
    "csv-data": { name: "CSV データ", emoji: "🗂", instruction: "要求されたデータを可搬な CSV 表に: 列見出しと行を決めて create_csv で保存。" },
    "meeting-notes": { name: "議事録", emoji: "📝", instruction: "説明された会議を整ったメモに: タイトル・参加者・決定事項・アクション項目を含む Word 文書を create_docx で作成。" },
    "summary-doc": { name: "要約ドキュメント", emoji: "📄", instruction: "与えられた文章やテーマを短い箇条書きの要約にして create_docx で文書保存。導入・要点・結論を使う。" },
    "slide-deck": { name: "スライド", emoji: "📊", instruction: "与えられたテーマから 5〜7 枚のスライド草案: 各スライドにタイトルと短い箇条書き、create_pptx で保存。" },
  },
};

const TOOLS = {
  "report-table": ["create_xlsx"],
  "csv-data": ["create_csv"],
  "meeting-notes": ["create_docx"],
  "summary-doc": ["create_docx"],
  "slide-deck": ["create_pptx"],
};

const ORDER = ["report-table", "csv-data", "meeting-notes", "summary-doc", "slide-deck"];

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

module.exports = { bundledSkills };
