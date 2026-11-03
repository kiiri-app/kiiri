<p align="center">
  <a href="https://kiiri.app"><img src="assets/brand/lockup.svg" alt="Kiiri" height="84"></a>
</p>

<h3 align="center">A little cat that lives on your desktop.</h3>

<p align="center">
  Keeps you company, watches your coding agents, and when you ask,<br>
  looks at your screen and points at the answer.
</p>

<p align="center">
  <a href="https://kiiri.app"><b>kiiri.app</b></a> ·
  <a href="https://github.com/kiiri-app/kiiri-releases/releases/latest">Download</a> ·
  <a href="#quick-start">Build from source</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="https://github.com/kiiri-app/kiiri-releases/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/kiiri-app/kiiri-releases?color=E2673F&label=release"></a>
  <a href="License.md"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-7E9C77"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/macOS%20·%20Windows%20·%20Linux-2A2522">
  <a href="https://github.com/kiiri-app/kiiri/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/kiiri-app/kiiri/actions/workflows/ci.yml/badge.svg"></a>
</p>

<p align="center">
  <img src="docs/media/hero.gif" alt="Kiiri the cat takes notes while Claude Code works, then cheers when the task is done" width="800">
</p>

Kiiri is an animated character that lives on your desktop and doubles as a
spatial AI assistant. It reacts to Claude Code, Cursor, Codex and Antigravity
while they work, and any MCP client can make it talk, point or look at your
screen. Drop it onto anything on screen and it understands the region
underneath, then summarizes, solves, explains, translates, or runs a task you
defined. It can talk back out loud, hold a real conversation, generate
documents and spreadsheets, run things on a schedule, and remember what it did.

**Free and open source.** Bring your own key (Anthropic, OpenAI, Gemini or any
OpenAI-compatible API), or run fully local with Ollama.

> All clips below are the real app, recorded offscreen on a mock desktop.
> The voice ones have sound on [kiiri.app](https://kiiri.app/#features).

> **Kiri → Kiiri.** The project is being renamed. Some menus, folders and the
> MCP tool names (`kiri_say`, `~/Documents/Kiri/`) still use the old name and
> will keep working.

## Features

### Watches your coding agents

<table>
<tr>
<td width="50%"><img src="docs/media/duo.gif" alt="Kiri and Tori take notes while two coding agents work, then cheer when they finish"></td>
<td width="50%"><img src="docs/media/mcp.gif" alt="A coding agent makes the cat announce that all 128 tests passed"></td>
</tr>
<tr>
<td>Two agents, two cats. Each one scribbles while its agent works and cheers when it's done.</td>
<td>Over MCP, the agent itself can make Kiiri talk, point, or look at your screen.</td>
</tr>
</table>

- **Agent monitoring** — hooks for Claude Code, Cursor, Codex and Antigravity.
  The character perks up when an agent **listens**, scribbles in a notepad while
  it **works**, and beams when the task is **done**.
- **MCP server** — the same bridge, exposed to any MCP client (Claude Code,
  Cursor, …) as five tools: `kiri_status`, `kiri_say`, `kiri_point`,
  `kiri_react`, and `kiri_ask_screen` (the agent borrows Kiri's eyes: it asks
  about the user's screen and gets the answer back, while the user sees it in
  the speech bubble). It registers itself while agent monitoring is on (and removes
  itself when you turn it off), and runs on Kiri's own bundled Node runtime — no
  system `node` required. Text an agent sends is scrubbed of secrets and
  absolute paths before it reaches a speech bubble.
- **Control bridge** — a local token-guarded HTTP server (`127.0.0.1:23456`)
  lets external agents/tools drive the pet: report agent state, ask what it can
  do (`/status`), make it `/speak`, or `/point` at a screen spot (the pet looks
  there and an arrow marks it).

### Sees your screen

<table>
<tr>
<td width="50%"><img src="docs/media/ask.gif" alt="Asking the cat where the Export as PDF button is; it answers and points at the button"></td>
<td width="50%"><img src="docs/media/region-ask.gif" alt="Boxing a chart and asking about it; the cat points at the tallest bar"></td>
</tr>
<tr>
<td><b>Ask about my screen</b> — it answers in a bubble and points at the spot.</td>
<td><b>Ask about a region</b> — box exactly what you mean.</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/drop-file.gif" alt="Dropping the cat on a paragraph to translate it"></td>
<td width="50%"><img src="docs/media/ptt-voice.gif" alt="Holding Ctrl+Alt and asking out loud; the cat answers out loud"></td>
</tr>
<tr>
<td><b>Drop it on anything</b> — summarize, solve, explain, translate.</td>
<td><b>Push-to-talk</b> — hold ⌃⌥, ask, it answers out loud.</td>
</tr>
</table>

- **Spatial AI** — drop the character onto text, a question, code, or an image
  and it captures that region, understands it with a vision model, and runs a
  task: 📝 summarize, ✅ solve, 💡 explain, 🌐 translate, 📋 extract, or your own.
- **Ask about my screen** — hold the push-to-talk hotkey (default Ctrl+Alt) and
  ask out loud, or right-click → **Ask about my screen…** and type it. The answer
  **streams** into the speech bubble word by word, pointing at the spot with a 🐾
  when it helps. Typed mode needs no OpenAI key, so it works on local Ollama too.
- **Ask about a region** — right-click → **Ask about a region…**, drag a box
  around exactly what you mean, type your question, and it answers about just
  that selection (spotlight overlay, pointing 🐾, spoken reply).
- **App awareness** — answers know which app you're in (name only, e.g. "VS
  Code") so they're sharper. macOS-only, no extra permission; toggle in settings.

### Gets things done

<table>
<tr>
<td width="50%"><img src="docs/media/voice-report.gif" alt="Speaking a research request; the cat lists web sources, then writes a PDF report after approval"></td>
<td width="50%"><img src="docs/media/computer.gif" alt="Kiiri plans three steps, the user approves, it opens TextEdit and types; then it pauses before a risky Place order click"></td>
</tr>
<tr>
<td><b>Research → PDF</b> — it searches the web, shows the sources, writes after you approve.</td>
<td><b>Computer use</b> — it clicks and types for you, and stops before anything risky.</td>
</tr>
</table>

- **Command agent** — "make a 5-slide presentation about X and save it" →
  approval card → a real file under `~/Documents/Kiri/`, with a 30-second undo.
  Generates `.pptx`, `.docx`, `.xlsx` (real formatted spreadsheets), `.pdf`
  reports, `.csv`, `.json`, and text/markdown/html. It can search the web first
  and shows you the plan and sources before writing. Ships with starter skills
  (report table, meeting notes, summary doc, slide deck, CSV) and lets you teach
  your own in plain language.
- **Computer use** — "open TextEdit and type a note": Kiiri looks at the screen,
  shows a short plan, and after you approve it drives the mouse and keyboard
  while a strip shows every step. It stops and asks before sending, buying,
  deleting, typing into a password field, or acting in password managers,
  terminals or banking apps, and Esc stops it at any moment. Needs an Anthropic
  key.
- **Automations** — schedule a prompt on an interval or a daily time: a **note**
  the character speaks, or a **screen check** that looks at your screen and
  answers (bubble + 🐾 + spoken). Right-click → **Tasks ▸ Automations…**.
- **Knowledge Journal** — save what the character solved/explained as flashcards
  and review them on an SM-2 spaced-repetition schedule.

### Talks with you, and remembers

<table>
<tr>
<td width="50%"><img src="docs/media/chat.gif" alt="Chat window: the cat remembers yesterday's report"></td>
<td width="50%"><img src="docs/media/automations.gif" alt="An automation that checks in every day at 9:00"></td>
</tr>
<tr>
<td><b>Chat with memory</b> — it remembers yesterday's report.</td>
<td><b>Automations</b> — every day at 9:00, a check-in.</td>
</tr>
</table>

- **Voice commands (STT)** — a mic button: click, speak, and the command runs.
- **Spoken answers (TTS)** — the character reads screen answers aloud, using
  OpenAI voices when a key is set or the built-in macOS voice for your language
  (offline, keyless). Volume follows the notification-sound slider.
- **Chat window** — right-click → **Chat with Kiri…** for a real back-and-forth
  conversation that remembers the thread (and the character's memory). Streams,
  supports multiple turns, per-character sessions.
- **Per-character memory** — each character keeps its own history of the work it
  did (summaries, screen answers, files it made, chats) in a readable `.md`, and
  feeds recent entries back as context — so it remembers across restarts. Right-
  click → **🧠 Memory** to view, edit, or clear it.

### A cat, first of all

<table>
<tr>
<td width="50%"><img src="docs/media/drag.gif" alt="Picking the cat up by the scruff: it dangles and swings, then settles where it is dropped"></td>
<td width="50%"><img src="docs/media/cozy.gif" alt="Pomodoro cheers and stretch reminders"></td>
</tr>
<tr>
<td>Pick it up by the scruff; it dangles, swings, and settles.</td>
<td>Pomodoro cheers and stretch nudges.</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/make-it-yours.gif" alt="Renaming the cat, repainting it in the pixel editor, adding petdex pets"></td>
<td width="50%"><img src="docs/media/local.gif" alt="Wi-Fi off, running on Ollama, still answering out loud"></td>
</tr>
<tr>
<td><b>Make it yours</b> — rename, repaint, add petdex pets.</td>
<td><b>Fully local</b> — Wi-Fi off, Ollama, still talks.</td>
</tr>
</table>

- **Living animations** — the character idles with cursor-tracking eyes and
  leans toward your pointer, dangles by the scruff while you drag it (side view
  when you swing it sideways), and when it shows you something on screen it
  looks there while an arrow marks the spot.
- **Characters** — pick Kiri or Tori, paint your own look in the pixel overlay
  editor, and run several at once, each with its own name, look, and personality.
- **Desktop companion** — follows your cursor, plus a pomodoro timer,
  time/interval reminders and an optional stretch reminder.
- **Community pets** — Kiri reads the petdex / agentpets sprite-sheet format
  (`pet.json` + an 8×9 grid sheet). Anything installed with
  `npx petdex install <slug>` (or dropped into `~/.kiri/pets/`) shows up under
  right-click ▸ **Add character**, animates from the sheet, and follows Kiri's
  states (idle / waving when clicked / running while an agent works). Kiri only
  reads what you installed — it ships just its own original characters.

### Setup & control

- **Quick profiles** — one click flips the whole stack: **Local** (offline
  Ollama brain + built-in voice), **Fast** (small cloud model, no voice), or
  **Quality** (flagship model + full voice). Fine-tune anything afterwards.
- **Multi-provider** — Claude (Anthropic), OpenAI, Google Gemini, any
  OpenAI-compatible API, or **Ollama** (fully local / offline / free).
- **Multi-language UI** — English, Türkçe, 한국어, 日本語 (every window and menu).

## Stack

- [Electron](https://www.electronjs.org/) (main + renderer + editor windows)
- `@anthropic-ai/sdk` + OpenAI-compatible HTTP for the LLM providers (Anthropic
  native SDK; OpenAI / Gemini / Ollama share one chat-completions client)
- `pptxgenjs` / `docx` / `exceljs` for document & spreadsheet generation
- `uiohook-napi` for global keyboard / wheel hooks
- OpenAI HTTP for speech-to-text and text-to-speech (with a macOS `say` fallback)
- `electron-builder` for packaged builds

## Quick start

```bash
cd kiri
npm install
npm start
```

Open the character's right-click menu → **🐾 AI Assistant…** to enable AI and
enter a provider key (or pick Ollama for a fully local, no-key setup).

To keep your API keys off this machine, deploy
[kiiri-proxy](https://github.com/kiiri-app/kiiri-proxy) to your Cloudflare account
and pick **Your own proxy** as the provider. Chat, screen questions and voice
then all go through it, and the app only stores a proxy token.

### Other scripts

| Script | What it does |
| --- | --- |
| `npm start` | Run the app in dev mode. |
| `npm test` | Unit tests (Node's built-in runner, no Electron needed). |
| `npm run check` | Syntax-check every JS file. |
| `npm run smoke` | Boot the app, log a startup line, and quit (CI smoke test). |
| `npm run pack` | Build an unpacked, ad-hoc signed app into `dist/`. |
| `npm run build:poses` | Rebuild the kiri/tori sprite strips from `art/src/`. |
| `npm run dist` | Build installable artifacts for the current OS. |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Per-OS installers. |

## Privacy

- Screenshots stay in memory only and are never written to disk.
- API keys are stored encrypted (Electron `safeStorage`) and only read by the
  main process — never exposed to the renderer.
- File output is sandboxed to `~/Documents/Kiri/`; every write is approved and
  undoable.
- App awareness sends only the frontmost app's **name** (never window contents),
  needs no extra permission, and can be turned off in settings.
- The control bridge is bound to `127.0.0.1` and requires a per-machine token;
  an agent asking Kiri to look at your screen needs your OK each time (or once
  per session).
- With the Ollama provider, everything runs locally with no network calls.

## Permissions & platform notes

- Nothing is required up front; the first-run welcome explains each permission.
- **macOS** — asking about your screen needs **Screen Recording**; voice needs
  **Microphone**; hold-to-talk needs **Accessibility** (and sometimes **Input
  Monitoring**) — the global key hook only runs while hold-to-talk is on.
- **Windows** — security software can block the global hook; allow it if
  hold-to-talk never triggers.
- **Linux** — global keyboard hooks may need extra udev rules on some distros.

## Docs

- [`AI-ASSISTANT.md`](AI-ASSISTANT.md) — the AI features in detail.
- [`AI-ROADMAP.md`](AI-ROADMAP.md) — design notes and roadmap.
- [`RELEASING.md`](RELEASING.md) — tests, packaging, signing and auto-update.

## Contributing

Bug reports, ideas and pull requests are welcome. Start with
[`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: see [`SECURITY.md`](SECURITY.md).

## License

Code: MIT, see [`License.md`](./License.md). © 2026 Ahmet Vural.

The **Kiiri** name, logo and mascot (`assets/brand/`) are not covered by the MIT
license. You're welcome to use them to refer to the project, but not as the
branding of a fork or a different product.
