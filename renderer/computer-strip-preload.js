"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Control strip shown while Kiiri uses the computer: progress, pause/stop and
// the "ask before risky step" confirmation.
contextBridge.exposeInMainWorld("cuAPI", {
  languageGet: () => ipcRenderer.invoke("language-get"),
  onState: (cb) => ipcRenderer.on("cu-state", (_e, s) => cb(s)),
  onConfirm: (cb) => ipcRenderer.on("cu-confirm", (_e, c) => cb(c)),
  onConfirmClear: (cb) => ipcRenderer.on("cu-confirm-clear", (_e, c) => cb(c)),
  pause: (on) => ipcRenderer.send("cu-pause", !!on),
  stop: () => ipcRenderer.send("cu-stop"),
  answer: (id, allowed) => ipcRenderer.send("cu-confirm-answer", { id, allowed: !!allowed }),
  hover: (over) => ipcRenderer.send("cu-strip-hover", !!over),
});
