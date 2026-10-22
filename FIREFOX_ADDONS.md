# Firefox Add-ons (AMO) Publishing Guide

## Updating the live listing to 1.1.1

TabFlow Agent 1.1.0 is live on AMO (https://addons.mozilla.org/addon/tabflow-agent/). To ship 1.1.1:

1. `bash scripts/pack.sh` from the repo root (and `npm run test:e2e` in `extension/` with `FF_BIN` set).
2. AMO Developer Hub → TabFlow Agent → **Upload New Version** → upload `tabflow-firefox.zip`.
3. When asked whether the add-on uses a build step, answer **Yes** and upload `tabflow-source.zip`.
4. Paste the release notes and reviewer notes below.

**Release notes (1.1.1)**
> - On browser pages (new tab, about:debugging and other about: pages, addons.mozilla.org) the palette now opens as the toolbar popup instead of a separate window in the corner of the screen. The shortcut opens and closes it there too.
> - The palette no longer shows two scrollbars when it opens outside a web page.
> - Commands now appear in normal search: type "organize" to group your tabs, no ">" needed. The welcome page explains how to organize later.
> - Export Backup works from the toolbar popup; Import Backup opens a small window for the file picker.

**Notes to reviewer (1.1.1)**
> Same build as 1.1.0 (see below); no new permissions. The change uses `action.setPopup` per tab and `action.openPopup()` from the keyboard command so the palette can open on pages where content scripts are not allowed.
> Test: open about:debugging, press Ctrl+Shift+Space or click the toolbar icon; the palette opens as the toolbar popup. On https://example.com it opens over the page as before.

**Listing (Edit Product Page → Describe Add-on)**: keep in sync with `CHROMEWEBSTORE.md`. AMO renders a subset of Markdown/HTML.
- Summary (max 250 characters):
  > Stops duplicate tabs, groups related tabs by topic, and finds any open, closed or archived tab from one shortcut. Runs on a private on-device AI model, with optional Claude, OpenAI or Gemini keys. Undo for everything.
- Description: the "Detailed Description" from `CHROMEWEBSTORE.md`.
- Categories: Tabs, Search Tools. Homepage: https://snvishna.github.io/tabflow-agent/. Support: https://github.com/snvishna/tabflow-agent/issues
- Screenshots: `store-assets/1-5*.png` with the captions in `CHROMEWEBSTORE.md`.

**Release notes (1.1.0, for reference)**
> - Undo for everything: closing duplicates, archiving, organizing and switching to an already-open tab can all be undone (notice, palette, or Alt+Shift+U).
> - Preview before applying: see proposed groups (and rename them) or the tabs that would be closed before anything changes.
> - Duplicate handling now only applies to newly opened tabs and never closes different pages on the same site; closed duplicates are archived.
> - New tabs join a matching tab group automatically (can be turned off).
> - Site rules: sites to never close, and sites to keep to one tab.
> - Choose after how many days unused tabs are archived, with optional automatic archiving.
> - Welcome page, tab count on the toolbar icon, light and dark theme, download progress for the on-device AI model.
> - The on-device AI runtime is now bundled instead of loaded from a CDN.

**Notes to reviewer (1.1.0, build instructions still current)**
> Build from the source ZIP with Node.js 22 and npm 10+: `cd extension && npm ci && node build.mjs`.
> This bundles `src/background.js` (and its imports: Dexie, @xenova/transformers) into `dist/background.js` with esbuild, and copies the ONNX Runtime WebAssembly files `ort-wasm.wasm` and `ort-wasm-simd.wasm` from `node_modules/@xenova/transformers/dist/` into `dist/`. All other files (`src/*.js`, `*.html`, `src/*.css`) are shipped unmodified.
> `build.mjs` replaces two `eval`/`new Function` patterns in the bundled dependencies with safe equivalents, because they are not allowed in MV3.
> No remote code is loaded. The only network requests are: the weights of the open-source `Xenova/all-MiniLM-L6-v2` text-embedding model from huggingface.co on first use (data, cached by the browser), and, only if the user enters their own API key, the AI provider they chose.
> Test without any account: open https://example.com in two new tabs (the second switches to the first, with an Undo notice), press Ctrl+Shift+Space to open the palette, and type > for commands.

Publishing TabFlow Agent to the Mozilla Add-ons (AMO) store requires a slightly different process than the Chrome Web Store. Fortunately, the codebase is already compatible out-of-the-box (our `manifest.json` includes the required `browser_specific_settings.gecko.id` property).

## 1. Prerequisites

1. Create a [Firefox Developer Account](https://addons.mozilla.org/en-US/developers/).
2. Ensure you have the final release build of your extension.

## 2. Source Code Submission Requirement (Crucial)

Unlike Google, Mozilla strictly enforces open-source verification for any extension that uses minified, bundled, or compiled code (which our `build.mjs` script produces).

**When you submit to AMO, you MUST provide two ZIP files:**
1. **The Extension ZIP:** The standard `dist/` or root zip containing the actual extension to be installed.
2. **The Source Code ZIP:** A complete snapshot of your codebase (including `package.json`, `build.mjs`, and all `src/` files) so Mozilla reviewers can independently build and verify the code.

*If you do not provide the Source Code ZIP, your extension will be rejected during the manual review phase.*

## 3. Submission Steps

1. Navigate to the [AMO Developer Hub](https://addons.mozilla.org/en-US/developers/addon/submit/).
2. Click **Submit a New Add-on**.
3. Choose **On this site** (to list it publicly on the AMO store).
4. **Upload the Extension ZIP** when prompted. AMO will run an automated linter. Ignore warnings about Manifest V3 (Firefox supports MV3, but their linter sometimes flags it as newer).
5. **Upload the Source Code ZIP** in the specific field provided for "Source Code" during the submission wizard.
6. Provide build instructions in the "Notes to Reviewer" field.
   
   Use the reviewer notes from "Updating the live listing" above.

## 4. Store Listing Differences from Chrome

* **Descriptions:** Firefox allows Markdown in their detailed description! You do not need to strip out formatting like you do for Chrome.
* **Privacy Policy:** Required just like Chrome. You can link to the hosted `PRIVACY_POLICY.md`.
* **Permissions:** AMO reviewers are generally stricter about the `<all_urls>` permission. You must explicitly justify that the extension is a "Command Palette" that must overlay on *any* site the user is currently browsing, and that deduplication requires monitoring all navigation events.

## 5. Review Timeline

Firefox reviews are typically faster than Chrome (often 24-48 hours), but because we require a source code compilation check, expect the first review to take up to 3-5 days. Subsequent updates will be much faster.
