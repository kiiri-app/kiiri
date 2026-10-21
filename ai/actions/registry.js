"use strict";

// Executor registry. Built-in executors register at startup; the planner asks
// the registry for tool schemas and looks up an executor by tool name.

const { CreatePptxExecutor } = require("./executors/create-pptx");
const { CreateDocxExecutor } = require("./executors/create-docx");
const { WriteFileExecutor } = require("./executors/write-file");
const { CreateXlsxExecutor } = require("./executors/create-xlsx");
const { CreateCsvExecutor } = require("./executors/create-csv");
const { CreateJsonExecutor } = require("./executors/create-json");
const { CreatePdfExecutor } = require("./executors/create-pdf");

const executors = new Map();

function register(executor) {
  executors.set(executor.type, executor);
}

function get(type) {
  return executors.get(type) || null;
}

function all() {
  return Array.from(executors.values());
}

// Tool schemas for Claude, optionally filtered to an allow-list of types.
function toolSchemas(allowedTypes) {
  return all()
    .filter((e) => !allowedTypes || allowedTypes.includes(e.type))
    .map((e) => e.toolSchema);
}

// Register the built-ins once.
register(new CreatePptxExecutor());
register(new CreateDocxExecutor());
register(new WriteFileExecutor());
register(new CreateXlsxExecutor());
register(new CreateCsvExecutor());
register(new CreateJsonExecutor());
register(new CreatePdfExecutor());

module.exports = { register, get, all, toolSchemas };
