import { clusterTabs, getSmartGroupName, embedText, setModelProgressListener } from './clustering.js';
import { archiveTab, getLatestArchivedTab, deleteArchivedTab, getArchivedTabs, bulkImportArchivedTabs } from './db.js';
import { PROMPTS } from './prompts.js';
import { isWebUrl, normalizeUrl, hostMatchesDomain, planExactDuplicates, planClusterClosures, selectStaleTabs, withSettingDefaults, urlMatchesDomains, cosineSimilarity } from './utils.js';
import { pickGroupForTab } from './autogroup.js';
import { defaultsForKey } from './providers.js';
import { recordUndo, peekUndo, takeUndo, describeClosedTab } from './undo.js';
import { showToast } from './toast.js';
import { refreshBadge, scheduleBadgeRefresh, flashBadge } from './badge.js';

// Unified browser API access
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let logMutex = Promise.resolve();

async function addLog(type, action, status, details) {
    console.log(`[${type}] ${action} (${status}): ${details}`);
    const log = { timestamp: Date.now(), type, action, status, details };
    
    logMutex = logMutex.then(() => {
        return new Promise((resolve) => {
            browserAPI.storage.local.get(['agent_logs'], (res) => {
                const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                let logs = res.agent_logs || [];
                
                logs.unshift(log);
                logs = logs.filter(l => (now - l.timestamp) < SEVEN_DAYS);
                if (logs.length > 1000) logs = logs.slice(0, 1000);
                
                browserAPI.storage.local.set({ agent_logs: logs }, resolve);
            });
        });
    });
    
    await logMutex;
}

// Developer convenience: seeds API keys from an unpacked extension/config.json on install.
// Store packages never include config.json, so this is a no-op for users.
async function seedConfig() {
    try {
        const res = await fetch(browserAPI.runtime.getURL('config.json'));
        if (!res.ok) return;
        const config = await res.json();
        const storage = await browserAPI.storage.local.get(['agentSettings']);
        const s = storage.agentSettings || {};
        // Only overwrite if UI settings are empty
        if (!s.cognitiveKey) {
            const defaults = defaultsForKey(config.cognitiveKey);
            const newSettings = {
                ...s,
                cognitiveKey: config.cognitiveKey || '',
                cognitiveUrl: config.cognitiveUrl || defaults.url,
                cognitiveModel: config.cognitiveModel || defaults.model,
                reflexKey: config.reflexKey || config.cognitiveKey || '',
                reflexUrl: config.reflexUrl || config.cognitiveUrl || defaults.url,
                reflexModel: config.reflexModel || config.cognitiveModel || defaults.model
            };
            await browserAPI.storage.local.set({ agentSettings: newSettings });
            console.log("[Setup] Seeded API keys from config.json");
        }
    } catch (e) { /* no config.json in store builds */ }
}

browserAPI.runtime.onInstalled.addListener((details) => {
    seedConfig();
    // First run: show the welcome page with the shortcut and a guided first organize
    if (details.reason === 'install') {
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('welcome.html') }).catch(e => console.error(e));
    }
    showTabCountSetting().then(refreshBadge);
});

// Abort slow AI calls so a new tab is never left waiting on the network
const API_TIMEOUT_MS = 15000;

async function callAgentAPI(baseUrl, apiKey, model, systemPrompt, userPrompt) {
    let url = baseUrl;
    const isAnthropic = url.includes('anthropic.com') || model.startsWith('claude-');
    const isTypesafe = url.includes('typesafe.ai');

    if (isTypesafe) {
        url = 'https://api.typesafe.ai/v1/systemone';
        
        const payload = {
            model: model,
            state: userPrompt,
            questions: {
                decision: {
                    type: "choice",
                    instructions: systemPrompt,
                    criteria: {
                        "REFRESH": "The target URL is highly similar or logically identical to the existing tab, so overwrite it.",
                        "NEW": "The target URL represents completely different content and should be opened as a new tab."
                    }
                }
            }
        };

        addLog('API', 'callAgentAPI', 'pending', `Connecting to TypeSafe URL: ${url} | Model: ${model}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
        });

        if (!response.ok) {
            const errBody = await response.text();
            const errMsg = `TypeSafe API Error: ${response.status} ${response.statusText} - ${errBody}`;
            addLog('API', 'callAgentAPI', 'error', errMsg);
            throw new Error(errMsg);
        }

        const data = await response.json();
        const choice = data.answers.decision.choice;
        const confidence = data.answers.decision.confidence;
        const t = data.tokens || data.usage || {};
        const tIn = t.input || t.prompt_tokens || 0;
        const tOut = t.output || t.completion_tokens || 0;
        const tokenMsg = (tIn > 0 || tOut > 0) ? ` | Tokens: In ${tIn}, Out ${tOut}` : '';
        addLog('API', 'callAgentAPI', 'success', `Successfully generated response from ${model}${tokenMsg}`);
        
        // Return in the JSON format the rest of the app expects
        return { action: choice, confidence: confidence, engine: "TypeSafe" };
    } else if (isAnthropic) {
        if (!url.endsWith('/v1/messages')) {
            url = url.endsWith('/') ? `${url}v1/messages` : `${url}/v1/messages`;
        }

        const payload = {
            model: model,
            system: systemPrompt,
            messages: [
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 4096
        };

        addLog('API', 'callAgentAPI', 'pending', `Connecting to Anthropic URL: ${url} | Model: ${model}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
        });

        if (!response.ok) {
            const errBody = await response.text();
            const errMsg = `Anthropic API Error: ${response.status} ${response.statusText} - ${errBody}`;
            addLog('API', 'callAgentAPI', 'error', errMsg);
            throw new Error(errMsg);
        }

        const data = await response.json();
        const content = data.content[0].text;
        const tIn = data.usage?.input_tokens || 0;
        const tOut = data.usage?.output_tokens || 0;
        const tokenMsg = (tIn > 0 || tOut > 0) ? ` | Tokens: In ${tIn}, Out ${tOut}` : '';
        addLog('API', 'callAgentAPI', 'success', `Successfully generated response from ${model}${tokenMsg}`);
        
        try {
            const jsonStr = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            parsed.engine = "Anthropic";
            return parsed;
        } catch (e) {
            try {
                const parsed = JSON.parse(content);
                parsed.engine = "Anthropic";
                return parsed;
            } catch (e2) {
                return { action: "NEW", engine: "Anthropic" };
            }
        }
    } else {
        if (!url.endsWith('/chat/completions')) {
            url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
        }

        const payload = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1
        };

        // Optionally add JSON response format if it's explicitly OpenAI, but omitting it 
        // works fine with proper prompting and maximizes compatibility with Jev/Groq
        if (url.includes('api.openai.com')) {
            payload.response_format = { type: "json_object" };
        }

        addLog('API', 'callAgentAPI', 'pending', `Connecting to OpenAI-compatible URL: ${url} | Model: ${model}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(API_TIMEOUT_MS)
        });

        if (!response.ok) {
            const errBody = await response.text();
            const errMsg = `OpenAI API Error: ${response.status} ${response.statusText} - ${errBody}`;
            addLog('API', 'callAgentAPI', 'error', errMsg);
            throw new Error(errMsg);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        const tIn = data.usage?.prompt_tokens || 0;
        const tOut = data.usage?.completion_tokens || 0;
        const tokenMsg = (tIn > 0 || tOut > 0) ? ` | Tokens: In ${tIn}, Out ${tOut}` : '';
        addLog('API', 'callAgentAPI', 'success', `Successfully generated response from ${model}${tokenMsg}`);
        
        try {
            const jsonStr = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            parsed.engine = "OpenAI-Compatible";
            return parsed;
        } catch (e) {
            try {
                const parsed = JSON.parse(content);
                parsed.engine = "OpenAI-Compatible";
                return parsed;
            } catch (e2) {
                return { action: "NEW", engine: "OpenAI-Compatible" };
            }
        }
    }
}

// --- Toolbar badge & feedback ---
async function showTabCountSetting() {
    return (await getSettings()).showTabCount;
}

for (const event of [browserAPI.tabs.onCreated, browserAPI.tabs.onRemoved, browserAPI.tabs.onAttached, browserAPI.tabs.onDetached, browserAPI.windows.onFocusChanged]) {
    event.addListener(() => scheduleBadgeRefresh(showTabCountSetting));
}
browserAPI.runtime.onStartup.addListener(() => showTabCountSetting().then(refreshBadge));

/**
 * Tells the user what just happened: an in-page toast with Undo, plus a short badge flash.
 * On pages that block the toast (browser pages) the badge shows ↶ so Undo is discoverable.
 */
async function announce(message, { undoId = null, windowId = null, badge = null } = {}) {
    const shown = await showToast(message, { undoId, windowId });
    if (badge) await flashBadge(badge, '#248a3d', showTabCountSetting);
    else if (!shown && undoId) await flashBadge('↶', '#0a84ff', showTabCountSetting);
}

// Share model download progress with any open TabFlow page (palette, welcome)
let lastProgressSent = 0;
setModelProgressListener(({ percent, done }) => {
    const now = Date.now();
    if (!done && now - lastProgressSent < 250) return;
    lastProgressSent = now;
    browserAPI.runtime.sendMessage({ action: 'model_progress', percent, done }).catch(() => { /* no page listening */ });
});

async function openShortcutSettings() {
    if (browserAPI.commands.openShortcutSettings) {
        await browserAPI.commands.openShortcutSettings(); // Firefox
    } else {
        await browserAPI.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
}

// --- Smart Tab Reuse & Deduplication Router ---
/** All settings with defaults applied (see withSettingDefaults). */
async function getSettings() {
    const { agentSettings } = await browserAPI.storage.local.get(['agentSettings']);
    return withSettingDefaults(agentSettings);
}

async function safeRemoveTab(tabId) {
    try { await browserAPI.tabs.remove(tabId); } catch (e) { /* ignore already closed */ }
}

async function safeUpdateTab(tabId, props) {
    try { await browserAPI.tabs.update(tabId, props); } catch (e) { /* ignore */ }
}

async function safeFocusWindow(windowId) {
    try { await browserAPI.windows.update(windowId, { focused: true }); } catch (e) { /* ignore */ }
}

// Duplicate detection only applies to *new* tabs: a tab is "fresh" from creation until its
// first web page commits. Navigating inside an existing tab (links, form posts) is never touched.
// Kept in session storage so it survives service worker restarts.
const FRESH_TABS_KEY = 'freshTabs';
let sessionMapMutex = Promise.resolve();

/** Serialized read-modify-write of an object stored in session storage. */
function updateSessionMap(key, mutator) {
    const run = sessionMapMutex.then(async () => {
        const res = await browserAPI.storage.session.get([key]);
        const map = res[key] || {};
        const result = mutator(map);
        await browserAPI.storage.session.set({ [key]: map });
        return result;
    });
    sessionMapMutex = run.catch(e => console.error(`Updating ${key} failed:`, e));
    return run;
}

function updateFreshTabs(mutator) {
    return updateSessionMap(FRESH_TABS_KEY, mutator).catch(() => {});
}

async function isFreshTab(tabId) {
    await sessionMapMutex;
    const res = await browserAPI.storage.session.get([FRESH_TABS_KEY]);
    return Boolean((res[FRESH_TABS_KEY] || {})[tabId]);
}

// Tabs reopened by the browser's session restore at startup are not "new" tabs
const STARTUP_GRACE_MS = 10000;

browserAPI.runtime.onStartup.addListener(() => {
    browserAPI.storage.session.set({ browserStartedAt: Date.now() });
});

browserAPI.tabs.onCreated.addListener(async (tab) => {
    const { browserStartedAt } = await browserAPI.storage.session.get(['browserStartedAt']);
    if (browserStartedAt && Date.now() - browserStartedAt < STARTUP_GRACE_MS) return;
    updateFreshTabs(fresh => { fresh[tab.id] = Date.now(); });
});

browserAPI.tabs.onRemoved.addListener((tabId) => {
    updateFreshTabs(fresh => { delete fresh[tabId]; });
});

browserAPI.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0 || !isWebUrl(details.url)) return;
    updateFreshTabs(fresh => { delete fresh[details.tabId]; });
});

// URLs reopened by Undo must not be deduplicated straight away again
const DEDUPE_BYPASS_KEY = 'dedupeBypass';
const DEDUPE_BYPASS_MS = 15000;

async function addDedupeBypass(urls) {
    const res = await browserAPI.storage.session.get([DEDUPE_BYPASS_KEY]);
    const bypass = res[DEDUPE_BYPASS_KEY] || {};
    const now = Date.now();
    for (const [k, expiry] of Object.entries(bypass)) if (expiry < now) delete bypass[k];
    for (const u of urls) bypass[normalizeUrl(u)] = now + DEDUPE_BYPASS_MS;
    await browserAPI.storage.session.set({ [DEDUPE_BYPASS_KEY]: bypass });
}

async function isDedupeBypassed(url) {
    const res = await browserAPI.storage.session.get([DEDUPE_BYPASS_KEY]);
    const expiry = (res[DEDUPE_BYPASS_KEY] || {})[normalizeUrl(url)];
    return Boolean(expiry && expiry > Date.now());
}

/**
 * Focuses `existing` instead of the new tab, optionally loading `targetUrl` into it,
 * and offers an Undo that reopens the new tab (and restores the existing tab's page).
 */
async function redirectToExistingTab(newTabId, existing, targetUrl, reason) {
    let newTab = null;
    try { newTab = await browserAPI.tabs.get(newTabId); } catch (e) { /* already gone */ }
    if (targetUrl) await safeUpdateTab(existing.id, { url: targetUrl, active: true });
    else await safeUpdateTab(existing.id, { active: true });
    await safeFocusWindow(existing.windowId);
    await safeRemoveTab(newTabId);

    const closed = describeClosedTab({ ...(newTab || {}), url: targetUrl || existing.url, windowId: newTab ? newTab.windowId : existing.windowId });
    const undoId = await recordUndo({
        kind: 'close',
        label: 'Reopen the tab TabFlow switched away from',
        tabs: [closed],
        restoreUrls: targetUrl ? [{ tabId: existing.id, url: existing.url }] : []
    });
    await announce(`${reason} — switched to your open tab.`, { undoId, windowId: existing.windowId });
}

// Cache AI duplicate decisions so the same pair of pages never costs a second API call
const REFLEX_CACHE_KEY = 'reflexCache';
const REFLEX_CACHE_MAX = 200;

async function getCachedReflexDecision(cacheKey) {
    const res = await browserAPI.storage.session.get([REFLEX_CACHE_KEY]);
    return (res[REFLEX_CACHE_KEY] || {})[cacheKey] || null;
}

async function cacheReflexDecision(cacheKey, decision) {
    const res = await browserAPI.storage.session.get([REFLEX_CACHE_KEY]);
    const cache = res[REFLEX_CACHE_KEY] || {};
    cache[cacheKey] = decision;
    const keys = Object.keys(cache);
    if (keys.length > REFLEX_CACHE_MAX) {
        for (const k of keys.slice(0, keys.length - REFLEX_CACHE_MAX)) delete cache[k];
    }
    await browserAPI.storage.session.set({ [REFLEX_CACHE_KEY]: cache });
}

browserAPI.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only intercept top-level frame navigations
    if (details.frameId !== 0) return;

    try {
        const targetUrlStr = details.url;

        // Only deduplicate real web pages; blank, new-tab and browser pages must never be closed
        if (!isWebUrl(targetUrlStr)) return;
        if (!(await isFreshTab(details.tabId))) return;
        if (await isDedupeBypassed(targetUrlStr)) return;

        const targetUrl = new URL(targetUrlStr);
        const s = await getSettings();
        // Per-site rule: never close tabs from these sites
        if (urlMatchesDomains(targetUrlStr, s.neverClose)) return;
        
        // 1. Check for basic host match across existing tabs
        const existingTabs = await browserAPI.tabs.query({});
        const hostMatches = existingTabs.filter(tab => {
            if (tab.id === details.tabId) return false;
            try { return new URL(tab.url).hostname === targetUrl.hostname; } 
            catch { return false; }
        });

        if (hostMatches.length === 0) return; // No potential duplicates

        // We have tabs on the same domain. Sort to get the most recent one.
        hostMatches.sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

        // 2. Exact Duplicate Prevention (always runs, free)
        const exactMatch = hostMatches.find(tab => normalizeUrl(tab.url) === normalizeUrl(targetUrlStr));
        if (exactMatch) {
            addLog('DECISION', 'Deduplication', 'success', `Exact duplicate found for ${targetUrlStr} (Local Engine | Match: 100%). Redirecting focus.`);
            await redirectToExistingTab(details.tabId, exactMatch, null, 'Already open');
            return;
        }
        const match = hostMatches[0];

        // 3. Reflex Engine Deduplication (if configured)
        if (s.reflexUrl && s.reflexKey && s.reflexModel) {
            const systemPrompt = PROMPTS.DEDUPLICATION_AGENT;
            const userPrompt = `EXISTING TAB URL: ${match.url}\nEXISTING TAB TITLE: ${match.title}\n\nTARGET NEW URL: ${targetUrlStr}`;
            const cacheKey = `${normalizeUrl(match.url)}|${normalizeUrl(targetUrlStr)}`;
            
            try {
                let decision = await getCachedReflexDecision(cacheKey);
                if (decision) {
                    addLog('DECISION', 'Reflex Engine', 'success', `Decision: ${decision.action} (cached) for target: ${targetUrlStr}`);
                } else {
                    decision = await callAgentAPI(s.reflexUrl, s.reflexKey, s.reflexModel, systemPrompt, userPrompt);
                    await cacheReflexDecision(cacheKey, { action: decision.action, confidence: decision.confidence, engine: decision.engine });

                    const scoreText = decision.confidence ? ` | Confidence: ${(decision.confidence * 100).toFixed(1)}%` : '';
                    const engineText = decision.engine ? ` (${decision.engine}${scoreText})` : '';
                    addLog('DECISION', 'Reflex Engine', 'success', `Decision: ${decision.action}${engineText} for target: ${targetUrlStr}`);
                }
                
                if (decision.action === "REFRESH") {
                    await redirectToExistingTab(details.tabId, match, targetUrlStr, 'Reused a similar tab');
                }
            } catch (err) {
                addLog('DECISION', 'Reflex Engine', 'error', `Failed to deduplicate: ${err.message}`);
                console.error("Reflex Engine Error:", err);
            }
            return;
        }

        // 4. Free Local Fallback (Single-Instance Domains)
        const isSingleInstance = s.singleInstance.some(d => hostMatchesDomain(targetUrl.hostname, d));
        if (isSingleInstance) {
            addLog('DECISION', 'Local Fallback', 'success', `Single-instance domain matched. Updating tab ${match.id} to new path: ${targetUrlStr}`);
            await redirectToExistingTab(details.tabId, match, targetUrlStr, `One tab per ${targetUrl.hostname}`);
        }
    } catch (error) {
        console.error("Error processing navigation:", error);
    }
});

// --- Stale Tab Archiving ---
const AUTO_ARCHIVE_ALARM = 'auto-archive';

async function getArchiveDays() {
    return (await getSettings()).archiveAfterDays;
}

/** Tabs that would be archived right now (see selectStaleTabs). */
async function planStaleTabs(query = {}) {
    const { archiveAfterDays: days, neverClose } = await getSettings();
    const tabs = (await browserAPI.tabs.query(query)).filter(t => !urlMatchesDomains(t.url, neverClose));
    return { days, tabs: selectStaleTabs(tabs, Date.now(), days) };
}

/**
 * Saves tabs to the local archive and closes them, recording one undo entry.
 * Tabs that were closed in the meantime are skipped.
 * @returns {Promise<{count: number, undoId: string|null}>}
 */
async function archiveAndCloseTabs(tabIds, label) {
    const closed = [];
    const closedIds = [];
    for (const id of tabIds) {
        let tab;
        try { tab = await browserAPI.tabs.get(id); } catch (e) { continue; }
        const archivedId = await archiveTab(tab);
        closed.push(describeClosedTab(tab, archivedId));
        closedIds.push(id);
    }
    if (closed.length === 0) return { count: 0, undoId: null };
    try { await browserAPI.tabs.remove(closedIds); } catch (e) { /* some already closed */ }
    const undoId = await recordUndo({ kind: 'close', label, tabs: closed });
    return { count: closed.length, undoId };
}

/**
 * Archives tabs unused for longer than the user's threshold. Never touches the
 * active, pinned or audible tabs.
 * @returns {Promise<number>} number of tabs archived
 */
async function archiveStaleTabs(query = {}) {
    const { days, tabs } = await planStaleTabs(query);
    if (tabs.length === 0) return 0;
    const { count, undoId } = await archiveAndCloseTabs(tabs.map(t => t.id), `Restore ${tabs.length} archived tab${tabs.length === 1 ? '' : 's'}`);
    addLog('DECISION', 'Archive Stale Tabs', 'success', `Archived ${count} tabs unused for more than ${days} days.`);
    if (count > 0) await announce(`Archived ${count} tab${count === 1 ? '' : 's'} unused for ${days}+ days.`, { undoId, badge: `−${count}` });
    return count;
}

async function syncAutoArchiveAlarm(settings) {
    if (settings.autoArchive) {
        const existing = await browserAPI.alarms.get(AUTO_ARCHIVE_ALARM);
        if (!existing) await browserAPI.alarms.create(AUTO_ARCHIVE_ALARM, { periodInMinutes: 60 });
    } else {
        await browserAPI.alarms.clear(AUTO_ARCHIVE_ALARM);
    }
}

browserAPI.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTO_ARCHIVE_ALARM) {
        archiveStaleTabs({}).catch(e => console.error("Auto-archive failed:", e));
    }
});

// --- Command Palette Listeners ---
function openPalette() {
    browserAPI.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
        if (!tabs || tabs.length === 0) {
            console.error("No active tab found to inject palette.");
            // Fallback for unexpected empty tabs list
            browserAPI.windows.create({
                url: browserAPI.runtime.getURL('palette.html'),
                type: 'popup',
                width: 600,
                height: 450
            });
            return;
        }
        
        if (tabs[0]) {
            const url = tabs[0].url || "";
            // Check if URL is restricted (new tab pages, extension pages, settings)
            if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('file://')) {
                const width = 600;
                const height = 450;
                browserAPI.windows.getCurrent().then(win => {
                    const left = win && win.width ? Math.round((win.width - width) / 2 + win.left) : 200;
                    const top = win && win.height ? Math.round((win.height - height) / 2 + win.top) : 200;
                    browserAPI.windows.create({
                        url: browserAPI.runtime.getURL('palette.html'),
                        type: 'popup',
                        width: width,
                        height: height,
                        left: left,
                        top: top
                    });
                }).catch(e => {
                    browserAPI.windows.create({
                        url: browserAPI.runtime.getURL('palette.html'),
                        type: 'popup',
                        width: width,
                        height: height
                    });
                });
                return;
            }

            try {
                await browserAPI.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['src/content.js']
                });
            } catch (err) {
                console.error("Failed to inject palette, likely restricted page:", err);
                // Fallback for unexpected restricted pages
                browserAPI.windows.create({
                    url: browserAPI.runtime.getURL('palette.html'),
                    type: 'popup',
                    width: 600,
                    height: 450
                });
            }
        }
    }).catch(err => {
        console.error("Query active tab failed:", err);
    });
}

browserAPI.commands.onCommand.addListener((command) => {
    if (command === "toggle-palette") {
        openPalette();
    } else if (command === "undo-last-action") {
        undoAction().then(done => {
            if (!done) announce('Nothing to undo.');
        }).catch(e => console.error("Undo failed:", e));
    }
});

if (browserAPI.action) {
    browserAPI.action.onClicked.addListener(() => {
        openPalette();
    });
}

// --- API Message Listeners ---
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'get_all_tabs') {
        Promise.all([
            browserAPI.tabs.query({}),
            getArchivedTabs(),
            browserAPI.sessions ? browserAPI.sessions.getRecentlyClosed() : Promise.resolve([])
        ]).then(([activeTabs, archivedTabs, closedSessions]) => {
            activeTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
            const closedTabs = [];
            closedSessions.forEach(session => {
                if (session.tab) {
                    closedTabs.push({
                        sessionId: session.tab.sessionId,
                        title: session.tab.title,
                        url: session.tab.url,
                        favIconUrl: session.tab.favIconUrl,
                        timestamp: session.lastModified * 1000
                    });
                }
            });
            sendResponse({ activeTabs, archivedTabs, closedTabs });
        });
        return true;
    }
    if (message.action === 'switch_to_tab') {
        browserAPI.tabs.update(message.tabId, { active: true });
        browserAPI.windows.update(message.windowId, { focused: true });
        return false;
    }

    if (message.action === 'get_settings') {
        getSettings().then(settings => sendResponse(settings));
        return true;
    }

    if (message.action === 'save_settings') {
        browserAPI.storage.local.get(['agentSettings']).then(async (result) => {
            // Merge so settings saved from one screen never wipe fields owned by another
            const merged = withSettingDefaults({ ...(result.agentSettings || {}), ...message.settings });
            await browserAPI.storage.local.set({ agentSettings: merged });
            await syncAutoArchiveAlarm(merged);
            await refreshBadge(merged.showTabCount);
            sendResponse({ status: 'success' });
        }).catch(error => sendResponse({ status: 'error', error: error.message }));
        return true;
    }
    
    if (message.action === 'consolidate_windows') {
        browserAPI.tabs.query({}).then(async (tabs) => {
            const currentWindow = await browserAPI.windows.getCurrent();
            const tabIdsToMove = tabs.filter(t => t.windowId !== currentWindow.id).map(t => t.id);
            if (tabIdsToMove.length > 0) {
                await browserAPI.tabs.move(tabIdsToMove, { windowId: currentWindow.id, index: -1 });
            }
            sendResponse({ status: 'success', moved: tabIdsToMove.length });
        });
        return true;
    }
    
    // Planning actions return a preview; apply actions perform it and record an undo entry.
    const respond = (promise) => {
        promise.then(result => sendResponse({ status: 'success', ...result }))
            .catch(error => {
                console.error(`${message.action} failed:`, error);
                sendResponse({ status: 'error', error: error.message });
            });
        return true;
    };

    if (message.action === 'plan_dedupe') {
        return respond(getTargetWindowId(sender).then(planDuplicates));
    }
    if (message.action === 'apply_dedupe') {
        return respond(applyDuplicateClosures(message.tabIds || []));
    }
    if (message.action === 'deduplicate_tabs') {
        return respond(getTargetWindowId(sender).then(async windowId => {
            const plan = await planDuplicates(windowId);
            await applyDuplicateClosures(plan.tabs.map(t => t.id));
            return {
                exactClosed: plan.tabs.filter(t => t.reason === 'exact').length,
                semanticClosed: plan.tabs.filter(t => t.reason === 'near').length
            };
        }));
    }
    if (message.action === 'ungroup_all') {
        return respond(getTargetWindowId(sender).then(async windowId => {
            const snapshot = await snapshotGroups(windowId);
            const grouped = (await browserAPI.tabs.query({ windowId })).filter(isGrouped).map(t => t.id);
            if (grouped.length > 0 && browserAPI.tabs.ungroup) {
                await browserAPI.tabs.ungroup(grouped);
                const undoId = await recordUndo({ kind: 'grouping', label: 'Restore your tab groups', windowId, snapshot });
                await announce(`Ungrouped ${grouped.length} tab${grouped.length === 1 ? '' : 's'}.`, { undoId, windowId });
            }
            return { ungrouped: grouped.length };
        }));
    }
    if (message.action === 'plan_grouping') {
        return respond(getTargetWindowId(sender).then(windowId => planGrouping(windowId, message.mode === 'leaf' ? 'leaf' : 'force')).then(plan => ({ plan })));
    }
    if (message.action === 'apply_grouping') {
        return respond(applyGroupPlan(message.plan));
    }
    if (message.action === 'cluster_tabs_force' || message.action === 'cluster_tabs_leaf') {
        const mode = message.action === 'cluster_tabs_leaf' ? 'leaf' : 'force';
        return respond(getTargetWindowId(sender).then(async windowId => {
            const plan = await planGrouping(windowId, mode);
            const result = await applyGroupPlan(plan);
            return { ...result, groups: plan.groups };
        }));
    }
    if (message.action === 'plan_archive') {
        return respond(getTargetWindowId(sender).then(async windowId => {
            const { days, tabs } = await planStaleTabs({ windowId });
            return { days, tabs: tabs.map(summarizeTab) };
        }));
    }
    if (message.action === 'apply_archive') {
        return respond((async () => {
            const days = await getArchiveDays();
            const { count, undoId } = await archiveAndCloseTabs(message.tabIds || [], 'Restore archived tabs');
            if (count > 0) await announce(`Archived ${count} tab${count === 1 ? '' : 's'} unused for ${days}+ days.`, { undoId, badge: `−${count}` });
            return { archivedCount: count, undoId };
        })());
    }
    if (message.action === 'archive_stale_tabs') {
        return respond(getTargetWindowId(sender).then(windowId => archiveStaleTabs({ windowId })).then(archivedCount => ({ archivedCount })));
    }
    if (message.action === 'open_shortcut_settings') {
        return respond(openShortcutSettings().then(() => ({})));
    }
    if (message.action === 'open_palette') {
        openPalette();
        return false;
    }
    if (message.action === 'open_welcome') {
        return respond(browserAPI.tabs.create({ url: browserAPI.runtime.getURL('welcome.html') }).then(() => ({})));
    }
    if (message.action === 'get_undo') {
        return respond(peekUndo().then(entry => ({ entry: entry ? { id: entry.id, label: entry.label, createdAt: entry.createdAt } : null })));
    }
    if (message.action === 'undo') {
        return respond(undoAction(message.id).then(done => {
            if (!done) throw new Error('Nothing to undo');
            return {};
        }));
    }

    if (message.action === 'get_archived_tabs') {
        Promise.all([
            getArchivedTabs(),
            browserAPI.sessions ? browserAPI.sessions.getRecentlyClosed() : Promise.resolve([])
        ]).then(([archivedTabs, closedSessions]) => {
            const closedTabs = [];
            closedSessions.forEach(session => {
                if (session.tab) {
                    closedTabs.push({
                        sessionId: session.tab.sessionId,
                        title: session.tab.title,
                        url: session.tab.url,
                        favIconUrl: session.tab.favIconUrl,
                        timestamp: session.lastModified * 1000
                    });
                }
            });
            sendResponse({ tabs: archivedTabs, closedTabs: closedTabs });
        });
        return true;
    }

    if (message.action === 'restore_closed_tab') {
        if (browserAPI.sessions && message.sessionId) {
            browserAPI.sessions.restore(message.sessionId);
        }
        sendResponse({ status: 'success' });
        return true;
    }

    if (message.action === 'restore_archived_tab') {
        browserAPI.tabs.create({ url: message.url }).then(() => {
            deleteArchivedTab(message.dbId);
        });
        sendResponse({ status: 'success' });
        return true;
    }

    if (message.action === 'recover_last_archived') {
        getLatestArchivedTab().then(async tabData => {
            if (tabData) {
                await browserAPI.tabs.create({ url: tabData.url });
                await deleteArchivedTab(tabData.id);
                sendResponse({ status: 'success', restored: tabData.url });
            } else {
                sendResponse({ status: 'success', restored: null });
            }
        });
        return true;
    }
});

// --- Native Tab Grouping ---
const GROUP_COLORS = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

function isGrouped(tab) {
    return typeof tab.groupId === 'number' && tab.groupId !== -1;
}

function summarizeTab(tab) {
    return { id: tab.id, title: tab.title || tab.url, url: tab.url, favIconUrl: tab.favIconUrl || '' };
}

/**
 * The normal window an action applies to: the tab hosting the palette, or the last
 * focused normal window when the palette runs in its own popup.
 */
async function getTargetWindowId(sender) {
    if (sender && sender.tab && sender.tab.windowId >= 0) {
        try {
            const win = await browserAPI.windows.get(sender.tab.windowId);
            if (win.type === 'normal') return win.id;
        } catch (e) { /* fall through */ }
    }
    try {
        const win = await browserAPI.windows.getLastFocused({ windowTypes: ['normal'] });
        return win.id;
    } catch (e) {
        return browserAPI.windows.WINDOW_ID_CURRENT;
    }
}

/**
 * Proposes tab groups for a window without changing anything.
 * mode 'force' regroups every tab; 'leaf' only places ungrouped tabs.
 * @returns {Promise<{windowId, mode, groups: {title, color, tabIds}[], tabs: object}>}
 */
async function planGrouping(windowId, mode) {
    const tabs = await browserAPI.tabs.query({ windowId });
    // Pinned tabs cannot live in groups; blank, new-tab and browser pages stay ungrouped
    let targetTabs = tabs.filter(t => !t.pinned && isWebUrl(t.url));
    if (mode === 'leaf') targetTabs = targetTabs.filter(t => !isGrouped(t));

    const plan = { windowId, mode, groups: [], tabs: {} };
    targetTabs.forEach(t => { plan.tabs[t.id] = summarizeTab(t); });
    if (targetTabs.length <= 1) return plan;

    const s = await getSettings();
    let clusters = null;

    // 1. Cognitive Engine (user's own AI key)
    if (s.cognitiveUrl && s.cognitiveKey && s.cognitiveModel) {
        try {
            const tabsJson = JSON.stringify(targetTabs.map(t => ({ id: t.id, url: t.url, title: t.title })));
            const response = await callAgentAPI(s.cognitiveUrl, s.cognitiveKey, s.cognitiveModel, PROMPTS.GROUPING_AGENT, `INPUT TABS TO CLASSIFY:\n${tabsJson}`);
            if (Array.isArray(response)) {
                clusters = response.map(group => ({
                    tabs: targetTabs.filter(t => (group.tabIds || []).includes(t.id)),
                    name: group.groupName
                })).filter(c => c.tabs.length > 0);
                addLog('DECISION', 'Cognitive Engine', 'success', `Grouped ${targetTabs.length} tabs into ${clusters.length} categories.`);
            }
        } catch (err) {
            addLog('DECISION', 'Cognitive Engine', 'error', `Failed to group: ${err.message}. Falling back to local math.`);
            console.error("Cognitive Engine failed, falling back to local math:", err);
        }
    }

    // 2. Free local fallback
    if (!clusters) {
        clusters = await clusterTabs(targetTabs);
        addLog('DECISION', 'Local Fallback', 'success', `Used text embeddings to group ${targetTabs.length} tabs into ${clusters.length} categories.`);
    }

    // Name clusters and merge clusters that end up with the same name
    const byTitle = new Map();
    for (const cluster of clusters) {
        let title = cluster.name || (cluster.embeddings ? await getSmartGroupName(cluster.embeddings) : null);
        if (!title) {
            title = cluster.tabs.length > 1 ? (extractHost(cluster.tabs[0].url) || 'Group') : 'Misc';
        }
        if (!byTitle.has(title)) byTitle.set(title, []);
        byTitle.get(title).push(...cluster.tabs.map(t => t.id));
    }
    // Tabs the AI left out still need a home
    const placed = new Set([...byTitle.values()].flat());
    const leftovers = targetTabs.filter(t => !placed.has(t.id)).map(t => t.id);
    if (leftovers.length) byTitle.set('Misc', [...(byTitle.get('Misc') || []), ...leftovers]);

    let colorIdx = 0;
    for (const [title, tabIds] of byTitle) {
        if (title === 'Misc') continue;
        plan.groups.push({ title, color: GROUP_COLORS[colorIdx++ % GROUP_COLORS.length], tabIds: [...new Set(tabIds)] });
    }
    if (byTitle.has('Misc')) plan.groups.push({ title: 'Misc', color: 'grey', tabIds: [...new Set(byTitle.get('Misc'))] });
    return plan;
}

function extractHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/** Records the window's current grouping so it can be restored by Undo. */
async function snapshotGroups(windowId) {
    const tabs = await browserAPI.tabs.query({ windowId });
    const groups = browserAPI.tabGroups ? await browserAPI.tabGroups.query({ windowId }) : [];
    return {
        tabs: tabs.map(t => ({ id: t.id, groupId: isGrouped(t) ? t.groupId : -1 })),
        groups: groups.map(g => ({ id: g.id, title: g.title || '', color: g.color, collapsed: Boolean(g.collapsed) }))
    };
}

async function restoreGroups(windowId, snapshot) {
    const live = await browserAPI.tabs.query({ windowId });
    const liveIds = new Set(live.map(t => t.id));
    const grouped = live.filter(isGrouped).map(t => t.id);
    if (grouped.length) await browserAPI.tabs.ungroup(grouped);
    for (const g of snapshot.groups) {
        const tabIds = snapshot.tabs.filter(t => t.groupId === g.id && liveIds.has(t.id)).map(t => t.id);
        if (!tabIds.length) continue;
        try {
            const groupId = await browserAPI.tabs.group({ tabIds, createProperties: { windowId } });
            await browserAPI.tabGroups.update(groupId, { title: g.title, color: g.color, collapsed: g.collapsed });
        } catch (e) { console.error("Restoring group failed:", e); }
    }
}

/**
 * Applies a grouping plan (possibly edited in the preview) and offers Undo.
 * Tabs closed since the plan was made are skipped.
 */
async function applyGroupPlan(plan) {
    if (!plan || !browserAPI.tabs.group) return { grouped: 0, undoId: null };
    const windowId = plan.windowId;
    const snapshot = await snapshotGroups(windowId);
    const live = await browserAPI.tabs.query({ windowId });
    const liveIds = new Set(live.filter(t => !t.pinned && isWebUrl(t.url)).map(t => t.id));

    if (plan.mode === 'force') {
        const grouped = live.filter(isGrouped).map(t => t.id);
        if (grouped.length && browserAPI.tabs.ungroup) await browserAPI.tabs.ungroup(grouped);
    }

    const existing = browserAPI.tabGroups ? await browserAPI.tabGroups.query({ windowId }) : [];
    const groupByTitle = {};
    existing.forEach(g => { if (g.title) groupByTitle[g.title] = g.id; });

    let grouped = 0;
    for (const group of plan.groups) {
        const tabIds = group.tabIds.filter(id => liveIds.has(id));
        if (!tabIds.length) continue;
        const title = (group.title || '').trim() || 'Misc';
        try {
            if (groupByTitle[title] !== undefined) {
                await browserAPI.tabs.group({ groupId: groupByTitle[title], tabIds });
            } else {
                const groupId = await browserAPI.tabs.group({ tabIds, createProperties: { windowId } });
                if (browserAPI.tabGroups) {
                    await browserAPI.tabGroups.update(groupId, { title, color: group.color || 'grey' });
                    // Keep the catch-all group at the end of the tab strip
                    if (title === 'Misc') await browserAPI.tabGroups.move(groupId, { index: -1 });
                }
                groupByTitle[title] = groupId;
            }
            grouped += tabIds.length;
        } catch (e) { console.error("Grouping failed:", e); }
    }

    let undoId = null;
    if (grouped > 0) {
        undoId = await recordUndo({ kind: 'grouping', label: 'Restore your previous tab groups', windowId, snapshot });
        const count = plan.groups.filter(g => g.tabIds.some(id => liveIds.has(id))).length;
        await announce(`Organized ${grouped} tabs into ${count} group${count === 1 ? '' : 's'}.`, { undoId, windowId, badge: '✓' });
    }
    return { grouped, undoId };
}

// --- Auto-group new tabs ---
// New tabs wait here until their first page finishes loading, then may join a matching group once.
const PENDING_GROUP_KEY = 'pendingAutoGroup';
const embeddingCache = new Map();
const EMBEDDING_CACHE_MAX = 500;

async function cachedEmbedding(text) {
    if (embeddingCache.has(text)) return embeddingCache.get(text);
    const vector = await embedText(text);
    if (embeddingCache.size >= EMBEDDING_CACHE_MAX) embeddingCache.delete(embeddingCache.keys().next().value);
    embeddingCache.set(text, vector);
    return vector;
}

function tabText(tab) {
    return `${tab.title || ''} ${extractHost(tab.url)}`.trim();
}

function markPendingAutoGroup(tabId, pending) {
    return updateSessionMap(PENDING_GROUP_KEY, map => {
        if (pending) map[tabId] = Date.now();
        else delete map[tabId];
    });
}

async function autoGroupTab(tabId) {
    // Take the pending flag atomically so a tab is only ever considered once
    const wasPending = await updateSessionMap(PENDING_GROUP_KEY, map => {
        const had = Boolean(map[tabId]);
        delete map[tabId];
        return had;
    });
    if (!wasPending) return;

    const settings = await getSettings();
    if (!settings.autoGroup || !browserAPI.tabGroups || !browserAPI.tabs.group) return;

    let tab;
    try { tab = await browserAPI.tabs.get(tabId); } catch (e) { return; }
    if (tab.pinned || isGrouped(tab) || !isWebUrl(tab.url)) return;

    const groups = (await browserAPI.tabGroups.query({ windowId: tab.windowId })).filter(g => g.title);
    if (groups.length === 0) return;
    const windowTabs = await browserAPI.tabs.query({ windowId: tab.windowId });
    const candidates = groups.map(g => ({ id: g.id, title: g.title, tabs: windowTabs.filter(t => t.groupId === g.id) }))
        .filter(g => g.tabs.length > 0);

    // Semantic match only when no group has the same site (loads the local model)
    let similarities = null;
    if (!pickGroupForTab(tab, candidates)) {
        try {
            const tabVector = await cachedEmbedding(tabText(tab));
            similarities = {};
            for (const g of candidates) {
                const vectors = await Promise.all(g.tabs.map(t => cachedEmbedding(tabText(t))));
                const centroid = new Float32Array(tabVector.length);
                vectors.forEach(v => v.forEach((x, i) => { centroid[i] += x / vectors.length; }));
                similarities[g.id] = cosineSimilarity(tabVector, centroid);
            }
        } catch (e) {
            console.error("Auto-group similarity failed:", e);
        }
    }
    const groupId = pickGroupForTab(tab, candidates, similarities ? id => similarities[id] || 0 : null);
    if (groupId === null) return;

    try {
        await browserAPI.tabs.group({ groupId, tabIds: [tab.id] });
        const group = candidates.find(g => g.id === groupId);
        await recordUndo({ kind: 'ungroup-tab', label: `Take "${tab.title || extractHost(tab.url)}" out of "${group.title}"`, tabId: tab.id });
        addLog('DECISION', 'Auto-group', 'success', `Added ${tab.url} to group "${group.title}".`);
    } catch (e) {
        console.error("Auto-group failed:", e);
    }
}

browserAPI.tabs.onCreated.addListener(async (tab) => {
    // Tabs the browser already put in a group (opened from a grouped tab) are left alone,
    // and so are tabs reopened by session restore at startup
    if (isGrouped(tab)) return;
    const { browserStartedAt } = await browserAPI.storage.session.get(['browserStartedAt']);
    if (browserStartedAt && Date.now() - browserStartedAt < STARTUP_GRACE_MS) return;
    markPendingAutoGroup(tab.id, true).catch(() => {});
});

browserAPI.tabs.onRemoved.addListener((tabId) => {
    markPendingAutoGroup(tabId, false).catch(() => {});
});

browserAPI.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId !== 0 || !isWebUrl(details.url)) return;
    autoGroupTab(details.tabId).catch(e => console.error("Auto-group failed:", e));
});

// --- Duplicate cleanup (preview + apply) ---
async function planDuplicates(windowId) {
    const { neverClose } = await getSettings();
    const tabs = (await browserAPI.tabs.query({ windowId })).filter(t => !urlMatchesDomains(t.url, neverClose));
    // 1. Exact URL duplicates (ignores #fragments and trailing slashes)
    const { toClose: exact, toKeep } = planExactDuplicates(tabs);
    // 2. Near-identical pages. The same-site bonus is disabled: two different pages on one site are not duplicates.
    const webTabs = toKeep.filter(t => isWebUrl(t.url));
    const clusters = await clusterTabs(webTabs, 0.95, { domainBonus: 0 });
    const near = clusters.flatMap(cluster => planClusterClosures(cluster.tabs));
    return {
        windowId,
        tabs: [
            ...exact.map(t => ({ ...summarizeTab(t), reason: 'exact' })),
            ...near.map(t => ({ ...summarizeTab(t), reason: 'near' }))
        ]
    };
}

async function applyDuplicateClosures(tabIds) {
    const { count, undoId } = await archiveAndCloseTabs(tabIds, 'Reopen closed duplicates');
    addLog('DECISION', 'Deduplicate Tabs', 'success', `Closed ${count} duplicate tabs (archived).`);
    if (count > 0) await announce(`Closed ${count} duplicate tab${count === 1 ? '' : 's'}.`, { undoId, badge: `−${count}` });
    return { closed: count, undoId };
}

// --- Undo ---
async function undoAction(id) {
    const entry = await takeUndo(id);
    if (!entry) return false;

    if (entry.kind === 'grouping') {
        await restoreGroups(entry.windowId, entry.snapshot);
    } else if (entry.kind === 'ungroup-tab') {
        try { await browserAPI.tabs.ungroup([entry.tabId]); } catch (e) { /* tab closed */ }
    } else if (entry.kind === 'close') {
        await addDedupeBypass(entry.tabs.map(t => t.url));
        const tabs = [...entry.tabs].sort((a, b) => (a.index || 0) - (b.index || 0));
        let toActivate = null;
        for (const t of tabs) {
            const props = { url: t.url, active: false, pinned: t.pinned };
            try {
                await browserAPI.windows.get(t.windowId);
                props.windowId = t.windowId;
                if (typeof t.index === 'number') props.index = t.index;
            } catch (e) { /* window closed: reopen in the current window */ }
            try {
                const created = await browserAPI.tabs.create(props);
                if (t.archivedId) await deleteArchivedTab(t.archivedId);
                if (t.groupId >= 0 && browserAPI.tabs.group) {
                    try { await browserAPI.tabs.group({ groupId: t.groupId, tabIds: [created.id] }); } catch (e) { /* group gone */ }
                }
                if (t.active || !toActivate) toActivate = created;
            } catch (e) { console.error("Reopening tab failed:", e); }
        }
        for (const r of entry.restoreUrls || []) await safeUpdateTab(r.tabId, { url: r.url });
        if (toActivate) {
            await safeUpdateTab(toActivate.id, { active: true });
            await safeFocusWindow(toActivate.windowId);
        }
    }
    addLog('DECISION', 'Undo', 'success', entry.label);
    return true;
}

// --- Backup Listeners ---
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'export_backup') {
        Promise.all([
            browserAPI.tabs.query({}),
            getArchivedTabs()
        ]).then(([activeTabs, archivedTabs]) => {
            const backup = {
                version: 1,
                timestamp: Date.now(),
                activeTabs: activeTabs.map(t => ({ url: t.url, title: t.title })),
                archivedTabs: archivedTabs
            };
            sendResponse({ backup });
        });
        return true;
    }

    if (message.action === 'import_backup') {
        const backup = message.backup;
        if (backup && backup.archivedTabs) {
            bulkImportArchivedTabs(backup.archivedTabs);
        }
        if (backup && backup.activeTabs) {
            backup.activeTabs.forEach(tab => {
                browserAPI.tabs.create({ url: tab.url, active: false });
            });
        }
        sendResponse({ status: 'success' });
        return true;
    }
});
