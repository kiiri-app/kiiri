"use strict";

// Draws an arrow whose tip lands on a screen point (plus a pulse ring), then
// fades. The window is a transparent, click-through full-screen overlay on the
// target display; main sends display-local coordinates and the pet→target
// angle via "paw-point", so the arrow always comes in from the pet's side.
const marker = document.getElementById("marker");
const arrowWrap = document.getElementById("arrowWrap");

window.pawAPI.onPoint((pt) => {
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
  marker.style.left = `${pt.x}px`;
  marker.style.top = `${pt.y}px`;
  const ang = Number.isFinite(pt.angle) ? pt.angle : 0;
  arrowWrap.style.setProperty("--ang", `${ang}deg`);
  // Restart the animation each time.
  document.body.classList.remove("show");
  void document.body.offsetWidth;
  document.body.classList.add("show");
});
