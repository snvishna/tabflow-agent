# Chrome Web Store Listing — TabFlow Agent

> Last Updated: 2026-10-04

## Store Listing

**Extension Name** [REQUIRED]
TabFlow Agent

**Short Description** [REQUIRED]
Automatically groups related tabs and aggressively prevents duplicate URLs to keep your browser organized using AI.

**Detailed Description** [REQUIRED]
TabFlow Agent is a background assistant that intelligently manages your browser tabs so you never feel overwhelmed. It automatically prevents you from opening duplicate links and smartly organizes your messy browser window into clean, topical groups. 

Simply browse the web as usual, and the extension will quietly detect if you navigate to a URL that you already have open, instantly refocusing you on the existing tab instead of creating clutter. When you need to find something, hit the keyboard shortcut to open the command palette, where your tabs are cleanly clustered into semantic groups using local or remote AI models. 

Your data privacy is fully respected. The extension uses robust local fallback mechanisms to group tabs locally if you prefer, or integrates with your own provided API keys for advanced remote processing.

If you encounter any issues, you can report them to our GitHub repository.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Automatically manages and deduplicates browser tabs using AI to reduce clutter and keep your workspace organized.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | 🟡 Needs update | `extension/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 5 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1**: Show the browser with dozens of messy tabs, then an arrow pointing to a cleanly organized window with 5 neat Tab Groups.
- **Screenshot 2**: Show the Command Palette overlay invoked on a webpage, demonstrating the AI grouping categories.
- **Screenshot 3**: Show the Advanced Settings panel, highlighting the ability to paste your own API keys.
- **Screenshot 4**: Show a notification or visual indication of a duplicate tab being intercepted and refocused.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `tabs` | permissions | Allows the extension to read the URL and title of all open tabs to detect duplicates and categorize them into semantic groups. |
| `tabGroups` | permissions | Enables the extension to physically move related tabs into color-coded browser tab groups for visual organization. |
| `storage` | permissions | Required to securely save your API configuration, settings, and local embeddings for the AI engines. |
| `webNavigation` | permissions | Allows the extension to intercept page navigation before it completes, enabling instant deduplication when you click a link you already have open. |
| `alarms` | permissions | Runs the optional hourly auto-archive check, which saves and closes tabs you have not used for longer than the number of days you choose in settings. Off by default. |
| `scripting` | permissions | Needed to inject the command palette interface directly over your active web pages so you can access it without leaving your workflow. |
| `activeTab` | permissions | Provides temporary access to the current tab when you activate the extension, allowing it to take immediate actions like closing or refreshing the active view. |
| `sessions` | permissions | Enables the extension to read your recently closed tabs, ensuring duplicate detection can also restore recently lost work if needed. |
| `<all_urls>` | host_permissions | Essential for the extension to monitor navigations and inject the command palette interface across any webpage you visit. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | | No |
| Health info | No | No | | No |
| Financial info | No | No | | No |
| Authentication info | Yes | No | API keys are stored locally on the device to authenticate with user-provided AI services. | No |
| Personal communications | No | No | | No |
| Location | No | No | | No |
| Web history | Yes | Yes | Tab URLs and titles are read and temporarily sent to user-configured AI APIs (e.g. Gemini/OpenAI) to group and deduplicate tabs. | Yes (Only to user-configured AI providers) |
| User activity | No | No | | No |
| Website content | No | No | | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
*To be generated and hosted (e.g. on GitHub Pages)*

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
| 1.0.1 | 2026-10-12 | Fixes install failure on Windows/Linux (invalid keyboard shortcut), stops blank/new-tab pages being closed as duplicates, bundles the local AI runtime instead of loading it from a CDN, drops the unused `alarms` permission, and trims the package to runtime files only. | Draft |

## Review Notes

### Known Issues / Limitations
- None currently known.

### Rejection History
- **2026-10-05, v1.0.0, Yellow Magnesium (Not providing promised functionality)**: the package failed automated installation testing on Linux. Cause: the `toggle-palette` command used `MacCtrl+Shift+Space` as its `default` shortcut; `MacCtrl` is only valid under the `mac` key, so Chrome refused to install the extension on Windows/Linux. Fixed in 1.0.1 (`default` is now `Ctrl+Shift+Space`). Also fixed: duplicate detection closed a second blank/new tab, the ONNX WASM runtime was fetched from cdn.jsdelivr.net (remote code), and the ZIP contained build tooling, tests and a manifest backup. The 1.0.1 package was verified by installing it in Chromium on Linux and running tab clustering end to end.

## Privacy Practices Justifications

When submitting to the Chrome Web Store, you will be prompted to provide justifications for the permissions requested in `manifest.json`. You can copy and paste the following responses exactly as written.

### Permission Justifications
- **activeTab**: "Required to inject the Command Palette overlay (iframe) into the current tab when the user triggers the keyboard shortcut or clicks the extension icon."
- **alarms**: "Used only for the optional auto-archive feature: once an hour it archives tabs the user has not visited for longer than the number of days they set in TabFlow settings. It is off until the user enables it."
- **<all_urls> / host permission**: "Required to inject the Command Palette UI over any webpage the user is currently browsing, and to read the URLs and Titles of all open tabs for AI categorization."
- **scripting**: "Required to execute the content script (`content.js`) that mounts the Command Palette iframe onto the active webpage."
- **sessions**: "Required to reliably track tab history and restore tabs from the local IndexedDB archive without losing their session context."
- **storage**: "Used to persist user settings (like the AI provider choice, API keys, and auto-archive thresholds) and to store the local IndexedDB archive of closed tabs."
- **tabGroups**: "Required to physically move and group the user's open tabs in the browser window based on the AI's semantic classification."
- **tabs**: "Required to read the URLs, titles, and IDs of currently open tabs so they can be sent to the AI for categorization and grouping."
- **webNavigation**: "Used to detect when a user navigates to a new page so the extension can automatically categorize and move the new tab into its correct semantic group in real-time."

### Remote Code Use
- **Remote Code Justification**: "This extension does not execute any remote code; its local AI runtime is bundled in the package. However, it does transmit tab URLs and titles to a remote AI API endpoint (Google Gemini or OpenAI) using the user's explicitly provided API key (Bring Your Own Key architecture). No data is collected by the publisher."

### Single Purpose Description
- **Single Purpose Description**: "TabFlow Agent is an intelligent tab manager that uses AI to automatically categorize, group, and archive open browser tabs."
