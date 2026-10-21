"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// First-run welcome window: read the current defaults, apply the user's
// choices in one go, or skip.
contextBridge.exposeInMainWorld("onboardingAPI", {
  get: () => ipcRenderer.invoke("onboarding-get"),
  setLanguage: (lang) => ipcRenderer.invoke("onboarding-language", lang),
  finish: (choices) => ipcRenderer.invoke("onboarding-finish", choices),
  cloudSignIn: (email) => ipcRenderer.invoke("cloud-sign-in-start", email),
  cloudCancel: () => ipcRenderer.invoke("cloud-sign-in-cancel"),
  cloudStatus: () => ipcRenderer.invoke("cloud-status"),
  onCloudAuth: (cb) => ipcRenderer.on("cloud-auth-changed", (_e, data) => cb(data)),
});
