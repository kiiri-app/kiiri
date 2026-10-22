"use strict";

// Base class for actions the agent can take. Each executor declares the tool
// schema Claude sees, previews what it will do, executes after approval, and can
// roll back (send the written file to the trash). All writes go through the
// sandbox in paths.js.

const fs = require("fs");
const path = require("path");
const { shell } = require("electron");
const { resolveOutputPath, outputRoot } = require("./paths");

class Executor {
  get type() {
    throw new Error("type not implemented");
  }
  // localMutate (green/30s undo) | external | irreversible. MVP: localMutate only.
  get approval() {
    return "localMutate";
  }
  get folder() {
    return "dosyalar";
  }
  // JSON-schema tool definition handed to Claude (name/description/input_schema).
  get toolSchema() {
    throw new Error("toolSchema not implemented");
  }

  // Where the card says the file goes (the on-disk folder name, not translated).
  get outputLabel() {
    return `Kiri/${this.folder}/`;
  }

  // Human-facing one-liner shown on the Supervision Card before execution, in
  // the UI language (ai/i18n) unless `lang` is given.
  async preview(payload, lang) {
    return { summary: `${this.type}: ${(payload && payload.filename) || ""}` };
  }

  // Must return { type, path, name } so the result can be opened/undone.
  async execute(payload) {
    throw new Error("execute not implemented");
  }

  async rollback(result) {
    if (result && result.path && fs.existsSync(result.path)) {
      await shell.trashItem(result.path);
      return true;
    }
    return false;
  }

  // Helper: write a buffer to a unique sandboxed path and return its location.
  async writeBuffer(baseName, ext, buffer) {
    const fullPath = resolveOutputPath(this.folder, baseName, ext);
    fs.writeFileSync(fullPath, buffer);
    return { type: this.type, path: fullPath, name: path.basename(fullPath), root: outputRoot() };
  }
}

module.exports = { Executor };
