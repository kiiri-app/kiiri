"use strict";

// Client-side safety gate for computer use. `assessRisk(action, context)` is a
// pure function: given one computer-toolset action (as the model sent it) and
// what we know about the moment (frontmost app, window title, whether a secure
// text field is focused, the model's stated intent for this turn, the task), it
// says whether the run must pause and ask the user first.
//
// The system prompt also asks the model to stop and confirm irreversible steps,
// but this gate is the guarantee: it runs before every action, whatever the
// model says.

const { parseCombo } = require("./keys");

// Apps where Kiiri never acts without asking: secrets, shells, security settings.
// Matched case-insensitively against the frontmost app name. Small and editable
// on purpose — add an app here, not a special case somewhere else.
const BLOCKED_APPS = [
  { re: /keychain|schlüsselbund|키체인|キーチェーン/i, label: "Keychain" },
  { re: /^passwords$|1password|bitwarden|lastpass|dashlane|keepass|enpass|nordpass|proton pass|roboform/i, label: "password manager" },
  { re: /^terminal$|iterm|^warp$|ghostty|alacritty|kitty|wezterm|^hyper$|konsole|gnome-terminal|xterm|tilix|terminator/i, label: "terminal" },
  { re: /powershell|^pwsh|^cmd(\.exe)?$|command prompt|windows ?terminal|windowsterminal|^conhost/i, label: "terminal" },
  { re: /^regedit|registry editor|^mmc$|group policy/i, label: "system tool" },
];

// Settings apps are only gated when the pane looks security-related.
const SETTINGS_APP_RE = /^system settings$|^system preferences$|^systemsettings$|^settings$|^control panel$|^ayarlar$|^sistem ayarları$|시스템 설정|システム設定/i;
const SECURITY_PANE_RE = /privacy|security|password|users? ?&? ?groups|login items|touch id|firewall|filevault|gizlilik|güvenlik|parola|şifre|kullanıcı|보안|개인정보|암호|セキュリティ|プライバシー|パスワード/i;

// Windows / tasks that look like banking or payments.
const BANKING_RE = /\bbank(ing)?\b|online banking|\bbanka(sı|m)?\b|internet şubesi|mobil şube|\bhavale\b|\beft\b|\bfast ödeme|paypal|revolut|\bwise\b|stripe dashboard|akbank|garanti bbva|garanti bankası|ziraat|yapı ?kredi|iş ?bankası|isbank|enpara|denizbank|vakıfbank|halkbank|\bqnb\b|papara|chase\.com|wells fargo|hsbc|barclays|은행|インターネットバンキング|銀行/i;

// Words that mean "this step commits something" (tr/en/ko/ja). Latin entries
// are matched on word boundaries so "post" doesn't hit "poster"; CJK entries
// are plain substrings (no spaces between words there).
const RISK_WORDS_LATIN = [
  // en
  "send", "sends", "sending", "submit", "submits", "submitting", "pay", "pays", "paying", "payment",
  "buy", "buying", "purchase", "purchasing", "checkout", "check out", "place order", "place the order",
  "order now", "confirm order", "confirm purchase", "delete", "deletes", "deleting", "remove", "removing",
  "erase", "empty trash", "move to trash", "transfer", "wire", "publish", "publishing", "post", "posting",
  "tweet", "install", "installing", "uninstall", "sign out", "log out", "logout", "signout",
  "factory reset", "format disk", "unsubscribe",
  // tr
  "gönder", "gönderiyorum", "göndereceğim", "gönderin", "gönderilecek", "yolla", "yolluyorum",
  "öde", "ödeme", "ödemeyi", "ödüyorum", "satın al", "satın alıyorum", "satın alma", "sipariş", "siparişi",
  "siparişver", "sil", "siliyorum", "sileceğim", "silin", "silme", "silmek", "kaldır", "kaldırıyorum",
  "kaldıracağım", "çöpe at", "aktar", "aktarıyorum", "havale", "eft", "yayınla", "yayınlıyorum", "paylaş",
  "paylaşıyorum", "kur", "kuruyorum", "yükle", "yüklüyorum", "çıkış yap", "oturumu kapat", "abonelikten çık",
];
const RISK_WORDS_CJK = [
  // ko
  "보내기", "전송", "제출", "결제", "구매", "주문", "삭제", "제거", "송금", "이체", "게시", "설치", "로그아웃",
  // ja
  "送信", "提出", "支払", "購入", "注文", "削除", "消去", "送金", "振込", "振り込", "投稿", "公開", "インストール",
  "ログアウト", "サインアウト",
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// \b is ASCII-only in JS, so build our own boundary from "not a letter/digit".
const RISK_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:${RISK_WORDS_LATIN.map(escapeRe).join("|")})(?=$|[^\\p{L}\\p{N}])|${RISK_WORDS_CJK.map(escapeRe).join("|")}`,
  "iu"
);

// Shortcuts that quit, force-quit, log out or delete. Compared as normalized
// combos (see keys.parseCombo), so "Cmd+Q", "command+q" and "super+q" match.
const DANGEROUS_COMBOS = [
  "cmd+q", "cmd+alt+esc", "cmd+shift+q", "cmd+alt+shift+q", "cmd+backspace", "cmd+delete",
  "cmd+shift+backspace", "cmd+alt+backspace", "cmd+shift+delete", "shift+delete", "ctrl+alt+delete",
  "ctrl+alt+backspace", "alt+f4", "ctrl+shift+delete", "ctrl+shift+esc", "ctrl+alt+shift+q",
  "ctrl+q",
];

const PASSIVE_ACTIONS = new Set(["screenshot", "zoom", "cursor_position", "wait", "mouse_move", "scroll"]);
const CLICK_ACTIONS = new Set(["left_click", "double_click", "triple_click", "right_click", "middle_click", "left_mouse_up"]);
const SUBMIT_KEYS = new Set(["return", "enter", "kp_enter"]);
const SECRET_RE = /password|passcode|passwort|contraseña|mot de passe|\bpin\b|\bcvv\b|\bcvc\b|security code|card number|credit card|2fa|one[- ]time code|otp|verification code|şifre|parola|kart numarası|güvenlik kodu|doğrulama kodu|비밀번호|암호|카드 번호|인증 코드|パスワード|暗証番号|カード番号|認証コード|セキュリティコード/i;

function normCombo(text) {
  const c = parseCombo(text);
  return c ? [...c.mods, c.key].join("+") : "";
}
const DANGEROUS_SET = new Set(DANGEROUS_COMBOS.map(normCombo));

function blockedApp(app) {
  const name = String(app || "").trim();
  if (!name) return null;
  const hit = BLOCKED_APPS.find((b) => b.re.test(name));
  return hit ? hit.label : null;
}

// Luhn-valid 13–19 digit run: a payment card number being typed.
function looksLikeCardNumber(text) {
  const digits = String(text || "").replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// action:  { name, input } — a computer toolset member call.
// context: { app, windowTitle, secureInput, intent, task }
//   intent = the model's own text for this turn ("Clicking Send…"), task = the
//   user's request. Both optional.
// returns { risky: boolean, reason: string, category?: string }
function assessRisk(action, context = {}) {
  const name = String((action && action.name) || "");
  const input = (action && action.input) || {};
  const ctx = context || {};
  const intent = String(ctx.intent || "");
  const task = String(ctx.task || "");
  const title = String(ctx.windowTitle || "");
  const app = String(ctx.app || "");
  const ok = { risky: false, reason: "" };

  if (PASSIVE_ACTIONS.has(name)) return ok;

  const blocked = blockedApp(app);
  if (blocked) {
    return { risky: true, category: "blocked_app", reason: `${app} is a ${blocked} — Kiiri asks before acting there.` };
  }
  if (SETTINGS_APP_RE.test(app.trim()) && SECURITY_PANE_RE.test(`${title} ${intent}`)) {
    return { risky: true, category: "blocked_app", reason: `${app}: security / privacy settings.` };
  }
  if (BANKING_RE.test(`${app} ${title} ${intent} ${task}`)) {
    return { risky: true, category: "banking", reason: "This looks like banking or a payment." };
  }

  if (name === "type") {
    const text = String(input.text || "");
    if (ctx.secureInput) return { risky: true, category: "secret_field", reason: "Typing into a password field." };
    if (SECRET_RE.test(intent)) return { risky: true, category: "secret_field", reason: "Typing into what looks like a password / code field." };
    if (looksLikeCardNumber(text)) return { risky: true, category: "secret_field", reason: "Typing what looks like a card number." };
    return ok;
  }

  if (name === "key" || name === "hold_key") {
    const combo = parseCombo(input.text);
    const norm = combo ? [...combo.mods, combo.key].join("+") : "";
    if (DANGEROUS_SET.has(norm)) {
      return { risky: true, category: "dangerous_shortcut", reason: `Shortcut ${input.text} can quit, log out or delete.` };
    }
    if (combo && SUBMIT_KEYS.has(combo.key) && RISK_RE.test(intent || task)) {
      return { risky: true, category: "irreversible_intent", reason: "Pressing Enter here looks like it sends / submits / deletes something." };
    }
    return ok;
  }

  if (CLICK_ACTIONS.has(name) || name === "left_click_drag" || name === "left_mouse_down") {
    // Only the model's own note for this turn decides: the task text alone
    // ("send the email") would make every click of that run ask.
    if (RISK_RE.test(intent)) {
      return { risky: true, category: "irreversible_intent", reason: "This click looks like it sends / buys / deletes / publishes something." };
    }
    return ok;
  }

  return ok;
}

module.exports = {
  assessRisk,
  blockedApp,
  looksLikeCardNumber,
  BLOCKED_APPS,
  DANGEROUS_COMBOS,
  RISK_WORDS_LATIN,
  RISK_WORDS_CJK,
  PASSIVE_ACTIONS,
};
