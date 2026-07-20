"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Bridge for the region-select overlay: it draws a rectangle, then sends the
// local-pixel rect + the typed question to main (which adds the window origin,
// captures that exact region, and answers). Localized labels come from main.
contextBridge.exposeInMainWorld("regionAPI", {
  onInit: (cb) => ipcRenderer.on("region-init", (_e, data) => cb(data)),
  submit: (payload) => ipcRenderer.send("region-select-submit", payload),
  cancel: () => ipcRenderer.send("region-select-cancel"),
});
