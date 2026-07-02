"use strict";

// create_docx — renders Claude-authored content to a real .docx with the `docx`
// library (pure JS).

const { Executor } = require("../executor");

// Pure renderer. payload: { title, sections: [{ heading, paragraphs: [string] }] }
async function renderDocx(payload) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
  const title = String((payload && payload.title) || "Belge");
  const sections = Array.isArray(payload && payload.sections) ? payload.sections : [];

  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];
  for (const sec of sections) {
    if (sec && sec.heading) {
      children.push(new Paragraph({ text: String(sec.heading), heading: HeadingLevel.HEADING_1 }));
    }
    const paras = Array.isArray(sec && sec.paragraphs) ? sec.paragraphs : [];
    for (const p of paras) {
      children.push(new Paragraph({ children: [new TextRun(String(p || ""))] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

class CreateDocxExecutor extends Executor {
  get type() { return "create_docx"; }
  get folder() { return "belgeler"; }
  get toolSchema() {
    return {
      name: "create_docx",
      description:
        "Bir Word (.docx) belgesi oluşturur ve ~/Documents/Kiri/belgeler/ altına kaydeder. Bölüm başlıkları ve paragraf içeriğini sen üretirsin.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          title: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                paragraphs: { type: "array", items: { type: "string" } },
              },
              required: ["paragraphs"],
            },
          },
        },
        required: ["filename", "title", "sections"],
      },
    };
  }

  async preview(payload) {
    const n = Array.isArray(payload && payload.sections) ? payload.sections.length : 0;
    return { summary: `📄 Word — "${(payload && payload.title) || ""}" (${n} bölüm) → Kiri/belgeler/` };
  }

  async execute(payload) {
    const buffer = await renderDocx(payload);
    return this.writeBuffer((payload && payload.filename) || payload.title, "docx", buffer);
  }
}

module.exports = { CreateDocxExecutor, renderDocx };
