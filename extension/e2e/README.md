# End-to-end tests

These tests install the **packed store ZIPs** (exactly what you upload) into real
Chromium and Firefox and drive the extension: installation, duplicate handling,
undo, previews, auto-grouping, site rules, the welcome page and the badge.
Run them before every store submission.

```bash
cd extension
npm install
CHROME_BIN=/path/to/chrome FF_BIN=/path/to/firefox npm run test:e2e
# or only one browser:
CHROME_BIN=/path/to/chrome npm run test:e2e -- chrome
```

- `CHROME_BIN`: a Chrome or Chromium executable that still supports loading unpacked
  extensions from automation (Chromium or Chrome for Testing; branded Chrome 137+ does not).
- `FF_BIN`: a Firefox 142+ executable.

The tests open real websites (example.com, MDN, IANA, Wikipedia), so they need network access.
The palette and welcome page UI checks run in Chromium only, because Firefox automation
cannot open extension pages.
