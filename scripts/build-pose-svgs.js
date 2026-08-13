#!/usr/bin/env node
// Bundles the animated pose SVGs (svg/*_anim.svg) into renderer/pose-anim-svgs.js
// as inline markup. The renderer injects them into the DOM (fetch() can't read
// file:// URLs, so we ship them as a lazy-loaded script — same pattern as
// cell-mappings.js). Re-run after editing any *_anim.svg:  npm run build:posesvgs
const fs = require("fs");
const path = require("path");

const FILES = {
  "kiri/move": "kiri_scruff_anim.svg",
  "kiri/listening": "kiri_listening_anim.svg",
  "kiri/working": "kiri_working_anim.svg",
  "tori/move": "tori_scruff_anim.svg",
  "tori/listening": "tori_listening_anim.svg",
  "tori/working": "tori_working_anim.svg",
  // No "pointing" entry: the drawn pointing pose was dropped — showing a spot
  // is now gaze (idle art) + the arrow overlay. The *_pointing_anim.svg files
  // are kept on disk but no longer bundled.
};

const svgDir = path.join(__dirname, "..", "svg");
const outFile = path.join(__dirname, "..", "renderer", "pose-anim-svgs.js");
const lib = {};
for (const [key, file] of Object.entries(FILES)) {
  lib[key] = fs.readFileSync(path.join(svgDir, file), "utf8");
}
const out =
  "// AUTO-GENERATED from svg/*_anim.svg by scripts/build-pose-svgs.js — do not edit.\n" +
  "window.POSE_ANIM_SVGS = " + JSON.stringify(lib) + ";\n";
fs.writeFileSync(outFile, out);
console.log(`pose-anim-svgs.js written (${(out.length / 1024).toFixed(1)} KB, ${Object.keys(lib).length} poses)`);
