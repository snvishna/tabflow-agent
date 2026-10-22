# TabFlow Agent: Publishing Strategy

TabFlow Agent uses only browser APIs and IndexedDB (no native binaries), so users need zero setup. One codebase ships to every store.

## Where it's listed

| Store | Package | Status | Guide |
|---|---|---|---|
| Firefox Add-ons (AMO) | `tabflow-firefox.zip` + `tabflow-source.zip` | Live (1.1.0; 1.1.1 ready to upload): [listing](https://addons.mozilla.org/addon/tabflow-agent/) | [FIREFOX_ADDONS.md](../FIREFOX_ADDONS.md) |
| Chrome Web Store | `tabflow-chrome.zip` | Live (1.1.0; 1.1.1 ready to upload): [listing](https://chromewebstore.google.com/detail/tabflow-agent/mcejjnakabmfflpbjbffajjbooclihbg) | [CHROMEWEBSTORE.md](../CHROMEWEBSTORE.md) |
| Microsoft Edge Add-ons | `tabflow-chrome.zip` | Not yet submitted (Edge users can install from the Chrome Web Store) | [MICROSOFT_EDGE.md](../MICROSOFT_EDGE.md) |

## Release checklist

1. Bump `version` in `extension/manifest.json` and `extension/package.json`.
2. `bash scripts/pack.sh` from the repo root: builds once and writes `tabflow-chrome.zip`, `tabflow-firefox.zip` and `tabflow-source.zip` (runtime files only, no `config.json`).
3. `cd extension && CHROME_BIN=... FF_BIN=... npm run test:e2e`: installs the packed ZIPs in Chromium and Firefox and runs the end-to-end suites.
4. Update the listing copy, release notes and reviewer notes in the store guides; refresh `store-assets/` screenshots if the UI changed (and copy them to `docs/assets/` for the website).
5. Upload to each store using its guide.

## Positioning

> Stops duplicate tabs, groups related tabs, and finds any open, closed or archived tab from one shortcut. Private on-device AI, undo for everything.

Lead with safety ("never closes anything you can't get back") and privacy ("on-device by default, bring your own key if you want"). See [LAUNCH_STRATEGY.md](../LAUNCH_STRATEGY.md) for launch posts.
