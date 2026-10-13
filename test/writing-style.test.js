"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeElectron, fresh } = require("./helpers");

fakeElectron();
const prompts = fresh("../ai/prompts");
const config = fresh("../ai/config");

test("every offered tag has a prompt line", () => {
  for (const tag of config.WRITING_STYLE_TAGS) assert.ok(prompts.WRITING_STYLE_LINES[tag], tag);
});

test("config keeps only known tags, dedupes, caps the note", () => {
  const saved = config.saveConfig({ writingStyle: { tags: ["concise", "bogus", "concise", "noEmDash"], note: "x".repeat(500) } });
  assert.deepEqual(saved.writingStyle.tags, ["concise", "noEmDash"]);
  assert.equal(saved.writingStyle.note.length, 300);
  assert.equal(saved.activeProfile, "", "style is not a profiled field");
});

test("style reaches the agent + drop prompts, empty style adds nothing", () => {
  const style = { tags: ["noEmDash"], note: "okura siz diye hitap et" };
  const agent = prompts.agentSystemPrompt("tr", "Kiri", "", "", style);
  assert.match(agent, /Uzun tire/);
  assert.match(agent, /siz diye/);
  assert.match(agent, /UYDURMA/);
  assert.match(prompts.systemPrompt("tr", "Kiri", "", "", style), /Yazım üslubu/);
  assert.doesNotMatch(prompts.agentSystemPrompt("tr", "Kiri", "", "", { tags: [], note: "" }), /Yazım üslubu/);
});

test("docx renders dash paragraphs as real bullets", async () => {
  const { renderDocx } = require("../ai/actions/executors/create-docx");
  const buf = await renderDocx({ title: "T", sections: [{ heading: "H", paragraphs: ["- bir", "düz paragraf"] }] });
  const JSZip = require("jszip");
  const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml").async("string");
  assert.match(xml, /<w:numPr>/);
  assert.match(xml, />bir</);
  assert.doesNotMatch(xml, />- bir</);
});
