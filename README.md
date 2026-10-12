# 🌌 TabFlow Agent

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange.svg)](https://addons.mozilla.org/addon/tabflow-agent/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest: V3](https://img.shields.io/badge/Manifest-V3-success.svg)](extension/manifest.json)

**TabFlow Agent keeps your browser tidy while you work, and never closes anything you can't get back.** It stops duplicate tabs, groups related tabs by topic, and finds any open, closed or archived tab from one keyboard shortcut. Everything runs on your device by default.

🌐 **Website:** https://snvishna.github.io/tabflow-agent/ · 🦊 **Firefox:** [addons.mozilla.org/addon/tabflow-agent](https://addons.mozilla.org/addon/tabflow-agent/) · Chrome Web Store and Edge Add-ons listings coming soon (until then, [install from source](#-install-from-source))

![The TabFlow command palette searching open, closed and archived tabs](store-assets/1-search-tabs.png)

---

## ✨ Features

- **🧠 No duplicate tabs**: open a page that is already open and TabFlow switches to the existing tab, with an Undo notice. Only newly opened tabs are affected; browsing inside a tab is never interrupted, and different pages on the same site stay separate.
- **🌱 Grouping with preview**: "Organize All Tabs" proposes named groups by topic; rename any of them, then apply. Nothing changes until you do. New tabs join a matching group automatically (can be turned off).
- **↶ Undo anything**: closing duplicates, archiving, organizing and switching to an already-open tab can all be undone from the notice, the palette, or `Alt+Shift+U`.
- **🔍 Command palette**: `Ctrl+Shift+Space` (`Cmd+Shift+Space` on Mac), or the toolbar icon, searches open, recently closed and archived tabs. Type `>` for commands.
- **📦 Archive, don't lose**: archive tabs unused for N days (you choose), by hand or automatically. Every tab TabFlow closes stays searchable and restorable for 90 days.
- **📏 Site rules**: sites TabFlow must never close, and sites that should only ever have one tab (e.g. `localhost`, your webmail).
- **👋 Welcome page, tab-count badge, light & dark theme**, model download progress, activity log, and backup export/import.

| Duplicate switched, with Undo | Preview groups before applying |
|---|---|
| ![Already open notice with Undo](store-assets/3-duplicate-undo.png) | ![Group preview](store-assets/2-preview-groups.png) |
| **Commands, in light or dark** | **Guided first run** |
| ![Command palette in dark mode](store-assets/4-commands-dark.png) | ![Welcome page](store-assets/5-welcome.png) |

---

## 🛡️ Privacy and AI

**Free and private by default.** Duplicate detection is a local URL match plus your site rules. Grouping uses a small open-source text-embedding model ([`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2), about 25 MB) that runs in your browser: it is downloaded once from huggingface.co on first use and cached. No account, no telemetry, nothing sent to us.

**Optional: bring your own API key.** In **Settings**, paste a Claude, OpenAI, Gemini or TypeSafe key; TabFlow detects the provider and fills in a default endpoint and model. Advanced settings take any OpenAI-compatible endpoint (e.g. Groq) and let you use a different model for each engine:

- **Cognitive Engine (grouping)**: a generative model names and organizes your tabs into groups.
- **Reflex Engine (duplicates)**: when a new tab opens a different page on a site you already have open, a fast model decides whether to reuse the existing tab (single-instance apps like dashboards or webmail) or keep both (products, docs, search). Decisions are cached.

With a key set, only tab titles and URLs are sent, and only to the provider you chose. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

---

## ⌨️ Shortcuts & Commands

- **Open palette**: `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows/Linux), or click the toolbar icon.
- **Undo last action**: `Alt+Shift+U`.
- Change shortcuts in the palette under **Settings → Toolbar & Shortcuts**, or at `chrome://extensions/shortcuts` / Firefox's **Manage Extension Shortcuts**. If a shortcut is already taken, the welcome page and Settings show "Not set" with a button to pick another.

Inside the palette, type `>` for commands:
- `✨ Organize All Tabs (AI Magic)` and `🌱 Organize Ungrouped Tabs` (with preview)
- `🧹 Close Duplicate Tabs` (with preview)
- `📦 Archive Unused Tabs` (with preview; the number of days is a setting)
- `💥 Ungroup All Tabs`, `🗂️ Consolidate All Windows`, `♻️ Recover Last Archived`, `↶ Undo Last Action`
- `💾 Export Backup` / `📥 Import Backup`, `⚙️ Settings`, `👋 Welcome, Tips & Shortcuts`

**Settings → Activity Log** shows every decision TabFlow made in the last 7 days, with search (and, with an API key, token usage and model confidence).

---

## 🚀 Install from source

Requires Node.js 22 and npm 10+.

```bash
git clone https://github.com/snvishna/tabflow-agent.git
cd tabflow-agent/extension
npm ci
npm run build          # bundles src/background.js into dist/ with esbuild
```

**Chrome / Edge / Brave:**
1. Open `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

**Firefox (142+):** install from [AMO](https://addons.mozilla.org/addon/tabflow-agent/), or for development run `bash scripts/pack.sh` from the repo root, open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `tabflow-firefox.zip`.

---

## 🛠️ Architecture & Development

- **UI**: vanilla JS, HTML and CSS. The palette is an isolated `iframe` overlay; light and dark themes share `src/theme.css`.
- **Background**: an MV3 service worker (`src/background.js`) handles navigation events, grouping, archiving, undo and the badge. No remote code: the WebAssembly AI runtime is bundled.
- **Storage**: IndexedDB via `Dexie.js` for the 90-day archive and 7-day activity log; `storage.local` for settings; `storage.session` for undo history.
- **Cross-browser**: one codebase; `scripts/pack.sh` produces the Chrome/Edge and Firefox packages from the same manifest.

More detail in [docs/architecture.md](docs/architecture.md) and [docs/requirements.md](docs/requirements.md).

### Running tests
```bash
cd extension
npm test                                       # unit tests (vitest)
CHROME_BIN=... FF_BIN=... npm run test:e2e     # installs the packed ZIPs in Chromium and Firefox
```
See [`extension/e2e/README.md`](extension/e2e/README.md). Run the end-to-end suites before every store submission.

### Packaging for the stores
```bash
bash scripts/pack.sh   # tabflow-chrome.zip, tabflow-firefox.zip, tabflow-source.zip
```
Store listing copy lives in [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md), [FIREFOX_ADDONS.md](FIREFOX_ADDONS.md) and [MICROSOFT_EDGE.md](MICROSOFT_EDGE.md); screenshots are in `store-assets/`. The website is `docs/` (GitHub Pages).

## 📜 License
[MIT](LICENSE)
