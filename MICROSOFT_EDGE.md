# Publishing TabFlow Agent to Microsoft Edge Add-ons

Edge is Chromium-based and uses the same Manifest V3 package as Chrome: upload `tabflow-chrome.zip` (built by `bash scripts/pack.sh`, which strips the Firefox-only `browser_specific_settings`). Run `npm run test:e2e` in `extension/` first.

## Step 1: Register as an Edge developer
Registration is free.

1. Go to the [Microsoft Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
2. Sign in with a **personal Microsoft account** (work/school accounts can't register for extension publishing).
3. Complete the registration form with your publisher name and wait for verification (a few hours to a day).

## Step 2: Create the extension and upload
1. **Create new extension** → upload `tabflow-chrome.zip`.
2. Do not upload the Firefox ZIP or the source ZIP; Edge only asks for source if a reviewer requests it.

## Step 3: Store listing
Reuse the copy from [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md):

- **Name:** TabFlow Agent
- **Short description:** Stops duplicate tabs, groups related tabs, and finds any open, closed or archived tab from one keyboard shortcut.
- **Description:** the "Detailed Description" from `CHROMEWEBSTORE.md`.
- **Category:** Productivity
- **Logo:** `extension/icons/icon-128.png` (1:1; Edge recommends 300×300, 128×128 is the minimum).
- **Screenshots:** the five 1280×800 images in `store-assets/`, with the captions from `CHROMEWEBSTORE.md`.
- **Small promotional tile (440×280):** not created yet.
- **Search terms:** tab manager, duplicate tabs, tab groups, organize tabs, archive tabs, command palette, AI
- **Website:** https://snvishna.github.io/tabflow-agent/
- **Support:** https://github.com/snvishna/tabflow-agent/issues

## Step 4: Privacy
1. **Privacy policy URL:** https://github.com/snvishna/tabflow-agent/blob/main/PRIVACY_POLICY.md
2. **Permissions:** use the justification table in `CHROMEWEBSTORE.md` (same permissions).
3. **Remote code:** none. The WebAssembly AI runtime is bundled; the only network requests are the one-time download of the open-source embedding model from huggingface.co (data) and, only if the user adds their own key, calls to the AI provider they chose.

## Step 5: Notes for certification
> No account, login or API key is needed; every feature works with the free on-device AI.
> 1. After installing, a welcome page opens. Click "Preview groups", then "Apply groups". Click "Undo" to restore.
> 2. Open https://example.com in a tab, then open it again in a new tab: TabFlow switches to the first tab and shows an Undo notice.
> 3. Press Ctrl+Shift+Space (or click the toolbar icon) on any web page to open the palette. Type > for commands.
> 4. The first grouping downloads a small AI model (about 25 MB) once; progress is shown in the preview.
> No data is collected by the publisher. Tab titles and URLs are only sent to an AI provider if the user enters their own API key for it.

Then **Submit**. Certification usually takes 3 to 7 business days. Every update needs a higher `version` in `manifest.json`.
