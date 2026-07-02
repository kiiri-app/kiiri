"use strict";

// Draws a paw + pulse ring at a screen point, then fades. The window is a
// transparent, click-through full-screen overlay on the target display; main
// sends display-local coordinates via "paw-point".
const paw = document.getElementById("paw");
const ring = document.getElementById("ring");

window.pawAPI.onPoint((pt) => {
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
  const x = `${pt.x}px`;
  const y = `${pt.y}px`;
  paw.style.left = x;
  paw.style.top = y;
  ring.style.left = x;
  ring.style.top = y;
  // Restart the animation each time.
  document.body.classList.remove("show");
  void document.body.offsetWidth;
  document.body.classList.add("show");
});
