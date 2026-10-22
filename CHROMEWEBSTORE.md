# Chrome Web Store Listing — TabFlow Agent

> Last Updated: 2026-10-22 · Current version: **1.1.1**
> Upload `tabflow-chrome.zip` (built by `scripts/pack.sh`). Run `npm run test:e2e` in `extension/` first.

## Store Listing

**Extension Name** [REQUIRED]
TabFlow Agent

**Short Description** [REQUIRED] (max 132 characters)
Stops duplicate tabs, groups related tabs, and finds any open, closed or archived tab from one keyboard shortcut.

**Detailed Description** [REQUIRED]
TabFlow Agent keeps your browser tidy while you work, and never closes anything you cannot get back.

NO MORE DUPLICATE TABS
Open a page you already have open and TabFlow switches you to the existing tab instead of adding another one. A notice with an Undo button appears, so you stay in control. "Close Duplicate Tabs" cleans up a window in one step and shows you exactly which tabs will close first.

TABS THAT ORGANIZE THEMSELVES
"Organize All Tabs" proposes tab groups by topic (Travel, Development, News…). You see the groups first, can rename any of them, and nothing changes until you apply. New tabs you open later join a matching group automatically.

ONE SHORTCUT TO FIND ANY TAB
Press Ctrl+Shift+Space (Cmd+Shift+Space on Mac), or click the toolbar icon, to search every open tab, recently closed tab and archived tab. Commands show up as you type (try "organize"), or type > to list them all.

UNDO ANYTHING
Every change TabFlow makes can be undone: from the notice, from the top of the palette, or with Alt+Shift+U.

ARCHIVE, DON'T LOSE
Tabs you have not used for a few days (you choose how many) can be archived: they close, but stay searchable and restorable for 90 days.

YOUR RULES
Choose sites that TabFlow must never close, and sites where you only ever want one tab.

PRIVATE BY DEFAULT
Grouping and duplicate detection run on your device with a small AI model. Tab titles and addresses only leave your device if you choose to add your own Claude, OpenAI or Gemini API key, and then only go to that provider. No account, no tracking, no data collected by us.

Works in light and dark mode. Free and open source: https://github.com/snvishna/tabflow-agent

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Helps you manage open browser tabs: preventing and closing duplicate tabs, grouping related tabs, archiving unused tabs, and finding any tab from a keyboard-driven search palette.

**Primary Language** [REQUIRED]
English

## Test Instructions for Reviewers (Developer Dashboard → "Test instructions")

> No account, login or API key is needed; every feature works with the free on-device AI.
> 1. After installing, a welcome page opens. Click "Preview groups" to see proposed tab groups for the current window, then "Apply groups". Click "Undo" to restore.
> 2. Open https://example.com in a tab. Open a new tab (Ctrl+T) and go to https://example.com again: TabFlow switches to the first tab and shows "Already open — switched to your open tab" with an Undo button.
> 3. Press Ctrl+Shift+Space (or click the toolbar icon) on any web page to open the palette and search your tabs. Type "organize" to find "Organize All Tabs", or > to list every command.
> 4. On a browser page such as chrome://extensions or the new tab page, the same shortcut or icon opens the palette as the toolbar popup (browsers don't allow extensions to draw on their own pages).
> 5. The first grouping downloads a small AI model (about 25 MB) once; progress is shown in the preview.

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `extension/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ✅ Ready | `store-assets/1-search-tabs.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ✅ Ready | `store-assets/2-preview-groups.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 | ✅ Ready | `store-assets/3-duplicate-undo.png` |
| Screenshot 4 | 1280×800 | ✅ Ready | `store-assets/4-commands-dark.png` |
| Screenshot 5 | 1280×800 | ✅ Ready | `store-assets/5-welcome.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Captions
1. Find any tab (open, closed or archived) from one shortcut.
2. Preview tab groups before applying; rename any group.
3. Already open? TabFlow switches to your existing tab, with Undo.
4. Every command a keystroke away, in light or dark mode.
5. A guided first run shows your shortcut and organizes your first window.

Screenshots are taken over a neutral demo page (no third-party branding or ads). Regenerate them from the latest build before major UI changes.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `tabs` | permissions | Reads the URL and title of open tabs to find duplicates, propose groups, archive unused tabs and list tabs in the search palette. |
| `tabGroups` | permissions | Creates, names and colors tab groups when the user applies a grouping, adds new tabs to matching groups, and restores groups on Undo. |
| `storage` | permissions | Saves the user's settings (archive days, site rules, optional API keys) and temporary undo history. |
| `webNavigation` | permissions | Detects when a newly opened tab is about to load a page the user already has open, so TabFlow can switch to the existing tab, and when a new tab has loaded so it can join a matching group. |
| `alarms` | permissions | Runs the optional hourly auto-archive check (off by default), which archives tabs unused for longer than the number of days the user chose. |
| `scripting` | permissions | Shows the command palette overlay and the small "Undo" notice on the page the user is viewing. |
| `activeTab` | permissions | Gives access to the current tab when the user presses the shortcut or clicks the toolbar icon, to open the palette there. |
| `sessions` | permissions | Lists recently closed tabs in the palette search so the user can reopen them. |
| `<all_urls>` | host_permissions | The palette and Undo notice must be able to appear over whatever page the user is on, and duplicate detection must work on every site. Page content is never read. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes (web history, processed on the device; see table)

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | | No |
| Health info | No | No | | No |
| Financial info | No | No | | No |
| Authentication info | Yes | No | Optional API keys the user enters are stored locally to call the user's own AI provider. | No |
| Personal communications | No | No | | No |
| Location | No | No | | No |
| Web history | Yes | Only if the user adds an API key | Tab URLs and titles are used on the device to find duplicates and group tabs; tabs TabFlow closes are archived locally for 90 days. With a user-provided API key, URLs and titles are sent to that AI provider only. | Only to the AI provider the user configures |
| User activity | No | No | | No |
| Website content | No | No | | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/snvishna/tabflow-agent/blob/main/PRIVACY_POLICY.md

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
*To be determined*

**Contact Email** [REQUIRED]
*To be determined*

**Support URL / Email** [RECOMMENDED]
https://github.com/snvishna/tabflow-agent/issues

**Homepage URL** [RECOMMENDED]
https://github.com/snvishna/tabflow-agent

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-10-04 | Initial release featuring Reflex deduplication and Cognitive grouping. | Rejected (Yellow Magnesium) |
| 1.0.1 | 2026-10-12 | Fixes install failure on Windows/Linux (invalid keyboard shortcut), stops blank/new-tab pages being closed as duplicates, bundles the local AI runtime instead of loading it from a CDN, drops the unused `alarms` permission, and trims the package to runtime files only. | Superseded by 1.1.0 (not submitted) |
| 1.1.0 | 2026-10-12 | Everything in 1.0.1, plus: duplicate handling only for new tabs, never closes different pages on the same site, archives everything it closes; Undo for every action (notice, palette, Alt+Shift+U); preview before organizing, closing duplicates or archiving; auto-group new tabs; per-site rules; configurable archive days with optional auto-archive (`alarms` is back and used); welcome page; tab-count badge; light/dark theme; model download progress. | Live |
| 1.1.1 | 2026-10-22 | On browser pages (new tab page, chrome://, about:, extension stores) the palette now opens as the toolbar popup instead of a separate, oddly placed window; the standalone palette has a single scrollbar; plain search also finds commands (type "organize"); the welcome page explains how to organize later; Export Backup works from the standalone palette. No permission changes. | Ready to submit |

## Review Notes

### Known Issues / Limitations
- The first grouping or near-duplicate check downloads the on-device model (~25 MB) from huggingface.co; it is cached afterwards.
- Browsers leave a shortcut unassigned if something else already uses it; the welcome page and Settings then show "Not set" with a button to choose one.

### Rejection History
- **2026-10-05, v1.0.0, Yellow Magnesium (Not providing promised functionality)**: the package failed automated installation testing on Linux. Cause: the `toggle-palette` command used `MacCtrl+Shift+Space` as its `default` shortcut; `MacCtrl` is only valid under the `mac` key, so Chrome refused to install the extension on Windows/Linux. Fixed in 1.0.1 (`default` is now `Ctrl+Shift+Space`). Also fixed: duplicate detection closed a second blank/new tab, the ONNX WASM runtime was fetched from cdn.jsdelivr.net (remote code), and the ZIP contained build tooling, tests and a manifest backup. 1.1.0 was verified by installing the packed ZIPs in Chromium and Firefox on Linux and running the end-to-end suites in `extension/e2e/`.

## Privacy Practices Justifications

When submitting to the Chrome Web Store, you will be prompted to provide justifications for the permissions requested in `manifest.json`. You can copy and paste the following responses exactly as written.

### Permission Justifications
- **activeTab**: "Gives access to the current tab when the user presses the TabFlow shortcut or clicks the toolbar icon, so the command palette can open over that page."
- **alarms**: "Used only for the optional auto-archive feature: once an hour it archives tabs the user has not visited for longer than the number of days they set in TabFlow settings. It is off until the user enables it."
- **<all_urls> / host permission**: "The command palette and the Undo notice must be able to appear over whatever page the user is viewing, and duplicate-tab detection must work on every site. TabFlow reads tab URLs and titles only; it never reads page content."
- **scripting**: "Injects the command palette overlay (content.js) and the small Undo notice into the page the user is viewing."
- **sessions**: "Lists the user's recently closed tabs in the palette search so they can be reopened."
- **storage**: "Stores user settings (archive days, site rules, optional AI provider and API key) and short-lived undo history. Archived tabs are kept in local IndexedDB for 90 days."
- **tabGroups**: "Creates, names and colors tab groups when the user applies a proposed grouping, adds new tabs to a matching group, and restores the previous groups on Undo."
- **tabs**: "Reads the URLs and titles of open tabs to find duplicates, propose groups, archive unused tabs and list tabs in the search palette."
- **webNavigation**: "Detects when a newly opened tab is about to load a page that is already open (to switch to the existing tab instead) and when a new tab has finished loading (to add it to a matching group)."

### Remote Code Use
- **Are you using remote code?** No.
- **Justification**: "This extension does not execute any remote code; all JavaScript and the WebAssembly AI runtime are bundled in the package. The only download is the weights of an open-source text-embedding model (data, not code) from huggingface.co on first use. If the user adds their own API key, tab URLs and titles are sent to that AI provider over HTTPS. No data is collected by the publisher."

### Single Purpose Description
- **Single Purpose Description**: "TabFlow Agent helps users manage their open browser tabs: preventing and closing duplicate tabs, grouping related tabs, archiving unused tabs, and finding any tab from a keyboard-driven search palette."
