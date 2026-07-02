"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pawAPI", {
  onPoint: (cb) => ipcRenderer.on("paw-point", (_e, pt) => cb(pt)),
});
