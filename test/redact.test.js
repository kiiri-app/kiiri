"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const { redactForSpeech, redactSecrets, redactPaths } = require("../ai/redact");

test("provider keys and tokens are masked", () => {
  for (const secret of [
    "sk-ant-abcdefghijklmnopqrstuv",
    "sk-abcdefghijklmnopqrstuvwx",
    "ghp_abcdefghijklmnopqrstuv",
    "AKIAABCDEFGHIJKLMNOP",
  ]) {
    const out = redactSecrets(`key is ${secret} ok`);
    assert.ok(!out.includes(secret), `${secret} leaked: ${out}`);
  }
  assert.ok(!redactSecrets('api_key="hunter2hunter2"').includes("hunter2hunter2"));
});

test("ordinary prose is left alone", () => {
  const text = "Tests passed: 12 of 12. Refactored the token parser.";
  assert.equal(redactForSpeech(text), text);
});

test("home-directory paths are shortened", () => {
  const p = `${os.homedir()}/projects/secret-client/app.js`;
  const out = redactPaths(`edited ${p}`);
  assert.ok(!out.includes(os.homedir()), out);
});

test("speech is length-capped", () => {
  assert.ok(redactForSpeech("a ".repeat(5000)).length <= 2001);
});
