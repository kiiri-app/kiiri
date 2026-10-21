# Releasing Kiri

## Day-to-day

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (no Electron needed). |
| `npm run check` | `node --check` on every JS file. |
| `npm run smoke` | Boots the real main process once and quits. |
| `npm run pack` | Unpacked app in `dist/`, **ad-hoc signed** so it launches on Apple Silicon. |
| `npm run build:poses` | Rebuilds the kiri/tori sprite strips from `art/src/` (needs `pip install -r scripts/requirements-art.txt`). |

CI (`.github/workflows/ci.yml`) runs check + tests on every push/PR and a
macOS smoke boot.

> Keep `dist/` out of iCloud-synced folders (e.g. an iCloud Desktop): synced
> app bundles can be evicted or deleted mid-test.

## Cutting a release

1. Bump `version` in `package.json`, commit.
2. `git tag v<version> && git push --tags`.
3. `.github/workflows/release.yml` builds macOS (`dmg` + `zip`) and Windows
   (`nsis`), signs them when the secrets below exist, and publishes them with
   `latest*.yml` to a GitHub Release.

## Auto-update

`electron-updater` checks GitHub Releases (`build.publish` in `package.json`)
10 s after launch and every 6 h; the pet shows an **Update** button in its
speech bubble, downloads with progress, then restarts into the new version.
Dev runs (`npm start`) never check.

- Builds and the update feed live in the **public** repo
  [kiiri-app/kiiri-releases](https://github.com/kiiri-app/kiiri-releases), so the
  source repo can stay private and clients can still read the feed.
- **macOS only installs updates into a signed app** (Squirrel.Mac). Unsigned
  builds will download but refuse to install.

## Secrets (GitHub → kiiri-app/kiiri → Settings → Secrets → Actions)

### Publishing

| Secret | Value |
| --- | --- |
| `RELEASES_TOKEN` | fine-grained PAT, resource owner `kiiri-app`, only `kiiri-releases`, permission *Contents: Read and write* |

The built-in `GITHUB_TOKEN` cannot write to another repository.

### macOS — Developer ID + notarization ($99/yr Apple Developer Program)

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | base64 of the *Developer ID Application* `.p12` (`base64 -i cert.p12`) |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_API_KEY_P8` | contents of the App Store Connect API key `.p8` (Users and Access → Integrations → Team Keys, role *Developer*) |
| `APPLE_API_KEY_ID` | that key's ID |
| `APPLE_API_ISSUER` | the Issuer ID shown above the keys list |

The API key is the preferred way to notarize (no 2FA). Fallback: `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Hardened runtime +
`build/entitlements.mac.plist` are already set up. Builds are separate arm64 and
x64 `.dmg` files. Check a build with `spctl -a -vv /Applications/Kiiri.app`
("source=Notarized Developer ID").

### Windows — code-signing certificate

Azure Artifact Signing is **not available to us**: Public Trust certificates go
to individuals in the US/Canada and organizations in a fixed country list that
excludes Türkiye. Use a standard OV code-signing certificate instead (Certum,
SSL.com, Sectigo resellers) and set:

| Secret | Value |
| --- | --- |
| `WIN_CSC_LINK` | base64 of the `.pfx` |
| `WIN_CSC_KEY_PASSWORD` | its password |

Cloud/HSM-only certificates (SSL.com eSigner, Certum SimplySign) need their
vendor's signing step instead of `WIN_CSC_LINK`; add it when the certificate
is chosen. Until then Windows builds are unsigned and SmartScreen warns.
