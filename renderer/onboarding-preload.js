"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// First-run welcome window: read the current defaults, apply the user's
// choices in one go, or skip.
contextBridge.exposeInMainWorld("onboardingAPI", {
  get: () => ipcRenderer.invoke("onboarding-get"),
  setLanguage: (lang) => ipcRenderer.invoke("onboarding-language", lang),
  finish: (choices) => ipcRenderer.invoke("onboarding-finish", choices),
});
