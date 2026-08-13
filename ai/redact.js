"use strict";

// Anything an *external* agent sends us (MCP tools, the local /speak and /point
// bridge routes) can end up in a speech bubble or spoken out loud — on a screen
// that is often being shared or recorded. Agents happily paste API keys, tokens
// and absolute home paths into status messages, so scrub them before they are
// shown. This is deliberately conservative: it only rewrites text that is very
// likely a secret or a filesystem path, never ordinary prose.

const os = require("os");

const TOKEN_PATTERNS = [
  // Provider keys / bearer tokens: prefix + a long opaque tail.
  /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  // JWTs.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // key=value / "key": "value" shapes for anything named like a secret.
  /\b(api[_-]?key|secret|token|password|passwd|authorization)\b(\s*[:=]\s*)("?)([^\s"',;]{6,})\3/gi,
];

const MASK = "•••";

function redactSecrets(text) {
  let out = text;
  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, (match, ...rest) => {
      // The key=value pattern has capture groups; keep the label, mask the value.
      if (rest.length >= 4 && typeof rest[1] === "string" && /[:=]/.test(rest[1])) {
        return `${rest[0]}${rest[1]}${MASK}`;
      }
      return MASK;
    });
  }
  return out;
}

// Absolute paths leak the user's name and project layout. Keep the last two
// segments so the message still says something useful ("…/kiri/main.js").
function redactPaths(text) {
  const home = os.homedir();
  let out = home ? text.split(home).join("~") : text;
  out = out.replace(/(?:~|\/(?:Users|home|var|tmp|opt|private|Volumes)|[A-Za-z]:\\Users)[^\s"',;)\]]{4,}/g, (match) => {
    const sep = match.includes("\\") ? "\\" : "/";
    const parts = match.split(sep).filter(Boolean);
    if (parts.length <= 2) return match;
    return `…${sep}${parts.slice(-2).join(sep)}`;
  });
  return out;
}

// Full scrub for externally supplied speech. Also caps the length, since a
// bubble is not a log viewer.
function redactForSpeech(text, { maxLength = 2000 } = {}) {
  if (typeof text !== "string" || !text) return "";
  let out = redactSecrets(text);
  out = redactPaths(out);
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > maxLength) out = `${out.slice(0, maxLength - 1)}…`;
  return out;
}

module.exports = { redactForSpeech, redactSecrets, redactPaths };
