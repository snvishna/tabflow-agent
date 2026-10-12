#!/bin/bash

# Exit on error
set -e

echo "📦 Packing TabFlow Agent for Publishing..."

# 1. Clean old zips
rm -f tabflow-chrome.zip tabflow-firefox.zip tabflow-source.zip

# 2. Build the extension
echo "🔨 Building the extension..."
cd extension
node build.mjs
cd ..

# Only runtime files go into store packages (no config.json with API keys, tests, build tooling or backups)
RUNTIME_FILES="manifest.json admin.html palette.html welcome.html icons src dist"

# 3. Create Chrome ZIP
echo "🗜️ Creating Chrome ZIP (tabflow-chrome.zip)..."
STAGE=$(mktemp -d)
cd extension
cp -r $RUNTIME_FILES "$STAGE"
cd ..
node -e "const fs = require('fs'); const f = process.argv[1]; const m = JSON.parse(fs.readFileSync(f)); delete m.background.scripts; delete m.browser_specific_settings; fs.writeFileSync(f, JSON.stringify(m, null, 2));" "$STAGE/manifest.json"
(cd "$STAGE" && zip -qr - . -x ".*" "*/.*") > tabflow-chrome.zip

# 4. Create Firefox ZIP
echo "🗜️ Creating Firefox ZIP (tabflow-firefox.zip)..."
cp extension/manifest.json "$STAGE/manifest.json"
node -e "const fs = require('fs'); const f = process.argv[1]; const m = JSON.parse(fs.readFileSync(f)); delete m.background.service_worker; m.background.scripts = ['dist/background.js']; fs.writeFileSync(f, JSON.stringify(m, null, 2));" "$STAGE/manifest.json"
(cd "$STAGE" && zip -qr - . -x ".*" "*/.*") > tabflow-firefox.zip
rm -rf "$STAGE"

# 5. Create the Source Code ZIP (Required by Firefox AMO)
echo "🗜️ Creating Source Code ZIP (tabflow-source.zip)..."
zip -r tabflow-source.zip . -x "node_modules/*" "*/node_modules/*" ".git/*" ".DS_Store" "*.zip" ".venv/*" "*/.venv/*" "*/__pycache__/*" "*/config.json" "config.json" "store-assets/*" "docs/assets/*" > /dev/null

echo "✅ Done!"
echo "➡️  tabflow-chrome.zip    : Upload this to the Chrome Web Store."
echo "➡️  tabflow-firefox.zip   : Upload this to Firefox AMO as the main package."
echo "➡️  tabflow-source.zip    : Upload this to Firefox AMO in the 'Source Code' field."
