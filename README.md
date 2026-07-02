# Kiri

![Kiri](assets/screenshot.png)

An animated character that lives on your desktop and doubles as a spatial AI
assistant — drop the character onto anything on screen and it understands the
region underneath, then summarizes, solves, explains, translates, or runs a
task you defined. It can also take voice commands, generate documents, remember
what it taught you (spaced repetition), and you can pick from Ghibli-resembling
characters or design your own.

## Features

- **Spatial AI** — drop the character onto text, a question, code, or an image
  and it captures that region, understands it with a vision model, and runs a
  task: 📝 summarize, ✅ solve, 💡 explain, 🌐 translate, 📋 extract, or your own.
- **Command agent** — "make a 5-slide presentation about X and save it" →
  approval card → a real `.pptx`/`.docx`/file under `~/Documents/Kiri/`, with a
  30-second undo. Teach reusable skills in plain language and re-run them.
- **Voice (STT)** — a mic button: click, speak, and the command runs.
- **Ask about my screen** — either hold the push-to-talk hotkey (default
  Ctrl+Alt) and ask out loud, or right-click → **Ask about my screen…** and type
  it. The cat reads your whole screen — weighted toward whatever it's sitting
  next to — answers in a speech bubble, and points at the spot with a 🐾 when it
  helps. Typed mode needs no OpenAI key, so it works on local Ollama too.
- **Multi-provider** — Claude (Anthropic), OpenAI (GPT-4o), Google Gemini, or
  **Ollama** (fully local / offline / free).
- **Knowledge Journal** — save what the character solved/explained as flashcards
  and review them on an SM-2 spaced-repetition schedule.
- **Characters** — pick Kiri or Tori, paint your own look in the pixel overlay
  editor, and run several characters at once, each with its own name, look, and
  personality.
- **Desktop companion** — follows your cursor, reacts to typing, pomodoro timer,
  and reminders.
- **Multi-language UI** — English, Türkçe, 한국어, 日本語.

## Stack

- [Electron](https://www.electronjs.org/) (main + renderer + editor windows)
- `@anthropic-ai/sdk` + OpenAI-compatible HTTP for the LLM providers
- `pptxgenjs` / `docx` for document generation
- `uiohook-napi` for global keyboard / wheel hooks
- `electron-builder` for packaged builds

## Quick start

```bash
cd kiri
npm install
npm start
```

Open the character's right-click menu → **🐾 AI Assistant…** to enable AI and
enter a provider key (or pick Ollama for a fully local, no-key setup).

### Other scripts

| Script | What it does |
| --- | --- |
| `npm start` | Run the app in dev mode. |
| `npm run smoke` | Boot the app, log a startup line, and quit (CI smoke test). |
| `npm run pack` | Build an unpacked Electron app into `dist/`. |
| `npm run dist` | Build installable artifacts for the current OS. |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Per-OS installers. |

## Privacy

- Screenshots stay in memory only and are never written to disk.
- API keys are stored encrypted (Electron `safeStorage`) and only read by the
  main process — never exposed to the renderer.
- File output is sandboxed to `~/Documents/Kiri/`; every write is approved and
  undoable.
- With the Ollama provider, everything runs locally with no network calls.

## Permissions & platform notes

- **macOS** — the typing reaction needs **Accessibility** (and sometimes **Input
  Monitoring**); voice needs **Microphone**. Grant them in
  `System Settings → Privacy & Security`.
- **Windows** — security software can block the global hook; allow it if typing
  reactions never start.
- **Linux** — global keyboard hooks may need extra udev rules on some distros.

## Docs

- [`AI-ASSISTANT.md`](AI-ASSISTANT.md) — the AI features in detail.
- [`AI-ROADMAP.md`](AI-ROADMAP.md) — design notes and roadmap.

## License

MIT — see [`License.md`](./License.md). © 2026 Ahmet Vural.
