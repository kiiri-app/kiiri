"use strict";

// Voice TTS — the mirror of voice.js (STT): runs in the main process so keys
// never reach the renderer. Primary: OpenAI-style speech synthesis, either
// straight to OpenAI or through the user's own proxy (config.audioRoute), which
// returns audio bytes for the pet window to play. Fallback: the macOS `say`
// command, which works offline and without any key.

const { spawn } = require("child_process");
const config = require("./config");

const TTS_MODEL = "gpt-4o-mini-tts";
// macOS built-in voices per response language for the `say` fallback.
const SAY_VOICES = { tr: "Yelda", en: "Samantha", ko: "Yuna", ja: "Kyoko" };

let sayProc = null;

// Keep spoken answers snappy: cut at a sentence boundary near the cap.
function trimForSpeech(text, max = 700) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}

async function synthesize(text) {
  const cfg = config.loadConfig();
  const route = config.audioRoute();
  const input = trimForSpeech(text);
  if (!route || !route.apiKey) return { error: "no_key" };
  if (!input) return { error: "empty" };
  try {
    const res = await fetch(`${route.baseUrl}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${route.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: cfg.ttsVoice || "alloy",
        input,
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      await res.text().catch(() => "");
      return { error: "server", status: res.status };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { error: "empty_audio" };
    return { ok: true, audio: buf.toString("base64"), mime: "audio/mpeg" };
  } catch (err) {
    return { error: "network", message: (err && err.message) || "network" };
  }
}

// Offline fallback: macOS `say`. Any new utterance interrupts the previous one.
function speakWithSay(text) {
  if (process.platform !== "darwin") return false;
  const input = trimForSpeech(text);
  if (!input) return false;
  stopSay();
  const cfg = config.loadConfig();
  const voice = SAY_VOICES[cfg.responseLanguage];
  const args = voice ? ["-v", voice, input] : [input];
  try {
    sayProc = spawn("/usr/bin/say", args, { stdio: "ignore" });
    sayProc.on("exit", () => { sayProc = null; });
    return true;
  } catch {
    sayProc = null;
    return false;
  }
}

function stopSay() {
  if (sayProc) {
    try { sayProc.kill(); } catch {}
    sayProc = null;
  }
}

module.exports = { synthesize, speakWithSay, stopSay, trimForSpeech };
