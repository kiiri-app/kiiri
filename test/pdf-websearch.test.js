"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron } = require("./helpers");

fakeElectron();
const { renderPdfHtml } = require("../ai/actions/executors/create-pdf");
const { webSearchTool, collectSources } = require("../ai/claude");
const { agentSystemPrompt } = require("../ai/prompts");
const { matchSkill } = require("../ai/skills/router");
const bundled = require("../ai/skills/bundled");
const registry = require("../ai/actions/registry");

test("pdf html: title, sections, real bullets, escaped content", () => {
  const html = renderPdfHtml({
    title: "Q3 <Satış>",
    sections: [{ heading: "Bulgular", paragraphs: ["Gelir %12 arttı.", "- İstanbul önde", "- Ankara ikinci", "Sonra & devamı"] }],
  });
  assert.match(html, /<h1>Q3 &lt;Satış&gt;<\/h1>/);
  assert.match(html, /<h2>Bulgular<\/h2>/);
  assert.match(html, /<ul><li>İstanbul önde<\/li><li>Ankara ikinci<\/li><\/ul>/);
  assert.match(html, /<p>Sonra &amp; devamı<\/p>/);
  assert.doesNotMatch(html, /<Satış>/);
});

test("pdf html: sources become a list; only http(s) URLs are links", () => {
  const html = renderPdfHtml({
    title: "R", sections: [],
    sources: [{ title: "TÜİK", url: "https://data.tuik.gov.tr/x" }, { title: "bad", url: "javascript:alert(1)" }],
  }, { lang: "en" });
  assert.match(html, /<h2>Sources<\/h2>/);
  assert.match(html, /<a href="https:\/\/data\.tuik\.gov\.tr\/x">TÜİK<\/a>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /<li>bad<\/li>/);
});

test("pdf html carries a CSP that blocks scripts and remote loads", () => {
  assert.match(renderPdfHtml({ title: "x", sections: [] }), /default-src 'none'; style-src 'unsafe-inline'/);
});

test("create_pdf is registered with a schema that requires content", () => {
  const ex = registry.get("create_pdf");
  assert.ok(ex);
  assert.deepEqual(ex.toolSchema.input_schema.required, ["filename", "title", "sections"]);
  assert.ok(ex.toolSchema.input_schema.properties.sources);
});

test("web search tool version follows the model", () => {
  assert.equal(webSearchTool("claude-opus-5").type, "web_search_20260209");
  assert.equal(webSearchTool("claude-sonnet-4-6").type, "web_search_20260209");
  assert.equal(webSearchTool("claude-haiku-4-5").type, "web_search_20250305");
  assert.equal(webSearchTool("claude-opus-5").name, "web_search");
});

test("sources: deduped results; an error result (object, not list) is skipped", () => {
  const blocks = [
    { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } },
    { type: "web_search_tool_result", content: [
      { type: "web_search_result", url: "https://a.com", title: "A" },
      { type: "web_search_result", url: "https://b.com", title: "B" },
    ] },
    { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://a.com", title: "A again" }] },
    { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
    { type: "text", text: "done" },
  ];
  assert.deepEqual(collectSources(blocks), [{ title: "A", url: "https://a.com" }, { title: "B", url: "https://b.com" }]);
});

test("agent prompt: research rule with web search, honesty rule without", () => {
  assert.match(agentSystemPrompt("tr", "Kiri", "", [], null, { webSearch: true }), /web_search/);
  const off = agentSystemPrompt("tr", "Kiri", "", [], null, { webSearch: false });
  assert.doesNotMatch(off, /web_search ile ara/);
  assert.match(off, /Web'e erişimin yok/);
});

test("research commands route to the PDF research skill", () => {
  for (const [lang, cmd] of [["tr", "Türkiye'de e-ticaret pazarını araştır, PDF rapor yap"], ["en", "research the EV market and make a pdf report"]]) {
    const hit = matchSkill(cmd, bundled.bundledSkills(lang));
    assert.equal(hit && hit.id, "bundled-research-report", `${lang}: ${cmd}`);
    assert.deepEqual(hit.tools, ["create_pdf"]);
  }
  // still goes to meeting minutes, not research
  assert.equal(matchSkill("bu toplantı notlarını tutanağa çevir", bundled.bundledSkills("tr")).id, "bundled-meeting-notes");
});

test("callWithTools resumes pause_turn and merges blocks across continuations", async () => {
  const calls = [];
  const replies = [
    { stop_reason: "pause_turn", model: "claude-opus-5", content: [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "ev market" } },
      { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://iea.org/ev", title: "IEA" }] },
    ] },
    { stop_reason: "tool_use", model: "claude-opus-5", content: [
      { type: "text", text: "Raporu hazırladım." },
      { type: "tool_use", id: "t1", name: "create_pdf", input: { filename: "ev", title: "EV", sections: [] } },
    ] },
  ];
  class FakeSDK {
    constructor() { this.messages = { create: async (params) => { calls.push(JSON.parse(JSON.stringify(params))); return replies[calls.length - 1]; } }; }
  }
  const id = require.resolve("@anthropic-ai/sdk");
  const saved = require.cache[id];
  require.cache[id] = { id, filename: id, loaded: true, exports: FakeSDK };
  const { fresh } = require("./helpers");
  const claude = fresh("../ai/claude");
  try {
    const out = await claude.callWithTools({ apiKey: "k", model: "claude-opus-5", system: "s", userText: "u", tools: [], webSearch: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].tools.at(-1).type, "web_search_20260209");
    // the resume re-sends the paused assistant turn, with no extra user "continue"
    assert.deepEqual(calls[1].messages.map((m) => m.role), ["user", "assistant"]);
    assert.equal(out.toolUses[0].name, "create_pdf");
    assert.deepEqual(out.sources, [{ title: "IEA", url: "https://iea.org/ev" }]);
    assert.equal(out.text, "Raporu hazırladım.");
  } finally {
    if (saved) require.cache[id] = saved; else delete require.cache[id];
    fresh("../ai/claude");
  }
});

test("without webSearch no server tool is sent", async () => {
  let sent;
  class FakeSDK { constructor() { this.messages = { create: async (p) => { sent = p; return { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }; } }; } }
  const id = require.resolve("@anthropic-ai/sdk");
  const saved = require.cache[id];
  require.cache[id] = { id, filename: id, loaded: true, exports: FakeSDK };
  const { fresh } = require("./helpers");
  const claude = fresh("../ai/claude");
  try {
    await claude.callWithTools({ apiKey: "k", model: "claude-opus-5", system: "s", userText: "u", tools: [{ name: "create_pdf" }] });
    assert.deepEqual(sent.tools.map((t) => t.name), ["create_pdf"]);
  } finally {
    if (saved) require.cache[id] = saved; else delete require.cache[id];
    fresh("../ai/claude");
  }
});
