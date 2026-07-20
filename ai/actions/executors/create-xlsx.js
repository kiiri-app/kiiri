"use strict";

// create_xlsx — renders a Claude-authored table to a real .xlsx with exceljs
// (pure JS). Bold header row, auto-sized columns, one sheet. Opens in Excel /
// Numbers / Google Sheets.

const { Executor } = require("../executor");

// Pure renderer. payload:
//   { sheetName?, columns: [string], rows: [[cell]] }  (cells: string|number)
async function renderXlsx(payload) {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kiri";
  const sheetName = String((payload && payload.sheetName) || "Sayfa1").slice(0, 31) || "Sayfa1";
  const ws = wb.addWorksheet(sheetName);

  const columns = Array.isArray(payload && payload.columns) ? payload.columns.map((c) => String(c ?? "")) : [];
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];

  if (columns.length) {
    const header = ws.addRow(columns);
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E7CF" } };
  }
  for (const r of rows) {
    const cells = Array.isArray(r) ? r : [r];
    // Keep numbers numeric so Excel treats them as numbers; everything else text.
    ws.addRow(cells.map((v) => (typeof v === "number" ? v : String(v ?? ""))));
  }

  // Auto-fit: widen each column to its longest cell (capped).
  const colCount = Math.max(columns.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 1)), 1);
  for (let i = 1; i <= colCount; i += 1) {
    const col = ws.getColumn(i);
    let max = 8;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(60, max + 2);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

class CreateXlsxExecutor extends Executor {
  get type() { return "create_xlsx"; }
  get folder() { return "tablolar"; }
  get toolSchema() {
    return {
      name: "create_xlsx",
      description:
        "Bir Excel (.xlsx) tablosu oluşturur ve ~/Documents/Kiri/tablolar/ altına kaydeder. Sütun başlıklarını ve satır verilerini sen üretirsin. Sayısal değerleri sayı olarak ver (tırnaksız).",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "uzantısız, kısa dosya adı" },
          sheetName: { type: "string", description: "sayfa adı (isteğe bağlı)" },
          columns: { type: "array", items: { type: "string" }, description: "başlık satırı" },
          rows: {
            type: "array",
            description: "her biri hücre dizisi olan satırlar; sütun sırasına uy",
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
    return { summary: `📊 Excel — ${cols} sütun × ${rows} satır → Kiri/tablolar/` };
  }

  async execute(payload) {
    const buffer = await renderXlsx(payload);
    return this.writeBuffer((payload && payload.filename) || "tablo", "xlsx", buffer);
  }
}

module.exports = { CreateXlsxExecutor, renderXlsx };
