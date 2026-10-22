"use strict";

// create_pdf — renders Claude-authored content to a real PDF. Pure HTML first
// (renderPdfHtml, testable), then Electron's own printToPDF in a hidden,
// script-free window: no PDF library needed.

const { Executor } = require("../executor");
const { t } = require("../../i18n");

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Only http(s) links become clickable; anything else is shown as plain text.
const safeUrl = (u) => (/^https?:\/\/[^\s"<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");

// payload: { title, subtitle?, sections: [{ heading, paragraphs: [string] }], sources?: [{ title, url }] }
function renderPdfHtml(payload, { lang = "tr" } = {}) {
  const title = String((payload && payload.title) || "Rapor");
  const subtitle = payload && payload.subtitle ? String(payload.subtitle) : "";
  const sections = Array.isArray(payload && payload.sections) ? payload.sections : [];
  const sources = Array.isArray(payload && payload.sources) ? payload.sources : [];
  const sourcesHeading = { tr: "Kaynaklar", en: "Sources", ko: "출처", ja: "出典" }[lang] || "Sources";

  const body = [];
  for (const sec of sections) {
    if (sec && sec.heading) body.push(`<h2>${esc(sec.heading)}</h2>`);
    let list = [];
    const flush = () => { if (list.length) { body.push(`<ul>${list.join("")}</ul>`); list = []; } };
    for (const p of Array.isArray(sec && sec.paragraphs) ? sec.paragraphs : []) {
      const line = String(p || "");
      const bullet = /^\s*[-•*]\s+/.exec(line);
      if (bullet) list.push(`<li>${esc(line.slice(bullet[0].length))}</li>`);
      else { flush(); if (line.trim()) body.push(`<p>${esc(line)}</p>`); }
    }
    flush();
  }
  if (sources.length) {
    body.push(`<h2>${esc(sourcesHeading)}</h2><ol class="sources">`);
    for (const s of sources) {
      const url = safeUrl(s && s.url);
      const label = esc((s && s.title) || url || "");
      body.push(url ? `<li><a href="${esc(url)}">${label}</a><br><span class="url">${esc(url)}</span></li>` : `<li>${label}</li>`);
    }
    body.push(`</ol>`);
  }

  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${esc(title)}</title><style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font: 11pt/1.55 -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #2A2522; }
  h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 4pt; }
  .sub { color: #6b625c; margin: 0 0 18pt; }
  h2 { font-size: 13.5pt; margin: 18pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #e6dccd; }
  p { margin: 0 0 7pt; } ul, ol { margin: 0 0 8pt; padding-left: 18pt; } li { margin: 0 0 3pt; }
  a { color: #b4502e; text-decoration: none; } .url { color: #8a817a; font-size: 8.5pt; word-break: break-all; }
  .sources li { margin-bottom: 6pt; } h2, h1 { break-after: avoid; } li, p { orphans: 2; widows: 2; }
</style></head><body>
<h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
${body.join("\n")}
</body></html>`;
}

async function renderPdf(payload, opts) {
  const { BrowserWindow } = require("electron");
  const html = renderPdfHtml(payload, opts);
  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    win.destroy();
  }
}

class CreatePdfExecutor extends Executor {
  get type() { return "create_pdf"; }
  get folder() { return "raporlar"; }
  get toolSchema() {
    return {
      name: "create_pdf",
      description:
        "Bir PDF raporu oluşturur ve ~/Documents/Kiri/raporlar/ altına kaydeder. Başlık, bölümler ve paragrafları sen üretirsin. Web'de araştırma yaptıysan kullandığın sayfaları sources alanına ekle.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          title: { type: "string" },
          subtitle: { type: "string", description: "isteğe bağlı alt başlık (ör. tarih, kapsam)" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                paragraphs: { type: "array", items: { type: "string" }, description: "her biri bir paragraf; \"- \" ile başlayan satır madde işareti olur" },
              },
              required: ["paragraphs"],
            },
          },
          sources: {
            type: "array",
            description: "rapor web kaynaklarına dayanıyorsa kullanılan sayfalar",
            items: {
              type: "object",
              properties: { title: { type: "string" }, url: { type: "string" } },
              required: ["url"],
            },
          },
        },
        required: ["filename", "title", "sections"],
      },
    };
  }

  async preview(payload, lang) {
    const n = Array.isArray(payload && payload.sections) ? payload.sections.length : 0;
    const s = Array.isArray(payload && payload.sources) ? payload.sources.length : 0;
    return { summary: t("plan.pdf", lang, (payload && payload.title) || "", n, s, this.outputLabel) };
  }

  async execute(payload) {
    // Section labels ("Sources") follow the answer language the user picked.
    const lang = require("../../config").loadConfig().responseLanguage;
    const buffer = await renderPdf(payload, { lang });
    return this.writeBuffer((payload && payload.filename) || payload.title, "pdf", buffer);
  }
}

module.exports = { CreatePdfExecutor, renderPdfHtml, renderPdf };
