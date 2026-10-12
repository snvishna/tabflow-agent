# 🌌 TabFlow Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Manifest: V3](https://img.shields.io/badge/Manifest-V3-success.svg)](#)
[![AI Powered](https://img.shields.io/badge/AI-Powered-purple.svg)](#)

**TabFlow Agent** is a state-of-the-art, dual-engine AI browser tab manager. It doesn't just search tabs; it actively manages your entire browsing lifecycle. By combining blazing-fast reflex routing with deep generative AI, it intelligently deduplicates, routes, groups, and tracks your digital footprint.

### 🛡️ The Dual-Engine AI Architecture
Our extension is fully customizable to your privacy, cost, and performance needs:

**1. The Free Tier (Zero-Configuration, 100% Local)**
Out of the box, everything runs locally in your browser. Your tabs never leave your machine unless you provide an API key.
- **Reflex Deduplication**: Instant exact-match URL routing for new tabs, plus your "one tab per site" list (e.g. `localhost`).
- **On-device AI Grouping**: A small open-source text-embedding model (MiniLM, downloaded once and cached) clusters tabs by meaning and names the groups.

**2. The Pro Tier (Bring Your Own API Key)**
Plug in your API keys (Anthropic Claude, OpenAI, Groq, TypeSafe Jev) to unlock true Agentic capabilities:
- **The Reflex Engine**: Intercept clicks in real-time. It semantically understands the difference between comparing two Amazon products (opens new tabs) vs. clicking a dashboard link twice (refreshes existing tab). Use a low-latency endpoint like TypeSafe `jev-latest` or Groq `llama-3` for ~10ms execution!
- **The Cognitive Engine**: Use a stronger generative model (like Claude Sonnet or GPT-4.1) to group chaotic tabs into premium, logically named workspaces (e.g., "Frontend Development", "Financial Planning").
*(Note: You can split these engines in the UI! Use Groq for cheap real-time deduplication, and Anthropic for deep semantic grouping!)*

### 🕰️ The 90-Day Archive & Activity Log
- **Activity Log**: Click `⚙️ Settings -> Activity Log` to see every decision TabFlow made in the last 7 days, with search. With an API key it also shows token usage and model confidence.
- **90-Day Archive**: Tabs TabFlow closes for you (duplicates, archived tabs) are saved to a local IndexedDB so you can search and restore them; entries older than 90 days are pruned automatically.
- **God-Mode Export**: Dump your entire active and historical lifecycle into a single JSON file.

---

## ✨ Features

- **🧠 No duplicate tabs**: open a page that is already open and TabFlow switches to the existing tab, with an Undo notice. Only new tabs are affected; your browsing inside a tab is never interrupted.
- **🌱 Grouping with preview**: "Organize All Tabs" proposes named groups; rename them, then apply. New tabs join a matching group automatically.
- **↶ Undo anything**: every action can be undone from the notice, the palette, or `Alt+Shift+U`.
- **🔍 Command palette**: `Ctrl+Shift+Space` (`Cmd+Shift+Space` on Mac) searches open, recently closed and archived tabs.
- **📦 Archiving**: archive tabs unused for N days (you choose), manually or automatically; they stay searchable for 90 days.
- **📏 Site rules**: sites TabFlow must never close, and sites that should only ever have one tab.
- **👋 Welcome page, tab-count badge, light & dark theme.**

---

## 🚀 Quickstart Installation

### 1. Build the Extension
Clone the repository (or pull latest if it exists) and build the frontend:
```bash
git clone https://github.com/snvishna/tabflow-agent.git ~/scripts/tabflow-agent || git -C ~/scripts/tabflow-agent pull
cd ~/scripts/tabflow-agent/extension
npm install
npm run build
```

### 3. Load into your Browser
**Firefox (Recommended):**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `extension/manifest.json` file.

**Google Chrome / Brave / Microsoft Edge:**
1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension` folder.
4. *(Note: Because there is no Python daemon, you don't need to configure any Extension IDs. It just works!)*

---

## ⌨️ Shortcuts & Commands
- **Open Palette**: `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows/Linux), or click the toolbar icon.
- **Undo Last Action**: `Alt+Shift+U`.
- Change shortcuts in the palette under **Settings → Toolbar & Shortcuts**, or at `chrome://extensions/shortcuts` / Firefox's **Manage Extension Shortcuts**.

Inside the palette, type `>` for commands:
- `✨ Organize All Tabs (AI Magic)` and `🌱 Organize Ungrouped Tabs` (with preview)
- `🧹 Close Duplicate Tabs` (with preview)
- `📦 Archive Unused Tabs` (with preview; the number of days is a setting)
- `💥 Ungroup All Tabs`, `🗂️ Consolidate All Windows`, `♻️ Recover Last Archived`, `↶ Undo Last Action`
- `💾 Export Backup` / `📥 Import Backup`, `⚙️ Settings`, `👋 Welcome, Tips & Shortcuts`

---

## 🛠️ Architecture & Development
Built with a highly scalable, privacy-centric architecture:
- **Frontend**: Vanilla JS, HTML/CSS (Glassmorphism design, light and dark), fully MV3 compliant with no remote code: the WebAssembly AI runtime is bundled.
- **Background Agent**: Event-driven background service worker that asynchronously pipes DOM actions through your chosen LLM endpoints.
- **Storage**: Native IndexedDB via `Dexie.js` for limitless, zero-setup local archiving.
- **Testing**: `vitest` for blazing-fast unit testing of clustering logic.

### Running Tests
```bash
cd extension
npm run test                                   # unit tests (vitest)
CHROME_BIN=... FF_BIN=... npm run test:e2e     # installs the packed ZIPs in Chromium and Firefox
```
See `extension/e2e/README.md`. Run the end-to-end suites before every store submission.

### Packaging for the stores
```bash
bash scripts/pack.sh   # tabflow-chrome.zip, tabflow-firefox.zip, tabflow-source.zip
```
Store listing details live in `CHROMEWEBSTORE.md`, `FIREFOX_ADDONS.md` and `MICROSOFT_EDGE.md`; screenshots are in `store-assets/`.

## 📜 License
MIT License
