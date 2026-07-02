"use strict";

// SuperMemo-2 (SM-2) spaced-repetition scheduler. Pure: takes a card's current
// state + a recall quality (0-5) and returns the next state. The store turns
// `intervalDays` into a concrete `dueAt` (it owns the clock).
//
// Quality mapping used by the UI:
//   Tekrar (Again) = 2  → lapse (reset)
//   Zor    (Hard)  = 3
//   İyi    (Good)  = 4
//   Kolay  (Easy)  = 5

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

function review(card, quality) {
  let ease = Number(card && card.ease) || DEFAULT_EASE;
  let intervalDays = Number(card && card.intervalDays) || 0;
  let repetitions = Number(card && card.repetitions) || 0;

  const q = Math.max(0, Math.min(5, Math.round(Number(quality))));

  if (q < 3) {
    // Failed recall — reset the streak, see it again tomorrow.
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
    repetitions += 1;
  }

  // Update easiness factor.
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < MIN_EASE) ease = MIN_EASE;

  return { ease, intervalDays, repetitions };
}

module.exports = { review, DEFAULT_EASE, MIN_EASE };
