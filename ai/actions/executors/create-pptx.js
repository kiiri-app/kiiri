"use strict";

// create_pptx — Claude fills slide content as the tool input; this renders it to
// a real editable .pptx with pptxgenjs (pure JS, no native deps).

const { Executor } = require("../executor");

// Pure renderer (testable without Electron). payload:
//   { title, slides: [{ heading, bullets: [string], notes? }] }
async function renderPptx(payload) {
  const pptxgen = require("pptxgenjs");
  const Pptx = pptxgen.default || pptxgen;
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Kiiri";

  const title = String((payload && payload.title) || "Sunum");
  const slides = Array.isArray(payload && payload.slides) ? payload.slides : [];

  // Title slide
  const cover = pptx.addSlide();
  cover.background = { color: "1F2228" };
  cover.addText(title, {
    x: 0.6, y: 2.6, w: "88%", h: 1.6,
    fontSize: 40, bold: true, color: "FFFFFF", align: "center",
  });
  cover.addText("🐾 Kiiri", {
    x: 0.6, y: 4.3, w: "88%", h: 0.5,
    fontSize: 16, color: "FFB454", align: "center",
  });

  for (const sl of slides) {
    const cs = pptx.addSlide();
    cs.addText(String((sl && sl.heading) || ""), {
      x: 0.5, y: 0.4, w: "90%", h: 1, fontSize: 28, bold: true, color: "1F2228",
    });
    const bullets = (Array.isArray(sl && sl.bullets) ? sl.bullets : [])
      .filter((b) => String(b || "").trim())
      .map((b) => ({ text: String(b), options: { bullet: true, fontSize: 18, color: "333333", paraSpaceAfter: 8 } }));
    if (bullets.length) {
      cs.addText(bullets, { x: 0.7, y: 1.6, w: "88%", h: 5, valign: "top" });
    }
    if (sl && sl.notes) cs.addNotes(String(sl.notes));
  }

  return pptx.write({ outputType: "nodebuffer" });
}

class CreatePptxExecutor extends Executor {
  get type() { return "create_pptx"; }
  get folder() { return "sunumlar"; }
  get toolSchema() {
    return {
      name: "create_pptx",
      description:
        "Düzenlenebilir bir PowerPoint (.pptx) sunum oluşturur ve ~/Documents/Kiri/sunumlar/ altına kaydeder. Slayt içeriğini (başlık + maddeler) sen üretirsin.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          title: { type: "string", description: "sunum başlığı" },
          slides: {
            type: "array",
            description: "her biri bir slayt; 4-8 slayt önerilir",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                notes: { type: "string", description: "opsiyonel konuşmacı notu" },
              },
              required: ["heading"],
            },
          },
        },
        required: ["filename", "title", "slides"],
      },
    };
  }

  async preview(payload) {
    const n = Array.isArray(payload && payload.slides) ? payload.slides.length : 0;
    return { summary: `📊 PowerPoint — "${(payload && payload.title) || ""}" (${n} slayt) → Kiri/sunumlar/` };
  }

  async execute(payload) {
    const buffer = await renderPptx(payload);
    return this.writeBuffer((payload && payload.filename) || payload.title, "pptx", buffer);
  }
}

module.exports = { CreatePptxExecutor, renderPptx };
