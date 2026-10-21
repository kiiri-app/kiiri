"use strict";

// Does a typed / spoken command mean "do this on my computer"? Kept small and
// explicit on purpose: a "/pc" prefix or a clear phrase routes to computer use;
// anything that reads like a file-generation request (slides, report, PDF…)
// stays with the command agent unless the user said "on my computer" outright.

const PREFIX_RE = /^\s*\/(pc|computer|bilgisayar|do|컴퓨터|パソコン)\b\s*/iu;

// Unambiguous: the user named their computer.
const EXPLICIT_RE = /\bon my (computer|mac|pc|laptop|desktop)\b|\bbilgisayar[ıi]mda\b|\bbilgisayarda yap|\bmac'?imde\b|\bpc'?mde\b|내 컴퓨터에서|컴퓨터에서 (해|실행)|パソコンで|コンピューターで|マックで/iu;

// Hands-on verbs: open-and-do, click, fill a form, rename files…
const ACTION_RE = /\b(open|launch) \S+(?: \S+)? (and|then)\b|\bclick\b|\bfill (in|out)?\s*(this|the)? ?form\b|\brename (these|the|my) files\b|\bgo to \S+\.(com|org|net|io|app)\b|\baç ve\b|\baçıp\b|\btıkla|\bformu doldur|\bdosyaları(n)? (adını|isimlerini) değiştir|\bsitesine gir|클릭|열고|열어서|양식을 채워|クリック|開いて|フォームに入力/iu;

// Clear file-generation asks → command agent (unless EXPLICIT/PREFIX).
const FILE_RE = /\b(slides?|deck|presentation|pptx?|powerpoint|docx?|word document|report|spreadsheet|excel|xlsx|csv|json|pdf)\b|sunum|slayt|rapor|belge|tablo|elektronik tablo|tutanak|슬라이드|발표|보고서|문서|스프레드시트|スライド|プレゼン|レポート|報告書|文書|スプレッドシート/iu;

// Returns { computer: boolean, text } — text has a routing prefix stripped.
function detectComputerIntent(raw) {
  const text = String(raw || "").trim();
  if (!text) return { computer: false, text };
  const m = text.match(PREFIX_RE);
  if (m) return { computer: true, text: text.slice(m[0].length).trim() };
  if (EXPLICIT_RE.test(text)) return { computer: true, text };
  if (FILE_RE.test(text)) return { computer: false, text };
  if (ACTION_RE.test(text)) return { computer: true, text };
  return { computer: false, text };
}

module.exports = { detectComputerIntent };
