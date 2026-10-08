"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { tempDir } = require("./helpers");
const petdex = require("../ai/petdex");

// Minimal valid PNG of the given size (header is all imageSize reads).
function png(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.alloc(1))), chunk("IEND", Buffer.alloc(0))]);
}

test("readPet derives frame geometry from the sheet and pet.json", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "sheet.png"), png(800, 900));
  fs.writeFileSync(path.join(dir, "pet.json"), JSON.stringify({ name: "Blob", columns: 8, rows: 9, fps: 99 }));
  const pet = petdex.readPet(dir);
  assert.equal(pet.frameWidth, 100);
  assert.equal(pet.frameHeight, 100);
  assert.equal(pet.name, "Blob");
  assert.equal(pet.fps, 24); // clamped
});

test("readPet rejects folders without a usable sheet", () => {
  const dir = tempDir();
  assert.equal(petdex.readPet(dir), null);
  fs.writeFileSync(path.join(dir, "sheet.png"), png(16, 16)); // 8x9 grid → frames < 8px
  assert.equal(petdex.readPet(dir), null);
});
