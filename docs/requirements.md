# Product Requirements Document (PRD)

## Product Vision
TabFlow Agent solves "tab bankruptcy": duplicate tabs, chaotic windows, and tabs you can't find. It keeps the browser organized as you browse, works fully on-device out of the box, and **never closes anything the user can't get back**.

## Principles
1. **Safe by default**: every action can be previewed or undone; every tab TabFlow closes is archived.
2. **Private by default**: no account, no telemetry; remote AI only with the user's own key.
3. **Keyboard first**: everything is reachable from one shortcut.

## Core Requirements

### 1. Duplicate prevention
- When a *newly opened* tab navigates to a page that is already open, switch to the existing tab and close the new one, with an Undo notice.
- Never interrupt navigation inside an existing tab; never touch blank, new-tab or browser pages; never treat different pages on the same site as duplicates unless the site is marked "one tab only" or the user's Reflex Engine decides so.
- "Close Duplicate Tabs" previews the tabs to close and archives them.

### 2. Grouping
- "Organize All Tabs" / "Organize Ungrouped Tabs" produce a plan the user can review and rename before applying, using native `tabs.group` / `tabGroups.update`.
- On-device embeddings (`all-MiniLM-L6-v2`) by default; optional generative LLM (Cognitive Engine) with the user's key.
- New tabs join a matching group automatically (setting, on by default).

### 3. Undo
- Every action (switch to existing tab, close duplicates, archive, organize, ungroup) is reversible from the notice, the palette, or `Alt+Shift+U`, for at least 30 minutes within the browser session.

### 4. Archive
- Archive tabs unused for N days (user setting), manually with preview or automatically (hourly, off by default).
- Archived and closed tabs are searchable and restorable for 90 days, then pruned.

### 5. Site rules
- "Never close" list: TabFlow never closes or redirects tabs from these sites.
- "One tab per site" list: reuse the existing tab for these sites (e.g. `localhost`, webmail).

### 6. Command palette
- `iframe` overlay with fuzzy search across open, recently closed and archived tabs; keyboard navigation; `>` command mode; light and dark theme.

### 7. Onboarding & status
- First install opens a welcome page that shows the shortcut (or a way to set one if it's taken) and walks through organizing the first window.
- Optional tab count on the toolbar icon; model download progress during the first grouping.

### 8. Optional API keys
- Settings accepts a Claude, OpenAI, Gemini or TypeSafe key and detects defaults; advanced settings accept any OpenAI-compatible endpoint and separate models for the Reflex and Cognitive engines. Keys stay in `storage.local`.

### 9. Store compliance
- MV3, no remote code (bundled WASM runtime, no `eval`), minimal permissions each justified in the store listings, Firefox source package that builds reproducibly.
