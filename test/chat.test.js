"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { fakeElectron, fresh } = require("./helpers");

const userData = fakeElectron();

test("chat history persists across a module reload and resets cleanly", async () => {
  const llm = fresh("../ai/llm");
  const config = fresh("../ai/config");
  config.loadConfig = () => ({ enabled: true, responseLanguage: "tr", writingStyle: { tags: [], note: "" } });
  config.providerReady = () => true;
  let seen = null;
  llm.callChatStream = async (opts, onDelta) => { seen = opts.messages; onDelta("miyav"); return { text: "miyav" }; };

  let chat = fresh("../ai/chat");
  const r = await chat.send("merhaba", { charId: "char-1" });
  assert.equal(r.ok, true);
  assert.deepEqual(seen.map((m) => m.role), ["user"]);
  assert.ok(fs.existsSync(path.join(userData, "chats", "char-1.json")));

  chat = fresh("../ai/chat"); // simulate an app restart (cache gone)
  assert.deepEqual(chat.history("char-1").map((m) => m.text), ["merhaba", "miyav"]);
  await chat.send("nasılsın", { charId: "char-1" });
  assert.deepEqual(seen.map((m) => m.text), ["merhaba", "miyav", "nasılsın"]);

  chat.reset("char-1");
  assert.equal(chat.history("char-1").length, 0);
  assert.ok(!fs.existsSync(path.join(userData, "chats", "char-1.json")));
});

test("failed send drops the optimistic user turn from disk too", async () => {
  const llm = fresh("../ai/llm");
  const config = fresh("../ai/config");
  config.loadConfig = () => ({ enabled: true, responseLanguage: "tr" });
  config.providerReady = () => true;
  llm.callChatStream = async () => { throw Object.assign(new Error("boom"), { status: 500 }); };
  const chat = fresh("../ai/chat");
  const r = await chat.send("selam", { charId: "char-2" });
  assert.ok(r.error);
  const again = fresh("../ai/chat");
  assert.equal(again.history("char-2").length, 0);
});

test("context window keeps the last turns and never starts on the assistant", () => {
  const chat = fresh("../ai/chat");
  const arr = [];
  for (let i = 0; i < 30; i += 1) arr.push({ role: i % 2 ? "assistant" : "user", text: String(i) });
  const win = chat.contextWindow(arr);
  assert.ok(win.length <= 24);
  assert.equal(win[0].role, "user");
  assert.equal(win[win.length - 1].text, "29");
});

test("charId cannot escape the chats dir", async () => {
  const chat = fresh("../ai/chat");
  chat.history("../../evil");
  chat.deleteChar("../../evil");
  assert.ok(!fs.existsSync(path.join(userData, "..", "evil.json")));
});
