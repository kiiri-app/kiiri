"use strict";

// Voice STT (OpenAI-style). Runs in the main process so keys never reach the
// renderer — the renderer records audio and hands the bytes to main, which posts
// them to the transcription endpoint: OpenAI directly, or the user's own proxy
// (config.sttRoute: OpenAI, own proxy, Kiiri Cloud, or a custom/local Whisper
// server). STT-only: that service is the "ear",
// Claude stays the "brain" (the transcript is routed into the command agent).
//
// Uses global fetch/FormData/Blob (available in Electron's Node 18+).

const config = require("./config");

const LANG_HINT = { tr: "tr", en: "en", ko: "ko", ja: "ja" };

async function transcribe(audioBytes, mimeType) {
  const cfg = config.loadConfig();
  const route = config.sttRoute();
  // A custom (local) server may run without a key; every other route needs one.
  if (!route || (!route.apiKey && route.via !== "custom")) return { error: "no_key", message: "Ses için Kiiri Cloud'a giriş yap, OpenAI anahtarı gir ya da kendi ses sunucunu bağla." };
  const via = { proxy: "Proxy", cloud: "Kiiri Cloud", custom: "Ses sunucusu" }[route.via] || "OpenAI";
  if (!audioBytes) return { error: "empty", message: "Ses yakalanamadı." };

  const u8 = Buffer.isBuffer(audioBytes) ? audioBytes : Buffer.from(audioBytes);
  if (u8.length < 1200) return { error: "too_short", message: "Çok kısa — tekrar dene." };

  const form = new FormData();
  form.append("file", new Blob([u8], { type: mimeType || "audio/webm" }), "audio.webm");
  form.append("model", route.model || cfg.transcribeModel || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  const lang = LANG_HINT[cfg.responseLanguage];
  if (lang) form.append("language", lang);

  try {
    const res = await fetch(`${route.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {},
      body: form,
    });
    if (!res.ok) {
      await res.text().catch(() => "");
      if (res.status === 401) return { error: "auth", message: `${via} anahtarı geçersiz.` };
      if (res.status === 429) return { error: "rate_limit", message: `${via} sınırda — sonra dene.` };
      if (res.status === 404 && route.via === "custom") return { error: "server", message: "Ses sunucusu /v1/audio/transcriptions sunmuyor — adresi kontrol et." };
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
