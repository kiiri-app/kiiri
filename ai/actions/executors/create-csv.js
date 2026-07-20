"use strict";

// create_csv — renders a Claude-authored table to a real .csv (dependency-free).
// RFC-4180 quoting; UTF-8 BOM so Excel opens Turkish characters correctly.

const { Executor } = require("../executor");

// One CSV field: quote when it contains a comma, quote, or newline; double inner
// quotes.
function csvField(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Pure renderer. payload: { columns: [string], rows: [[cell]] } → Buffer.
function renderCsv(payload) {
  const columns = Array.isArray(payload && payload.columns) ? payload.columns : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const lines = [];
  if (columns.length) lines.push(columns.map(csvField).join(","));
  for (const r of rows) {
    const cells = Array.isArray(r) ? r : [r];
    lines.push(cells.map(csvField).join(","));
  }
  // BOM keeps Excel from mangling UTF-8 (Turkish) on open.
  return Buffer.from("﻿" + lines.join("\r\n"), "utf8");
}

class CreateCsvExecutor extends Executor {
  get type() { return "create_csv"; }
  get folder() { return "tablolar"; }
  get toolSchema() {
    return {
      name: "create_csv",
      description:
        "Bir CSV tablosu oluşturur ve ~/Documents/Kiri/tablolar/ altına kaydeder (Excel/Numbers/Sheets açar). Sütun başlıkları ve satırları sen üretirsin. Basit/taşınabilir tablo için bunu, biçimli tablo için create_xlsx kullan.",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          columns: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: { type: "array", items: { type: ["string", "number"] } },
          },
        },
        required: ["filename", "columns", "rows"],
      },
    };
  }

  async preview(payload) {
    const cols = Array.isArray(payload && payload.columns) ? payload.columns.length : 0;
    const rows = Array.isArray(payload && payload.rows) ? payload.rows.length : 0;
    return { summary: `🗂 CSV — ${cols} sütun × ${rows} satır → Kiri/tablolar/` };
  }

  async execute(payload) {
    const buffer = renderCsv(payload);
    return this.writeBuffer((payload && payload.filename) || "tablo", "csv", buffer);
  }
}

module.exports = { CreateCsvExecutor, renderCsv };
