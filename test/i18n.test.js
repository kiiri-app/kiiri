"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron } = require("./helpers");

fakeElectron();
const i18n = require("../ai/i18n");
const { CreateDocxExecutor } = require("../ai/actions/executors/create-docx");
const { CreatePdfExecutor } = require("../ai/actions/executors/create-pdf");
const { CreatePptxExecutor } = require("../ai/actions/executors/create-pptx");
const { CreateXlsxExecutor } = require("../ai/actions/executors/create-xlsx");
const { CreateCsvExecutor } = require("../ai/actions/executors/create-csv");
const { CreateJsonExecutor } = require("../ai/actions/executors/create-json");
const { WriteFileExecutor } = require("../ai/actions/executors/write-file");
const { classifyError } = require("../ai/claude");

test.afterEach(() => i18n.setLanguage("en"));

test("every language has every key, with the same shape as English", () => {
  const en = i18n.STRINGS.en;
  for (const lang of i18n.LANGS) {
    const table = i18n.STRINGS[lang];
    assert.deepEqual(Object.keys(table).sort(), Object.keys(en).sort(), lang);
    for (const key of Object.keys(en)) {
      assert.equal(typeof table[key], typeof en[key], `${lang} ${key}`);
      if (typeof en[key] === "function") assert.equal(table[key].length, en[key].length, `${lang} ${key} arity`);
      else assert.ok(table[key].trim(), `${lang} ${key} empty`);
    }
  }
});

test("t / msg: explicit language, current language, fallbacks", () => {
  assert.equal(i18n.getLanguage(), "en");
  assert.equal(i18n.t("ai.disabled", "tr"), "AI Asistan kapalı.");
  assert.equal(i18n.t("ai.disabled", "ko-KR"), i18n.STRINGS.ko["ai.disabled"]);
  assert.equal(i18n.t("ai.disabled", "xx"), "The AI assistant is off."); // unknown → current
  assert.equal(i18n.t("no.such.key", "tr"), "no.such.key");
  assert.equal(i18n.setLanguage("ja"), "ja");
  assert.equal(i18n.msg("cloud.server", 503), "Kiiri Cloudでエラーが発生しました（503）。");
  assert.equal(i18n.t("cloud.server", null, 503), "Kiiri Cloudでエラーが発生しました（503）。");
  assert.equal(i18n.setLanguage("klingon"), "en");
});

test("plan-card summaries follow the UI language", async () => {
  const docx = new CreateDocxExecutor();
  const doc = { title: "Q3", sections: [{}, {}, {}] };
  i18n.setLanguage("tr");
  assert.equal((await docx.preview(doc)).summary, '📄 Word — "Q3" (3 bölüm) → Kiri/belgeler/');
  i18n.setLanguage("en");
  assert.equal((await docx.preview(doc)).summary, '📄 Word — "Q3" (3 sections) → Kiri/belgeler/');
  assert.equal((await docx.preview({ title: "x", sections: [{}] })).summary, '📄 Word — "x" (1 section) → Kiri/belgeler/');
  // explicit language wins over the current one
  assert.equal((await docx.preview(doc, "ko")).summary, '📄 Word — "Q3" (3개 섹션) → Kiri/belgeler/');

  const pdf = new CreatePdfExecutor();
  const report = { title: "R", sections: [{}, {}], sources: [{ url: "https://a" }] };
  assert.equal((await pdf.preview(report)).summary, '📕 PDF — "R" (2 sections, 1 source) → Kiri/raporlar/');
  assert.equal((await pdf.preview(report, "tr")).summary, '📕 PDF — "R" (2 bölüm, 1 kaynak) → Kiri/raporlar/');
  assert.equal((await pdf.preview({ title: "R", sections: [{}] }, "ja")).summary, "📕 PDF —「R」（1セクション）→ Kiri/raporlar/");

  const table = { columns: ["a", "b"], rows: [[1, 2], [3, 4], [5, 6]] };
  assert.equal((await new CreateXlsxExecutor().preview(table)).summary, "📊 Excel — 2 columns × 3 rows → Kiri/tablolar/");
  assert.equal((await new CreateCsvExecutor().preview(table, "tr")).summary, "🗂 CSV — 2 sütun × 3 satır → Kiri/tablolar/");
  assert.equal((await new CreateCsvExecutor().preview(table, "ko")).summary, "🗂 CSV — 2열 × 3행 → Kiri/tablolar/");
  assert.equal((await new CreateJsonExecutor().preview({ data: { a: 1, b: 2 } }, "ja")).summary, "🔧 JSON — 2項目 → Kiri/veri/");
  assert.equal((await new CreatePptxExecutor().preview({ title: "D", slides: [{}, {}] })).summary, '📊 PowerPoint — "D" (2 slides) → Kiri/sunumlar/');
  assert.equal((await new WriteFileExecutor().preview({ filename: "notes", ext: "md" }, "tr")).summary, '📝 MD dosyası — "notes" → Kiri/dosyalar/');
  assert.equal((await new WriteFileExecutor().preview({ filename: "notes", ext: "md" })).summary, '📝 MD file — "notes" → Kiri/dosyalar/');
});

test("no executor summary is Turkish when the UI is English", async () => {
  const cases = [
    [new CreateDocxExecutor(), { title: "t", sections: [{}] }],
    [new CreatePdfExecutor(), { title: "t", sections: [{}], sources: [{ url: "https://x" }, { url: "https://y" }] }],
    [new CreatePptxExecutor(), { title: "t", slides: [{}] }],
    [new CreateXlsxExecutor(), { columns: ["a"], rows: [[1]] }],
    [new CreateCsvExecutor(), { columns: ["a"], rows: [[1]] }],
    [new CreateJsonExecutor(), { data: { a: 1 } }],
    [new WriteFileExecutor(), { filename: "f", ext: "txt" }],
  ];
  for (const [ex, payload] of cases) {
    const { summary } = await ex.preview(payload);
    assert.doesNotMatch(summary, /bölüm|kaynak|slayt|sütun|satır|alan\b|dosyası/, ex.type);
  }
});

test("classifyError messages follow the UI language", () => {
  i18n.setLanguage("en");
  assert.deepEqual(classifyError({ status: 401 }), { code: "auth", message: "The API key is invalid or missing." });
  assert.equal(classifyError(new Error("fetch failed")).code, "network");
  assert.match(classifyError(new Error("fetch failed")).message, /Couldn't reach the provider/);
  assert.equal(classifyError(new Error("Request was aborted")).message, "Cancelled.");
  i18n.setLanguage("tr");
  assert.equal(classifyError({ status: 429 }).message, "Çok fazla istek — biraz sonra dene.");
  assert.equal(classifyError({ error: { error: { type: "quota_exceeded" } } }).code, "quota");
  i18n.setLanguage("ko");
  assert.equal(classifyError({ status: 404 }).message, "모델을 찾을 수 없어요. 설정에서 모델을 바꾸세요.");
  // provider messages pass through untouched
  assert.equal(classifyError(new Error("weird provider failure")).message, "weird provider failure");
});

test("backend error messages (agent, voice, cloud) follow the UI language", async () => {
  const agent = require("../ai/agent");
  const voice = require("../ai/voice");
  const cloud = require("../ai/cloud");
  i18n.setLanguage("en");
  assert.deepEqual(await agent.runCommand({ commandText: "x" }), { error: "disabled", message: "The AI assistant is off." });
  assert.equal((await agent.approve("plan-missing")).message, "This plan expired — give the command again.");
  assert.equal((await voice.transcribe(Buffer.alloc(2000))).error, "no_key");
  assert.match((await voice.transcribe(Buffer.alloc(2000))).message, /^For voice, sign in to Kiiri Cloud/);
  assert.equal((await cloud.startSignIn("not-an-email")).message, "Enter a valid email address.");
  i18n.setLanguage("ja");
  assert.equal((await agent.runCommand({ commandText: "x" })).message, "AIアシスタントはオフです。");
  assert.equal((await cloud.startSignIn("nope")).message, "有効なメールアドレスを入力してください。");
  i18n.setLanguage("tr");
  assert.equal((await agent.approve("plan-missing")).message, "Plan süresi doldu, komutu tekrar ver.");
});
