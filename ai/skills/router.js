"use strict";

// Routes a command to a saved skill by trigger match. Accent/case-insensitive
// (Turkish-folded) substring match; longest trigger wins.

function fold(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ı]/g, "i").replace(/[ş]/g, "s").replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u").replace(/[ö]/g, "o").replace(/[ç]/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchSkill(commandText, skills) {
  const hay = fold(commandText);
  let best = null;
  let bestLen = 0;
  for (const skill of skills || []) {
    for (const trig of skill.triggers || []) {
      const needle = fold(trig);
      if (needle && hay.includes(needle) && needle.length > bestLen) {
        best = skill;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

module.exports = { matchSkill, fold };
