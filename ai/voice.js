"use strict";

// Voice STT (OpenAI-style). Runs in the main process so keys never reach the
// renderer — the renderer records audio and hands the bytes to main, which posts
// them to the transcription endpoint: OpenAI directly, or the user's own proxy
// (config.audioRoute). STT-only: OpenAI is the "ear",
// Claude stays the "brain" (the transcript is routed into the command agent).
//
// Uses global fetch/FormData/Blob (available in Electron's Node 18+).

const config = require("./config");

const LANG_HINT = { tr: "tr", en: "en", ko: "ko", ja: "ja" };

async function transcribe(audioBytes, mimeType) {
  const cfg = config.loadConfig();
  const route = config.audioRoute();
  if (!route || !route.apiKey) return { error: "no_key", message: "Önce OpenAI anahtarını gir ya da kendi proxy'ni bağla." };
  const via = route.via === "proxy" ? "Proxy" : "OpenAI";
  if (!audioBytes) return { error: "empty", message: "Ses yakalanamadı." };

  const u8 = Buffer.isBuffer(audioBytes) ? audioBytes : Buffer.from(audioBytes);
  if (u8.length < 1200) return { error: "too_short", message: "Çok kısa — tekrar dene." };

  const form = new FormData();
  form.append("file", new Blob([u8], { type: mimeType || "audio/webm" }), "audio.webm");
  form.append("model", cfg.transcribeModel || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  const lang = LANG_HINT[cfg.responseLanguage];
  if (lang) form.append("language", lang);

  try {
    const res = await fetch(`${route.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${route.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      await res.text().catch(() => "");
      if (res.status === 401) return { error: "auth", message: `${via} anahtarı geçersiz.` };
      if (res.status === 429) return { error: "rate_limit", message: `${via} sınırda — sonra dene.` };
      if (res.status === 413) return { error: "too_large", message: "Ses çok uzun." };
      if (res.status === 501) return { error: "server", message: "Proxy'de ses için OPENAI_API_KEY tanımlı değil." };
      return { error: "server", message: `${via} servisi hata verdi (${res.status}).` };
    }
    const data = await res.json();
    return { ok: true, text: String((data && data.text) || "").trim() };
  } catch (err) {
    return { error: "network", message: (err && err.message) || "Ağ hatası." };
  }
}

module.exports = { transcribe };
