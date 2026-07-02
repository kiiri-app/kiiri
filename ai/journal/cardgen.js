"use strict";

// Turns a piece of content (an AI task result, or pasted text) into a single
// flashcard {question, answer} via the active LLM provider. Used by the
// "📚 Deftere ekle" button so the user controls quality.

const config = require("../config");
const llm = require("../llm");
const { languageName } = require("../prompts");

function parseJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Returns { ok, card: { question, answer } } or { error, message }.
async function fromText(content) {
  if (!config.providerReady()) return { error: "no_key", message: "Önce sağlayıcı anahtarını gir." };
  const text = String(content || "").trim();
  if (!text) return { error: "empty", message: "Boş içerik." };

  const lang = config.loadConfig().responseLanguage;
  const langName = languageName(lang);
  const system = [
    `Aşağıdaki içerikten öğrenmeyi pekiştirecek TEK bir soru-cevap kartı üret.`,
    `Soru kısa ve net olsun; cevap özlü ve doğru olsun. Dil: ${langName}.`,
    `Yalnızca şu JSON'u döndür, başka hiçbir şey yazma: {"question": "...", "answer": "..."}`,
  ].join("\n");

  try {
    const { text: out } = await llm.callVision({
      system,
      userText: `İçerik:\n${text.slice(0, 4000)}`,
      maxTokens: 500,
      think: false,
    });
    const parsed = parseJson(out);
    const question = parsed && String(parsed.question || "").trim();
    const answer = parsed && String(parsed.answer || "").trim();
    if (!question || !answer) return { error: "parse", message: "Kart üretilemedi." };
    return { ok: true, card: { question, answer } };
  } catch (err) {
    const info = llm.classifyError(err);
    return { error: info.code, message: info.message };
  }
}

module.exports = { fromText };
