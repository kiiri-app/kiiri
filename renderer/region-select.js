"use strict";

// Region-select overlay logic: drag a rectangle, then type a question about it.
// Coordinates are window-local CSS pixels; main adds the window origin to get
// absolute screen coords before capturing.

const veil = document.getElementById("veil");
const hintEl = document.getElementById("hint");
const selEl = document.getElementById("sel");
const askEl = document.getElementById("ask");
const askInput = document.getElementById("ask-input");
const askSend = document.getElementById("ask-send");

let labels = {
  hint: "Drag a box around what you want to ask about — Esc to cancel",
  placeholder: "Ask about this region…",
  send: "Ask",
};
let dragging = false;
let startX = 0, startY = 0;
let rect = null;       // { x, y, width, height } in local px
let committed = false; // true once the box is drawn and the question box is up

window.regionAPI.onInit((data) => {
  if (data && data.labels) {
    labels = { ...labels, ...data.labels };
  }
  hintEl.textContent = labels.hint;
  askInput.setAttribute("placeholder", labels.placeholder);
  askSend.textContent = labels.send;
});

function setSel(r) {
  selEl.style.left = `${r.x}px`;
  selEl.style.top = `${r.y}px`;
  selEl.style.width = `${r.width}px`;
  selEl.style.height = `${r.height}px`;
}

document.addEventListener("mousedown", (e) => {
  if (committed) return;               // ignore clicks once the question box is up
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  rect = { x: startX, y: startY, width: 0, height: 0 };
  veil.style.display = "none";         // spotlight (sel box-shadow) takes over
  selEl.style.display = "block";
  setSel(rect);
});

document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  rect = { x, y, width: Math.abs(e.clientX - startX), height: Math.abs(e.clientY - startY) };
  setSel(rect);
});

document.addEventListener("mouseup", (e) => {
  if (!dragging) return;
  dragging = false;
  // Too tiny → treat as a misclick, reset to the pre-drag state.
  if (!rect || rect.width < 12 || rect.height < 12) {
    selEl.style.display = "none";
    veil.style.display = "block";
    rect = null;
    return;
  }
  committed = true;
  hintEl.style.display = "none";
  // Place the question box just below the selection (or above if near the bottom).
  const boxTop = rect.y + rect.height + 10;
  askEl.classList.add("show");
  const askW = askEl.offsetWidth, askH = askEl.offsetHeight;
  let left = Math.max(8, Math.min(rect.x, window.innerWidth - askW - 8));
  let top = boxTop + askH > window.innerHeight - 8 ? Math.max(8, rect.y - askH - 10) : boxTop;
  askEl.style.left = `${left}px`;
  askEl.style.top = `${top}px`;
  askInput.focus();
});

askEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = askInput.value.trim();
  window.regionAPI.submit({ rect, question });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.regionAPI.cancel();
});
