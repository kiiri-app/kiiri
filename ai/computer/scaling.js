"use strict";

// Screenshot ↔ screen coordinate mapping for computer use.
//
// The computer toolset takes no display size: the model works in the pixel
// space of the screenshots we send, and those must already fit the image limits
// (the API doesn't downscale). We capture the display at its physical
// resolution (bounds × scaleFactor — 2× on Retina), shrink it to fit
// MAX_LONG_EDGE / MAX_PIXELS, and keep the exact ratio so a click at screenshot
// (x, y) lands on the same spot of the real display, including displays whose
// origin isn't (0, 0) (a second monitor to the left/right/above).
//
// Electron reports display bounds in DIP ("points" on macOS), which is also
// what CGEvent wants on macOS; Windows/Linux drivers convert DIP → physical
// pixels themselves (input.js).

// Conservative limits that every toolset-capable model accepts (docs: newer
// models take up to 2576 px / ~3.75 MP; 1568 px / 1.15 MP is the safe floor and
// keeps the per-step image cost down).
const MAX_LONG_EDGE = 1568;
const MAX_PIXELS = 1150000;

// Scale (≤ 1) that fits width × height inside the limits.
function fitScale(width, height, { maxLongEdge = MAX_LONG_EDGE, maxPixels = MAX_PIXELS } = {}) {
  const w = Math.max(1, width), h = Math.max(1, height);
  return Math.min(1, maxLongEdge / Math.max(w, h), Math.sqrt(maxPixels / (w * h)));
}

// display: Electron Display ({ id, bounds: {x,y,width,height}, scaleFactor }).
// Returns the geometry every later mapping uses.
function createGeometry(display, limits) {
  const b = display.bounds;
  const sf = display.scaleFactor || 1;
  const physWidth = Math.round(b.width * sf);
  const physHeight = Math.round(b.height * sf);
  const s = fitScale(physWidth, physHeight, limits);
  const shotWidth = Math.max(1, Math.floor(physWidth * s));
  const shotHeight = Math.max(1, Math.floor(physHeight * s));
  return {
    displayId: display.id,
    bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
    scaleFactor: sf,
    physWidth,
    physHeight,
    shotWidth,
    shotHeight,
  };
}

function isPoint(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

// Model coordinate [x, y] (screenshot pixels) → global DIP point on the display.
// Throws on a malformed or out-of-screenshot coordinate so the model gets an
// is_error result instead of a click somewhere unexpected.
function shotToScreen(geom, coord) {
  if (!isPoint(coord)) throw new Error("coordinate must be [x, y]");
  const x = Number(coord[0]), y = Number(coord[1]);
  if (x < 0 || y < 0 || x > geom.shotWidth || y > geom.shotHeight) {
    throw new Error(`coordinate [${x}, ${y}] is outside the screenshot (${geom.shotWidth}x${geom.shotHeight})`);
  }
  const kx = geom.bounds.width / geom.shotWidth;
  const ky = geom.bounds.height / geom.shotHeight;
  // Keep sub-point precision (CGEvent takes floats); clamp inside the display so
  // the right/bottom edge never spills onto the neighbour display.
  const gx = geom.bounds.x + Math.min(x * kx, geom.bounds.width - 0.5);
  const gy = geom.bounds.y + Math.min(y * ky, geom.bounds.height - 0.5);
  return { x: round2(gx), y: round2(gy) };
}

// Global DIP point → screenshot pixels (for cursor_position). Points off this
// display are clamped to its edge.
function screenToShot(geom, point) {
  const kx = geom.shotWidth / geom.bounds.width;
  const ky = geom.shotHeight / geom.bounds.height;
  const x = Math.round((point.x - geom.bounds.x) * kx);
  const y = Math.round((point.y - geom.bounds.y) * ky);
  return [clamp(x, 0, geom.shotWidth - 1), clamp(y, 0, geom.shotHeight - 1)];
}

// zoom region [x0, y0, x1, y1] in screenshot pixels → crop rect in the
// physical-resolution capture, plus the output size that fits the limits.
function zoomCrop(geom, region) {
  if (!Array.isArray(region) || region.length !== 4 || region.some((v) => !Number.isFinite(Number(v)))) {
    throw new Error("region must be [x0, y0, x1, y1]");
  }
  let [x0, y0, x1, y1] = region.map(Number);
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  x0 = clamp(x0, 0, geom.shotWidth); x1 = clamp(x1, 0, geom.shotWidth);
  y0 = clamp(y0, 0, geom.shotHeight); y1 = clamp(y1, 0, geom.shotHeight);
  if (x1 - x0 < 2 || y1 - y0 < 2) throw new Error("zoom region is empty");
  const k = geom.physWidth / geom.shotWidth;
  const kyy = geom.physHeight / geom.shotHeight;
  const crop = {
    x: Math.floor(x0 * k),
    y: Math.floor(y0 * kyy),
    width: Math.max(2, Math.min(geom.physWidth, Math.ceil(x1 * k)) - Math.floor(x0 * k)),
    height: Math.max(2, Math.min(geom.physHeight, Math.ceil(y1 * kyy)) - Math.floor(y0 * kyy)),
  };
  const s = fitScale(crop.width, crop.height);
  return { crop, outWidth: Math.max(1, Math.floor(crop.width * s)), outHeight: Math.max(1, Math.floor(crop.height * s)) };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }

module.exports = { MAX_LONG_EDGE, MAX_PIXELS, fitScale, createGeometry, shotToScreen, screenToShot, zoomCrop };
