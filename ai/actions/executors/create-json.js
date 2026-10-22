"use strict";

// create_json — saves a Claude-authored JSON object as a pretty-printed .json
// file (dependency-free).

const { Executor } = require("../executor");
const { t } = require("../../i18n");

// Pure renderer. payload: { data: object } → Buffer (2-space pretty JSON).
function renderJson(payload) {
  const data = payload && payload.data !== undefined ? payload.data : {};
  return Buffer.from(JSON.stringify(data, null, 2), "utf8");
}

class CreateJsonExecutor extends Executor {
  get type() { return "create_json"; }
  get folder() { return "veri"; }
  get toolSchema() {
    return {
      name: "create_json",
      description:
        "Yapılandırılmış veriyi düzgün biçimli bir .json dosyası olarak ~/Documents/Kiri/veri/ altına kaydeder. `data` alanına kaydedilecek JSON nesnesini koy (dizi gerekiyorsa bir alan içinde ver).",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          data: { type: "object", description: "kaydedilecek JSON nesnesi" },
        },
        required: ["filename", "data"],
      },
    };
  }

  async preview(payload, lang) {
    const keys = payload && payload.data && typeof payload.data === "object"
      ? Object.keys(payload.data).length : 0;
    return { summary: t("plan.json", lang, keys, this.outputLabel) };
  }

  async execute(payload) {
    const buffer = renderJson(payload);
    return this.writeBuffer((payload && payload.filename) || "veri", "json", buffer);
  }
}

module.exports = { CreateJsonExecutor, renderJson };
