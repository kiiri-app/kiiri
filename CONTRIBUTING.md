# Contributing to Kiiri

Thanks for helping the cat. 🐾

## Ground rules

- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Keep pull requests focused: one change per PR.

## Setup

```bash
git clone https://github.com/kiiri-app/kiiri.git
cd kiiri
npm install
npm start
```

Useful checks before you open a PR:

```bash
npm run check   # syntax-check every JS file
npm test        # unit tests (no Electron needed)
npm run smoke   # boot the app and quit
```

`KIRI_NO_DEVTOOLS=1 npm start` keeps devtools from opening on top of the pet.

## Where things live

| Path | What |
|---|---|
| `main.js` | Electron main process: windows, tray, IPC, the local bridge on `127.0.0.1:23456` |
| `renderer/` | The pet window and the small tool windows (chat, settings, automations…) |
| `ai/` | Providers, prompts, screen questions, memory, skills, TTS/STT, redaction |
| `hooks/` | Agent hooks (Claude Code, Cursor, Codex, Antigravity) and the MCP server |
| `art/`, `scripts/build-pose-sheets.py` | Character art sources → sprite strips |
| `test/` | Node test runner tests |

## Code style

- CommonJS, no build step, no framework in the renderer.
- Match the style of the file you're editing. Comments explain *why*, not *what*.
- Every user-facing string goes through i18n (en, tr, ja, ko).
- Never log or display secrets. Anything an agent sends to a speech bubble goes through `ai/redact.js`.

## Characters and art

Code contributions are MIT. If you contribute artwork, say in the PR that you made it yourself and agree to license it under MIT. Please don't submit fan art of characters owned by someone else.

## Commit messages

Short summary line, then a blank line and the details if needed. English or Turkish are both fine.
