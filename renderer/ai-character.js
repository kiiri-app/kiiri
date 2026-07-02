"use strict";

const api = window.aiAPI;
const $ = (id) => document.getElementById(id);

const previewPose = $("preview-pose");
const classicNote = $("classic-note");
const setsEl = $("sets");
const paintBtn = $("paint-btn");

// The illustrated pose-set characters (kiri / tori) plus the original rigged
// "classic" cat. The old Ghibli-resembling sprites (orman/cini …) and their
// editor were removed.
const OPTIONS = [
  { id: "kiri", label: "Kiri", kind: "poseset" },
  { id: "tori", label: "Tori", kind: "poseset" },
  { id: "classic", label: "Klasik kedi", kind: "classic" },
];

let kind = "poseset";
let set = "kiri";

function selectedId() { return kind === "poseset" ? set : "classic"; }

function renderPreview() {
  const posed = kind === "poseset";
  previewPose.hidden = !posed;
  classicNote.hidden = posed;
  if (posed) previewPose.src = `../svg/${set}_noeye.png`;
}

function updatePaintBtn() {
  paintBtn.disabled = kind !== "poseset";
  paintBtn.style.opacity = kind === "poseset" ? "1" : "0.45";
}

function sync() {
  setsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.id === selectedId()));
  renderPreview();
  updatePaintBtn();
}

for (const o of OPTIONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "set-btn";
  b.dataset.id = o.id;
  b.textContent = o.label;
  b.addEventListener("click", () => {
    kind = o.kind;
    if (o.kind === "poseset") set = o.id;
    sync();
  });
  setsEl.appendChild(b);
}

paintBtn.addEventListener("click", async () => {
  if (kind !== "poseset") return;
  // Make sure the active character is this pose-set before opening the pixel editor.
  await api.characterSetArt({ kind, set });
  api.openOverlayEditor();
});

$("apply-btn").addEventListener("click", async () => {
  const btn = $("apply-btn");
  await api.characterSetArt({ kind, set });
  btn.classList.add("done");
  btn.textContent = "Uygulandı ✓";
  setTimeout(() => { btn.classList.remove("done"); btn.textContent = "Uygula"; }, 1400);
});

$("close-btn").addEventListener("click", () => api.closeCharacter());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") api.closeCharacter(); });

(async () => {
  const cur = await api.characterGet();
  if (cur) {
    $("char-name").textContent = cur.name ? `· ${cur.name}` : "";
    // Legacy "sprite" characters fall back to the classic option (sprites removed).
    kind = cur.kind === "poseset" ? "poseset" : "classic";
    if (cur.set === "tori" || cur.set === "kiri") set = cur.set;
  }
  sync();
})();
