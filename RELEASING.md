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

- **The release repo must be public** (or point `build.publish` at a public,
  releases-only repo such as `ahmetvural79/kiri-releases`) — clients cannot
  read a private repo's releases.
- **macOS only installs updates into a signed app** (Squirrel.Mac). Unsigned
  builds will download but refuse to install.

## Signing secrets (GitHub → Settings → Secrets → Actions)

### macOS — Developer ID + notarization ($99/yr Apple Developer Program)

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | base64 of the *Developer ID Application* `.p12` (`base64 -i cert.p12`) |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_ID` | Apple ID e-mail |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char team ID |

electron-builder notarizes automatically when the three `APPLE_*` values are
present. Hardened runtime + `build/entitlements.mac.plist` are already set up.

### Windows — Azure Trusted Signing (~$10/month)

Add the secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
(an app registration with the *Trusted Signing Certificate Profile Signer*
role), then add your account details to `build.win` in `package.json`:

```json
"azureSignOptions": {
  "publisherName": "Ahmet Vural",
  "endpoint": "https://weu.codesigning.azure.net",
  "codeSigningAccountName": "<account>",
  "certificateProfileName": "<profile>"
}
```

Leave it out until the account exists — with the block present but no
credentials, the Windows build fails.
