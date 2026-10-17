# TabFlow Agent: Frequently Asked Questions & Technical Architecture

A quick, sharable guide to how TabFlow Agent works under the hood, how privacy is enforced, and how to connect your own AI model.

---

### 1. How is tab grouping done under the hood?

TabFlow Agent supports two grouping modes:

- **Local on-device AI (default):** TabFlow runs a quantized open-source embedding model ([`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2), ~25 MB) inside the background service worker using WebAssembly (via ONNX runtime). It converts each tab's title and domain into a 384-dimensional mathematical vector, runs agglomerative cosine clustering with domain weighting, and labels clusters using zero-shot semantic matching against common topic categories (e.g., Development, Travel, Finance). **Zero data leaves your browser.**
- **Cognitive Engine (optional with your AI API key):** If you provide an API key (Claude, OpenAI, Gemini, or any OpenAI-compatible endpoint), TabFlow sends only tab titles and URLs to that provider. A frontier LLM generates highly contextual, bespoke group names and smart topic clusters. If the API call times out (15 s) or fails, it seamlessly falls back to the on-device model.

Crucially, **nothing moves without your consent.** TabFlow first presents an interactive preview showing the proposed groups; you can rename or tweak them, and groups are only applied when you click "Apply".

---

### 2. Can I connect my own custom AI API key (BYOK)? Which models are supported?

**Yes! Bring Your Own Key (BYOK) is fully supported.** TabFlow operates on a zero-markup, direct-to-provider model. You pay the AI provider directly for the tokens you consume (typically fractions of a cent per day).

- **Anthropic Claude:** (`sk-ant-` key) → defaults to `claude-haiku-5-5`.
- **OpenAI:** (`sk-` key) → defaults to `gpt-4.1-mini` (or `gpt-4o`, `o3-mini`, etc.).
- **Google Gemini:** (`AIza` or `AQ` key) → defaults to `gemini-3.6-flash`.
- **TypeSafe Jev:** (`apikey_` key) → fast classifier for the duplicate Reflex Engine.
- **Any OpenAI-Compatible API (Groq, Together, DeepSeek, self-hosted proxies):** Enter your custom Base URL, API key, and model name.

You can also use **Split Engines** in Settings: use a generative model (like Claude Haiku or GPT-4o-mini) for naming tab groups, and a ultra-fast model (like Jev or Groq) for instant duplicate decisions.

---

### 3. Where is data stored, and who has access to it?

**All data is stored 100% locally on your machine:**
- **IndexedDB (via Dexie.js):** Stores your 90-day tab archive and 7-day activity log. Archived tabs older than 90 days are automatically purged to prevent database bloat.
- **`chrome.storage.local`:** Stores your preferences, site rules ("never close" and "one tab only"), and encrypted-at-rest extension settings.
- **`chrome.storage.session`:** Stores undo history and short-lived decision caches. Cleared automatically whenever your browser restarts.

There are **no accounts, no telemetry, no tracking analytics, and no central servers.** The developers cannot see what tabs you open, what searches you perform, or what keys you configure.

---

### 4. How much disk and cache space will TabFlow use?

- **On-device AI weights:** ~25 MB. Downloaded once on first use from Hugging Face and cached locally in browser Cache Storage via the browser's Cache API. It is never redownloaded unless you clear browser storage.
- **IndexedDB archive & logs:** Typically under **1 MB to 2 MB** even with hundreds of archived tabs and an active 7-day log.
- **Memory footprint:** Minimal. The service worker goes dormant when you are not actively navigating or managing tabs.

---

### 5. Will TabFlow slow down my browsing or web pages?

**No.** TabFlow is engineered from the ground up for zero browsing overhead:
- **No DOM scraping or injection:** TabFlow does not inject heavy monitoring scripts into web pages.
- **Isolated palette iframe:** The command palette is an isolated `<iframe>` loaded on-demand only when you trigger the keyboard shortcut (`Ctrl+Shift+Space` or `Cmd+Shift+Space`). When closed, it is dormant.
- **Asynchronous navigation checks:** Duplicate tab prevention listens to `webNavigation.onBeforeNavigate` for *newly opened tabs only*. Navigating inside an active tab, clicking back/forward, and following links within a site have zero delay.

---

### 6. How does duplicate tab detection work without breaking normal browsing?

When you click a link or open a URL:
1. TabFlow checks if this is a **brand-new top-level tab**. Navigating inside an existing tab is never interrupted.
2. It checks against your **Site Rules** (e.g., sites marked "never close" are ignored; sites marked "single instance" like `localhost` or Webmail are deduplicated).
3. If an identical normalized URL is already open in another tab, TabFlow smoothly focuses the existing tab and closes the newly opened one.
4. An immediate, non-intrusive **Undo notification** appears on screen. If you intended to keep both tabs open, click **Undo** (or press `Alt+Shift+U`) and the second tab is restored instantly.

---

### 7. What is fuzzy search in the Command Palette?

The command palette (`Ctrl+Shift+Space` on Windows/Linux, `Cmd+Shift+Space` on Mac) searches across **active open tabs, recently closed sessions, and your 90-day archive**.

It uses **multi-term, order-agnostic matching**: typing `"invoice march"` instantly matches a tab titled `"March 2026 - Invoices & Billing"` or a URL containing `github.com/invoices/march`. It matches both page titles and web addresses, with instant keyboard navigation.

On ordinary web pages the palette appears over the page. Browsers don't let extensions draw on their own pages (the new tab page, `about:` and `chrome://` pages such as `about:debugging`, and the extension stores), so there it opens as a regular toolbar popup under the TabFlow icon instead.

---

### 8. What happens when tabs are auto-archived? Are they lost forever?

**Never.** TabFlow adheres to the rule: *never close anything you can't get back.*
- Auto-archive is **opt-in (disabled by default)**.
- If enabled, tabs untouched for your configured number of days (default: 3 days) are cleanly archived into local IndexedDB and closed to free RAM.
- Every archived tab remains searchable in the palette and restorable with a single click for **90 days**.
- Pin a tab, group it, or add the domain to your "Never Close" site rules to ensure it is never auto-archived.
