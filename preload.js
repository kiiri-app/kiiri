"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onCursorPos: (callback) =>
    ipcRenderer.on("cursor-pos", (_evt, data) => callback(data)),
  onKeyPressed: (callback) =>
    ipcRenderer.on("key-pressed", () => callback()),
  onMouseWheel: (callback) =>
    ipcRenderer.on("mouse-wheel", (_evt, event) => callback(event)),
  onDoStretch: (callback) =>
    ipcRenderer.on("do-stretch", () => callback()),
  onDoJump: (callback) =>
    ipcRenderer.on("do-jump", () => callback()),
  onCatNameEdit: (callback) =>
    ipcRenderer.on("cat-name-edit", (_evt, name) => callback(name)),
  onCatNameChanged: (callback) =>
    ipcRenderer.on("cat-name-changed", (_evt, settings) => callback(settings)),
  onAiTaskComplete: (callback) =>
    ipcRenderer.on("ai-task-complete", (_evt, event) => callback(event)),
  onAiTaskState: (callback) =>
    ipcRenderer.on("ai-task-state", (_evt, event) => callback(event)),
  onAiTaskNotification: (callback) =>
    ipcRenderer.on("ai-task-notification", (_evt, event) => callback(event)),
  remindersGet: () => ipcRenderer.invoke("reminders-get"),
  reminderAdd: (payload) => ipcRenderer.invoke("reminder-add", payload),
  reminderUpdate: (payload) => ipcRenderer.invoke("reminder-update", payload),
  reminderDelete: (id) => ipcRenderer.invoke("reminder-delete", id),
  reminderEnabledSet: (payload) => ipcRenderer.invoke("reminder-enabled-set", payload),
  onRemindersChanged: (callback) =>
    ipcRenderer.on("reminders-changed", (_evt, reminders) => callback(reminders)),
  onReminderTriggered: (callback) =>
    ipcRenderer.on("reminder-triggered", (_evt, payload) => callback(payload)),
  onReminderPanelOpen: (callback) =>
    ipcRenderer.on("reminder-panel-open", () => callback()),
  onReminderSettingsChanged: (callback) =>
    ipcRenderer.on("reminder-settings-changed", (_evt, settings) => callback(settings)),
  pomodoroGet: () => ipcRenderer.invoke("pomodoro-get"),
  pomodoroStart: () => ipcRenderer.invoke("pomodoro-start"),
  pomodoroPause: () => ipcRenderer.invoke("pomodoro-pause"),
  pomodoroReset: () => ipcRenderer.invoke("pomodoro-reset"),
  pomodoroFocusSet: (min) => ipcRenderer.invoke("pomodoro-focus-set", min),
  onPomodoroFocusEdit: (callback) =>
    ipcRenderer.on("pomodoro-focus-edit", (_evt, min) => callback(min)),
  onPomodoroState: (callback) =>
    ipcRenderer.on("pomodoro-state", (_evt, state) => callback(state)),
  onPomodoroComplete: (callback) =>
    ipcRenderer.on("pomodoro-complete", (_evt, state) => callback(state)),
  onPomodoroFocusStart: (callback) =>
    ipcRenderer.on("pomodoro-focus-start", () => callback()),
  onUpdateState: (callback) =>
    ipcRenderer.on("update-state", (_evt, state) => callback(state)),
  onTaskCompleteSoundVolume: (callback) =>
    ipcRenderer.on("task-complete-sound-volume", (_evt, volume) => callback(volume)),
  updateCheck: () => ipcRenderer.invoke("update-check"),
  updateDownload: () => ipcRenderer.invoke("update-download"),
  updateInstall: () => ipcRenderer.invoke("update-install"),
  dragWindow: (dx, dy) => ipcRenderer.send("drag-window", dx, dy),
  dragWindowEnded: () => ipcRenderer.send("drag-window-ended"),
  aiTriggerDrop: (payload) => ipcRenderer.send("ai-trigger-drop", payload),
  onAiNotice: (callback) =>
    ipcRenderer.on("ai-notice", (_evt, message) => callback(message)),
  voiceConfigGet: () => ipcRenderer.invoke("voice-config-get"),
  onVoiceConfigChanged: (callback) =>
    ipcRenderer.on("voice-config-changed", (_evt, cfg) => callback(cfg)),
  voiceRequestMic: () => ipcRenderer.invoke("voice-request-mic"),
  voiceSendAudio: (payload) => ipcRenderer.invoke("voice-audio", payload),
  // Push-to-talk (hold hotkey → ask about the whole screen)
  onPttStart: (callback) => ipcRenderer.on("ptt-start", () => callback()),
  onPttStop: (callback) => ipcRenderer.on("ptt-stop", () => callback()),
  pttSendAudio: (payload) => ipcRenderer.invoke("ptt-audio", payload),
  onScreenAnswer: (callback) => ipcRenderer.on("screen-answer", (_evt, data) => callback(data)),
  setMouseEventsEnabled: (enabled) => ipcRenderer.send("set-mouse-events-enabled", enabled),
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
  setStretchMode: (enabled) => ipcRenderer.send("set-stretch-mode", enabled),
  setHuntingMode: (enabled) => ipcRenderer.send("set-hunting-mode", enabled),
  userNameGet: () => ipcRenderer.invoke("user-name-get"),
  userNameSet: (name) => ipcRenderer.invoke("user-name-set", name),
  onPersonaEdit: (callback) =>
    ipcRenderer.on("persona-edit", (_evt, persona) => callback(persona)),
  personaSet: (persona) => ipcRenderer.invoke("persona-set", persona),
  onUserNameEdit: (callback) =>
    ipcRenderer.on("user-name-edit", (_evt, name) => callback(name)),
  onUserNameChanged: (callback) =>
    ipcRenderer.on("user-name-changed", (_evt, settings) => callback(settings)),
  catNameGet: () => ipcRenderer.invoke("cat-name-get"),
  catNameSet: (name) => ipcRenderer.invoke("cat-name-set", name),
  catNameVisibleSet: (visible) => ipcRenderer.invoke("cat-name-visible-set", visible),
  fixedMessageGet: () => ipcRenderer.invoke("fixed-message-get"),
  fixedMessageSet: (message) => ipcRenderer.invoke("fixed-message-set", message),
  onFixedMessageEdit: (callback) =>
    ipcRenderer.on("fixed-message-edit", (_evt, message) => callback(message)),
  onFixedMessageChanged: (callback) =>
    ipcRenderer.on("fixed-message-changed", (_evt, settings) => callback(settings)),
  catNamePromptShown: () => ipcRenderer.invoke("cat-name-prompt-shown"),
  taskCompleteSoundVolumeGet: () => ipcRenderer.invoke("task-complete-sound-volume-get"),
  taskCompleteSoundVolumeSet: (volume) => ipcRenderer.invoke("task-complete-sound-volume-set", volume),

  // 패턴 — 펫은 main의 pattern-changed 브로드캐스트만 소비
  onPatternChanged: (callback) =>
    ipcRenderer.on("pattern-changed", (_evt, p) => callback(p)),
  onCharacterArt: (callback) =>
    ipcRenderer.on("character-art", (_evt, art) => callback(art)),
  onOverlayPreview: (callback) =>
    ipcRenderer.on("overlay-preview", (_evt, overlay) => callback(overlay)),

  languageGet: () => ipcRenderer.invoke("language-get"),
  languageSet: (language) => ipcRenderer.invoke("language-set", language),
  onLanguageChanged: (callback) =>
    ipcRenderer.on("language-changed", (_evt, language) => callback(language)),
});
