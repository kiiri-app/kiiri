"use strict";

// write_file — plain text / markdown / html. The simplest executor; Claude
// produces the whole content.

const { Executor } = require("../executor");

const ALLOWED_EXT = ["md", "txt", "html"];

class WriteFileExecutor extends Executor {
  get type() { return "write_file"; }
  get folder() { return "dosyalar"; }
  get toolSchema() {
    return {
      name: "write_file",
      description:
        "Düz metin, Markdown (.md) veya HTML (.html) bir dosya oluşturur ve ~/Documents/Kiri/dosyalar/ altına kaydeder. Tüm içeriği sen üretirsin.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          ext: { type: "string", enum: ALLOWED_EXT, description: "dosya türü" },
          content: { type: "string", description: "dosyanın tam içeriği" },
        },
        required: ["filename", "ext", "content"],
      },
    };
  }

  async preview(payload) {
    const ext = ALLOWED_EXT.includes(payload && payload.ext) ? payload.ext : "txt";
    return { summary: `📝 ${ext.toUpperCase()} dosyası — "${(payload && payload.filename) || ""}" → Kiri/dosyalar/` };
  }

  async execute(payload) {
    const ext = ALLOWED_EXT.includes(payload && payload.ext) ? payload.ext : "txt";
    const buffer = Buffer.from(String((payload && payload.content) || ""), "utf8");
    return this.writeBuffer((payload && payload.filename) || "not", ext, buffer);
  }
}

module.exports = { WriteFileExecutor };
