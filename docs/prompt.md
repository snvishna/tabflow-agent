# TabFlow Agent - Rebuild Prompt

A single prompt that describes the whole product, for asking an LLM to recreate or reason about TabFlow Agent. Keep it in sync with `docs/requirements.md`.

---

**System:** You are a staff software engineer specializing in Manifest V3 browser extensions and in-browser WebAssembly inference.

**Task:** Build "TabFlow Agent", a privacy-first browser extension for Firefox and Chromium that stops duplicate tabs, groups related tabs, archives unused tabs, and finds any tab from a command palette. It must never close anything the user can't get back.

**Requirements:**
1. **Extension platform**
   - Manifest V3, one codebase for Chrome/Edge/Brave and Firefox 142+ (`browser` vs `chrome` resolved at runtime). A pack script builds per-browser ZIPs (service worker for Chromium, `background.scripts` + gecko settings for Firefox) plus a source ZIP for AMO.
   - Bundle the background script with `esbuild`; replace `eval`/`new Function` in dependencies; bundle the ONNX WASM runtime (no remote code). Never `define: { global: 'window' }` in a service worker.
2. **Duplicate prevention**
   - On `webNavigation.onBeforeNavigate`, for newly opened tabs only (never navigations inside an existing tab, never blank/new-tab/browser pages), switch to an existing tab with the same normalized URL and close the new one. Show an in-page notice with Undo.
   - Site rules: "never close" sites, and "one tab per site" sites that reuse the existing tab.
   - Optional Reflex Engine (user's API key): for a different page on an open site, ask a fast LLM to answer `REFRESH` (single-instance app) or `NEW_TAB` (distinct document); cache decisions.
   - "Close Duplicate Tabs" command with a preview; closed tabs are archived.
3. **Grouping**
   - Use `@xenova/transformers` with `all-MiniLM-L6-v2` in the service worker: embed title + hostname, cluster greedily by cosine similarity with a same-domain bonus, name each cluster. Report model download progress.
   - Optional Cognitive Engine (user's API key) returns JSON groups; fall back to local clustering on failure.
   - Return a plan first; the UI previews it (renamable groups) and only "Apply" calls `tabs.group` / `tabGroups.update`. Modes: all tabs, ungrouped only; plus Ungroup All and Consolidate All Windows.
   - Auto-group: a newly loaded tab joins the most similar existing group above a threshold (setting, on by default).
4. **Undo**: every action records how to reverse it (reopen tabs, restore a group snapshot) in `storage.session` for 30 minutes; reachable from the notice, the palette, and `Alt+Shift+U`.
5. **Archive**: archive tabs unused for N days (setting) with preview, plus an optional hourly `alarms` job. Store archived/closed tabs in IndexedDB via `Dexie.js`, pruned after 90 days; keep a 7-day activity log of every decision.
6. **Command palette**: `Ctrl+Shift+Space` (`Command+Shift+Space` on Mac) or the toolbar icon injects an `iframe` overlay with fuzzy search across open, recently closed (`sessions`) and archived tabs, keyboard navigation, `>` command mode, settings, and backup export/import. Follow the system light/dark theme.
7. **Onboarding**: on install, open a welcome page showing the shortcut (or a way to set one if taken) and a guided first organize. Optional tab-count badge on the toolbar icon.
8. **Providers**: detect Anthropic, OpenAI, Gemini or TypeSafe from the key prefix and fill default endpoint/model; allow any OpenAI-compatible endpoint and separate models per engine. Keys stay in `storage.local`; 15 s timeouts.
9. **Quality**: vanilla JS/HTML/CSS (no frameworks), pure functions in `utils.js` with `vitest` unit tests, and end-to-end tests that install the packed ZIPs in Chromium and Firefox.

Provide all files, including `manifest.json`, `build.mjs`, `scripts/pack.sh`, `src/background.js`, `src/clustering.js`, `src/autogroup.js`, `src/undo.js`, `src/db.js`, `src/utils.js`, `src/providers.js`, `src/prompts.js`, `palette.html`, `src/palette.js`, `welcome.html` and tests.
