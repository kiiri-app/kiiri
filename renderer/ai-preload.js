"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Surface for the AI panel + AI settings windows. Mirrors only the AI IPC; the
// API key is never exposed (only `hasApiKey` boolean comes back via config).
contextBridge.exposeInMainWorld("aiAPI", {
  // App language (shared with the pet windows)
  languageGet: () => ipcRenderer.invoke("language-get"),
  onLanguageChanged: (cb) => ipcRenderer.on("language-changed", (_e, language) => cb(language)),

  // Panel (task menu → result)
  onMenuShow: (cb) => ipcRenderer.on("ai-menu-show", (_e, data) => cb(data)),
  onBusy: (cb) => ipcRenderer.on("ai-panel-busy", (_e, data) => cb(data)),
  runTask: (payload) => ipcRenderer.invoke("ai-run-task", payload),
  cancel: () => ipcRenderer.send("ai-cancel"),
  closePanel: () => ipcRenderer.send("ai-panel-close"),
  resizePanel: (size) => ipcRenderer.send("ai-panel-resize", size),

  // Settings
  configGet: () => ipcRenderer.invoke("ai-config-get"),
  configSet: (patch) => ipcRenderer.invoke("ai-config-set", patch),
  setKey: (key) => ipcRenderer.invoke("ai-set-key", key),
  clearKey: () => ipcRenderer.invoke("ai-clear-key"),
  setOpenAiKey: (key) => ipcRenderer.invoke("ai-set-openai-key", key),
  clearOpenAiKey: () => ipcRenderer.invoke("ai-clear-openai-key"),
  setGeminiKey: (key) => ipcRenderer.invoke("ai-set-gemini-key", key),
  clearGeminiKey: () => ipcRenderer.invoke("ai-clear-gemini-key"),
  tasksGet: () => ipcRenderer.invoke("ai-tasks-get"),
  customTaskSave: (task) => ipcRenderer.invoke("ai-custom-task-save", task),
  customTaskDelete: (id) => ipcRenderer.invoke("ai-custom-task-delete", id),
  closeSettings: () => ipcRenderer.send("ai-settings-close"),

  // Command agent (text-driven actions + skills)
  agentRun: (commandText) => ipcRenderer.invoke("ai-agent-run", commandText),
  agentApprove: (planId) => ipcRenderer.invoke("ai-agent-approve", planId),
  agentCancel: (planId) => ipcRenderer.send("ai-agent-cancel", planId),
  agentUndo: (payload) => ipcRenderer.invoke("ai-agent-undo", payload),
  agentOpen: (filePath) => ipcRenderer.send("ai-agent-open", filePath),
  skillsList: () => ipcRenderer.invoke("ai-skills-list"),
  skillAuthor: (description) => ipcRenderer.invoke("ai-skill-author", description),
  skillSave: (skill) => ipcRenderer.invoke("ai-skill-save", skill),
  skillDelete: (id) => ipcRenderer.invoke("ai-skill-delete", id),
  closeCommand: () => ipcRenderer.send("ai-command-close"),
  resizeCommand: (size) => ipcRenderer.send("ai-command-resize", size),
  onVoiceRun: (cb) => ipcRenderer.on("ai-voice-run", (_e, text) => cb(text)),

  // Knowledge journal (SM-2 spaced repetition)
  journalDue: () => ipcRenderer.invoke("ai-journal-due"),
  journalList: () => ipcRenderer.invoke("ai-journal-list"),
  journalStats: () => ipcRenderer.invoke("ai-journal-stats"),
  journalAdd: (card) => ipcRenderer.invoke("ai-journal-add", card),
  journalAddFromText: (text) => ipcRenderer.invoke("ai-journal-add-from-text", text),
  journalReview: (id, quality) => ipcRenderer.invoke("ai-journal-review", { id, quality }),
  journalDelete: (id) => ipcRenderer.invoke("ai-journal-delete", id),
  closeJournal: () => ipcRenderer.send("ai-journal-close"),
  resizeJournal: (size) => ipcRenderer.send("ai-journal-resize", size),

  // Pixel-overlay editor window open/close
  openOverlayEditor: () => ipcRenderer.send("open-overlay-editor"),
  closeOverlay: () => ipcRenderer.send("overlay-editor-close"),

  // Pixel-overlay editor: variants + live preview + save/confirm
  overlayPresetsGet: () => ipcRenderer.invoke("overlay-presets-get"),
  overlayPreview: (overlay) => ipcRenderer.send("overlay-preview", overlay),
  overlayApply: (overlay) => ipcRenderer.invoke("overlay-apply", overlay),
  overlayPresetSave: (payload) => ipcRenderer.invoke("overlay-preset-save", payload),
  overlayPresetDelete: (id) => ipcRenderer.invoke("overlay-preset-delete", id),
  overlayConfirm: (opts) => ipcRenderer.invoke("overlay-confirm", opts),
});
