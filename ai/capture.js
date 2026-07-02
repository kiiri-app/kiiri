"use strict";

// Captures the screen region under/around the cat. The cat window is made
// transparent for the capture so it never photographs itself. Screenshots are
// kept in memory only and never written to disk (privacy invariant).

const { screen, desktopCapturer, nativeImage } = require("electron");

const MAX_LONG_EDGE = 1568; // downsample target — plenty for vision, controls cost

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function evenClamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Computes the logical-pixel rectangle to grab, centered on the cat and clamped
// to the display the cat sits on.
function regionForPet(petBounds, captureWidth, captureHeight) {
  const cx = petBounds.x + petBounds.width / 2;
  // The cat renders in the lower-center of its (tall) window — bias downward so
  // the region covers the content the cat is "standing on".
  const cy = petBounds.y + petBounds.height * 0.6;
  const display = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) });
  const b = display.bounds;

  const w = Math.min(captureWidth, b.width);
  const h = Math.min(captureHeight, b.height);
  let x = cx - w / 2;
  let y = cy - h / 2;
  x = Math.max(b.x, Math.min(x, b.x + b.width - w));
  y = Math.max(b.y, Math.min(y, b.y + b.height - h));
  return { display, rect: { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) } };
}

// Returns { base64, mediaType, rect } or throws.
async function captureRegion(petWin, { captureWidth, captureHeight }) {
  if (!petWin || petWin.isDestroyed()) throw new Error("pet window unavailable");
  const petBounds = petWin.getBounds();
  const { display, rect } = regionForPet(petBounds, captureWidth, captureHeight);
  const scale = display.scaleFactor || 1;

  // Hide the cat for the capture (opacity 0 keeps geometry but removes it from
  // the composited frame), then restore.
  const prevOpacity = petWin.getOpacity();
  petWin.setOpacity(0);
  let source = null;
  try {
    await delay(140); // let the compositor drop the cat from the frame
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale),
      },
    });
    source =
      sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  } finally {
    petWin.setOpacity(prevOpacity || 1);
  }
  if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error("screen capture returned no image (check screen-recording permission)");
  }

  const full = source.thumbnail;
  const fullSize = full.getSize();
  // Convert the logical region into thumbnail pixel coordinates.
  const px = {
    x: evenClamp((rect.x - display.bounds.x) * scale, 0, Math.max(0, fullSize.width - 2)),
    y: evenClamp((rect.y - display.bounds.y) * scale, 0, Math.max(0, fullSize.height - 2)),
    width: 0,
    height: 0,
  };
  px.width = evenClamp(rect.width * scale, 2, fullSize.width - px.x);
  px.height = evenClamp(rect.height * scale, 2, fullSize.height - px.y);

  let cropped = full.crop(px);
  // Downsample so the long edge is <= MAX_LONG_EDGE.
  const cs = cropped.getSize();
  const longEdge = Math.max(cs.width, cs.height);
  if (longEdge > MAX_LONG_EDGE) {
    if (cs.width >= cs.height) cropped = cropped.resize({ width: MAX_LONG_EDGE, quality: "good" });
    else cropped = cropped.resize({ height: MAX_LONG_EDGE, quality: "good" });
  }

  const buffer = cropped.toPNG();
  return { base64: buffer.toString("base64"), mediaType: "image/png", rect };
}

module.exports = { captureRegion, regionForPet };
