# Launch & Social Media Strategy: TabFlow Agent

A launch plan for TabFlow Agent 1.1, aimed at developer-productivity, browser-enthusiast and privacy-minded communities.

Links to use everywhere:
- Website: https://snvishna.github.io/tabflow-agent/
- Firefox: https://addons.mozilla.org/addon/tabflow-agent/
- Chrome Web Store: https://chromewebstore.google.com/detail/tabflow-agent/mcejjnakabmfflpbjbffajjbooclihbg
- Source: https://github.com/snvishna/tabflow-agent

---

## 1. Core narrative
**The problem:** we open the same docs, dashboards and tickets over and over, lose track of what's open, and are afraid to close anything in case we need it.
**The solution:** TabFlow keeps your tabs tidy while you browse: no duplicate tabs, related tabs grouped by topic, and one shortcut to find any open, closed or archived tab.
**The hook:** *"A tab manager that never closes anything you can't get back."* Every action has a preview or an Undo, and every closed tab is archived for 90 days.
**The privacy angle:** on-device AI by default, no account, no telemetry. Bring your own Claude, OpenAI or Gemini key only if you want sharper group names.

## 2. Product Hunt

**Tagline:** Duplicate-free, organized tabs, with undo for everything.

**Maker's comment:**
> Hey Product Hunt! 👋 I built TabFlow Agent because my browser was a graveyard of duplicate tickets, docs and dashboards, and I was scared to close any of it.
>
> **What it does**
> - **No duplicate tabs:** open a page you already have open and TabFlow switches you to it, with an Undo button.
> - **Grouping with a preview:** "Organize All Tabs" proposes groups by topic. Rename them, then apply. New tabs join the right group on their own.
> - **One shortcut for everything:** Ctrl/Cmd+Shift+Space searches every open, closed and archived tab. Type > for commands.
> - **Undo anything:** from the notice, the palette, or Alt+Shift+U. Closed tabs stay restorable for 90 days.
> - **Private by default:** a small AI model runs in your browser. Add your own API key only if you want to.
>
> Free and open source. I'd love feedback on the defaults: what should TabFlow do (or never do) automatically?

## 3. X / Bluesky thread

**1 (hook + video):**
> I fixed the most annoying thing about browsing: duplicate tabs, and the fear of closing anything.
>
> TabFlow Agent: no duplicates, auto-grouped tabs, one shortcut to find any tab, and Undo for everything. Free, open source, on-device AI. 🧵
> [30-second video: open a duplicate → switched with Undo; preview groups → apply; palette search finds an archived tab]

**2 (duplicates):**
> Open a page you already have open and TabFlow takes you to the existing tab. Changed your mind? Hit Undo. It only acts on newly opened tabs, never on browsing inside a tab.

**3 (grouping):**
> "Organize All Tabs" shows you the proposed groups first. Rename any of them, then apply. New tabs you open later slot into the matching group.

**4 (safety):**
> Nothing is lost. Every action can be undone, and anything TabFlow closes is archived and searchable for 90 days.

**5 (privacy + links):**
> Grouping runs on a small AI model in your browser. No account, no tracking. Bring your own Claude/OpenAI/Gemini key if you want, and only that provider sees your tab titles.
> 🌐 Chrome: [link] · 🦊 Firefox: [link] · 🐙 [GitHub]

## 4. Hacker News (Show HN)

**Title:** Show HN: TabFlow – on-device tab dedupe and grouping, with undo for everything

**Body:**
> I kept opening the same docs and tickets in new tabs, and kept 100+ tabs open because closing them felt risky. TabFlow is a MV3 extension (Firefox and Chromium) that:
>
> - intercepts `webNavigation.onBeforeNavigate` for *newly opened* tabs only, and switches to an existing tab on an exact URL match (with an Undo notice);
> - groups tabs with `all-MiniLM-L6-v2` embeddings running in WASM inside the service worker (bundled runtime, no remote code), with a preview step before anything changes;
> - archives everything it closes to IndexedDB for 90 days, searchable from a command palette;
> - optionally uses your own LLM key: a fast model decides "same app, reuse the tab" vs. "different document, keep both", and a stronger one names groups.
>
> Source is MIT on GitHub. I'd love feedback on the duplicate heuristics and on what should be automatic vs. opt-in.

## 5. Reddit

**Subreddits:** `r/chrome_extensions`, `r/firefox`, `r/browsers`, `r/productivity`, `r/SideProject`, `r/privacy` (lead with on-device).
**Tone:** plain and specific; lead with "free, open source, on-device, undo for everything". Mention API keys only as an optional extra: Reddit is skeptical of AI wrappers, and TabFlow doesn't need one.
