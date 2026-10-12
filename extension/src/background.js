import { clusterTabs, getSmartGroupName } from './clustering.js';
import { archiveTab, getLatestArchivedTab, deleteArchivedTab, getArchivedTabs, bulkImportArchivedTabs } from './db.js';
import { PROMPTS } from './prompts.js';

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

async function seedConfig() {
    try {
        const res = await fetch(browserAPI.runtime.getURL('config.json'));
        if (res.ok) {
            const config = await res.json();
            const storage = await browserAPI.storage.local.get(['agentSettings']);
            const s = storage.agentSettings || {};
            // Only overwrite if UI settings are empty
            if (!s.cognitiveKey) {
                let defaultUrl = 'https://api.openai.com/v1/chat/completions';
                let defaultModel = 'gpt-4o-mini';
                if (config.cognitiveKey && config.cognitiveKey.startsWith('sk-ant-')) {
                    defaultUrl = 'https://api.anthropic.com/v1/messages';
                    defaultModel = 'claude-3-haiku-20240307';
                } else if (config.cognitiveKey && (config.cognitiveKey.startsWith('AIza') || config.cognitiveKey.startsWith('AQ'))) {
                    defaultUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
                    defaultModel = 'gemini-3.8-flash';
                }
                
                const newSettings = {
                    cognitiveKey: config.cognitiveKey || '',
                    cognitiveUrl: config.cognitiveUrl || defaultUrl,
                    cognitiveModel: config.cognitiveModel || defaultModel,
                    reflexKey: config.reflexKey || config.cognitiveKey || '',
                    reflexUrl: config.reflexUrl || config.cognitiveUrl || defaultUrl,
                    reflexModel: config.reflexModel || config.cognitiveModel || defaultModel
                };
                await browserAPI.storage.local.set({ agentSettings: newSettings });
                console.log("[Setup] Seeded API keys from config.json");
            }
        }
    } catch(e) {}
}

// Run once on load
seedConfig();

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
            body: JSON.stringify(payload)
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
            body: JSON.stringify(payload)
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
            body: JSON.stringify(payload)
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

// Set a stylish badge on the extension icon
if (browserAPI.action) {
    browserAPI.action.setBadgeBackgroundColor({ color: '#b026ff' }); // Neon purple
    browserAPI.action.setBadgeText({ text: 'AI' });
}

// --- Smart Tab Reuse & Deduplication Router ---
const singleInstanceDomains = ["localhost", "internal.corp.com"];

async function safeRemoveTab(tabId) {
    try { await browserAPI.tabs.remove(tabId); } catch (e) { /* ignore already closed */ }
}
async function safeUpdateTab(tabId, props) {
    try { await browserAPI.tabs.update(tabId, props); } catch (e) { /* ignore */ }
}
async function safeFocusWindow(windowId) {
    try { await browserAPI.windows.update(windowId, { focused: true }); } catch (e) { /* ignore */ }
}

browserAPI.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only intercept top-level frame navigations
    if (details.frameId !== 0) return;

    try {
        const targetUrlStr = details.url;
        const targetUrl = new URL(targetUrlStr);

        // Only deduplicate real web pages; blank, new-tab and browser pages must never be closed
        if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return;
        
        // Load Settings to check for Reflex Engine
        const storage = await browserAPI.storage.local.get(['agentSettings']);
        const s = storage.agentSettings || {};
        
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
        const match = hostMatches[0];

        // 2. Exact Duplicate Prevention (always runs, free)
        const normalizeUrl = (u) => {
            try {
                const parsed = new URL(u);
                return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
            } catch { return u; }
        };

        if (normalizeUrl(match.url) === normalizeUrl(targetUrlStr)) {
            addLog('DECISION', 'Deduplication', 'success', `Exact duplicate found for ${targetUrlStr} (Local Engine | Match: 100%). Redirecting focus.`);
            await safeUpdateTab(match.id, { active: true });
            await safeFocusWindow(match.windowId);
            await safeRemoveTab(details.tabId);
            return;
        }

        // 3. Reflex Engine Deduplication (if configured)
        if (s.reflexUrl && s.reflexKey && s.reflexModel) {
            const systemPrompt = PROMPTS.DEDUPLICATION_AGENT;
            const userPrompt = `EXISTING TAB URL: ${match.url}\nEXISTING TAB TITLE: ${match.title}\n\nTARGET NEW URL: ${targetUrlStr}`;
            
            try {
                const decision = await callAgentAPI(s.reflexUrl, s.reflexKey, s.reflexModel, systemPrompt, userPrompt);
                
                const scoreText = decision.confidence ? ` | Confidence: ${(decision.confidence * 100).toFixed(1)}%` : '';
                const engineText = decision.engine ? ` (${decision.engine}${scoreText})` : '';
                
                addLog('DECISION', 'Reflex Engine', 'success', `Decision: ${decision.action}${engineText} for target: ${targetUrlStr}`);
                
                if (decision.action === "REFRESH") {
                    await safeUpdateTab(match.id, { url: targetUrlStr, active: true });
                    await safeFocusWindow(match.windowId);
                    await safeRemoveTab(details.tabId);
                }
            } catch (err) {
                addLog('DECISION', 'Reflex Engine', 'error', `Failed to deduplicate: ${err.message}`);
                console.error("Reflex Engine Error:", err);
            }
            return;
        }

        // 4. Free Local Fallback (Single-Instance Domains)
        const isSingleInstance = singleInstanceDomains.some(d => targetUrl.hostname.includes(d));
        if (isSingleInstance) {
            addLog('DECISION', 'Local Fallback', 'success', `Single-instance domain matched. Updating tab ${match.id} to new path: ${targetUrlStr}`);
            await safeUpdateTab(match.id, { url: targetUrlStr, active: true });
            await safeFocusWindow(match.windowId);
            await safeRemoveTab(details.tabId);
        }
    } catch (error) {
        console.error("Error processing navigation:", error);
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
        browserAPI.storage.local.get(['agentSettings']).then(result => {
            sendResponse(result.agentSettings || {});
        });
        return true;
    }

    if (message.action === 'save_settings') {
        browserAPI.storage.local.set({ agentSettings: message.settings }).then(() => {
            sendResponse({ status: 'success' });
        });
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
    
    if (message.action === 'deduplicate_tabs') {
        browserAPI.tabs.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT }).then(async tabs => {
            const tabsByUrl = {};
            const tabsToClose = [];
            const tabsToKeep = [];

            // 1. Exact URL deduplication
            for (const tab of tabs) {
                if (tabsByUrl[tab.url]) {
                    tabsToClose.push(tab.id); // It's an exact duplicate
                } else {
                    tabsByUrl[tab.url] = tab;
                    tabsToKeep.push(tab);
                }
            }

            // Close exact duplicates immediately
            if (tabsToClose.length > 0) {
                await browserAPI.tabs.remove(tabsToClose);
            }

            // 2. AI semantic deduplication for the remaining tabs
            // Using a very high threshold (0.95) to ensure solid AI judgement on redundant tabs
            const clusters = await clusterTabs(tabsToKeep, 0.95);
            const semanticDupesToClose = [];
            
            for (const cluster of clusters) {
                if (cluster.tabs.length > 1) {
                    // Sort by lastAccessed descending
                    cluster.tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                    // Keep the first (most recently used), close the rest
                    for (let i = 1; i < cluster.tabs.length; i++) {
                        semanticDupesToClose.push(cluster.tabs[i].id);
                    }
                }
            }

            if (semanticDupesToClose.length > 0) {
                await browserAPI.tabs.remove(semanticDupesToClose);
            }

            sendResponse({ 
                status: 'success', 
                exactClosed: tabsToClose.length, 
                semanticClosed: semanticDupesToClose.length 
            });
        });
        return true;
    }
    
    if (message.action === 'ungroup_all') {
        browserAPI.tabs.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT }).then(async tabs => {
            const groupedTabs = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined).map(t => t.id);
            if (groupedTabs.length > 0) {
                // If native tabGroups are not fully supported, this might fail, so we wrap it
                if (browserAPI.tabs.ungroup) {
                    await browserAPI.tabs.ungroup(groupedTabs);
                }
            }
            sendResponse({ status: 'success' });
        });
        return true;
    }
    
    if (message.action === 'cluster_tabs_force' || message.action === 'cluster_tabs_leaf') {
        browserAPI.tabs.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT })
            .then(async tabs => {
                let targetTabs = tabs;
                
                if (message.action === 'cluster_tabs_leaf') {
                    targetTabs = tabs.filter(t => t.groupId === -1 || t.groupId === undefined);
                } else if (message.action === 'cluster_tabs_force') {
                    const groupedTabs = tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined).map(t => t.id);
                    if (groupedTabs.length > 0 && browserAPI.tabs.ungroup) {
                        await browserAPI.tabs.ungroup(groupedTabs);
                    }
                    targetTabs = tabs; 
                }
                
                if (targetTabs.length <= 1) return []; 

                // 1. Check for Cognitive Engine Settings
                const storage = await browserAPI.storage.local.get(['agentSettings']);
                const s = storage.agentSettings || {};
                
                let clusters = null;

                if (s.cognitiveUrl && s.cognitiveKey && s.cognitiveModel) {
                    try {
                        const tabsJson = JSON.stringify(targetTabs.map(t => ({ id: t.id, url: t.url, title: t.title })));
                        const response = await callAgentAPI(s.cognitiveUrl, s.cognitiveKey, s.cognitiveModel, PROMPTS.GROUPING_AGENT, `INPUT TABS TO CLASSIFY:\n${tabsJson}`);
                        
                        // Parse agent format to local cluster format
                        if (Array.isArray(response)) {
                            clusters = response.map(group => ({
                                tabs: targetTabs.filter(t => group.tabIds.includes(t.id)),
                                name: group.groupName
                            })).filter(c => c.tabs.length > 0);
                            addLog('DECISION', 'Cognitive Engine', 'success', `Grouped ${targetTabs.length} tabs into ${clusters.length} categories.`);
                        }
                    } catch (err) {
                        addLog('DECISION', 'Cognitive Engine', 'error', `Failed to group: ${err.message}. Falling back to local math.`);
                        console.error("Cognitive Engine failed, falling back to local math:", err);
                    }
                }

                // 2. Free Local Fallback (if Agent fails or isn't configured)
                if (!clusters) {
                    clusters = await clusterTabs(targetTabs);
                    addLog('DECISION', 'Local Fallback', 'success', `Used text embeddings to group ${targetTabs.length} tabs into ${clusters.length} categories.`);
                }

                await applyClustersToTabs(clusters);
                return clusters;
            })
            .then(clusters => sendResponse({ status: 'success', clusters }))
            .catch(error => {
                console.error("Clustering failed:", error);
                sendResponse({ status: 'error', error: error.message });
            });
        
        return true; 
    }

    if (message.action === 'archive_stale_tabs') {
        browserAPI.tabs.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT, active: false }).then(async tabs => {
            let archivedCount = 0;
            const now = Date.now();
            const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
            
            for (const tab of tabs) {
                // Safely check if tab has been inactive for more than 3 days
                if (!tab.pinned && !tab.audible && tab.lastAccessed && (now - tab.lastAccessed > THREE_DAYS)) {
                    await archiveTab(tab);
                    await browserAPI.tabs.remove(tab.id);
                    archivedCount++;
                }
            }
            sendResponse({ status: 'success', archivedCount });
        });
        return true;
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
async function applyClustersToTabs(clusters) {
    const browserAPI = typeof browser !== "undefined" ? browser : chrome;
    if (!browserAPI.tabs.group) return;

    const categories = {}; // Map category -> tabIds

    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        // Use Cognitive Engine name if provided, else fallback to Smart Domain Name
        let title = cluster.name || await getSmartGroupName(cluster.embeddings);
        
        // Fallback
        if (!title) {
            if (cluster.tabs.length > 1) {
                title = "Group " + (i + 1);
                try { title = new URL(cluster.tabs[0].url).hostname.replace('www.', ''); } catch(e) {}
            } else {
                title = "Misc";
            }
        }
        
        if (!categories[title]) categories[title] = [];
        cluster.tabs.forEach(t => categories[title].push(t.id));
    }

    const miscTabIds = categories["Misc"] || [];
    delete categories["Misc"];

    const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
    let colorIdx = 0;

    const existingGroups = browserAPI.tabGroups ? await browserAPI.tabGroups.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT }) : [];
    const groupTitleMap = {};
    existingGroups.forEach(g => {
        if (g.title) groupTitleMap[g.title] = g.id;
    });

    for (const [title, tabIds] of Object.entries(categories)) {
        try {
            if (groupTitleMap[title]) {
                await browserAPI.tabs.group({ groupId: groupTitleMap[title], tabIds });
            } else {
                const groupId = await browserAPI.tabs.group({ tabIds });
                const color = colors[colorIdx++ % colors.length];
                if (browserAPI.tabGroups) {
                    await browserAPI.tabGroups.update(groupId, { title, color });
                }
                groupTitleMap[title] = groupId;
            }
        } catch(e) { console.error(e); }
    }
    
    // Put anything the AI completely failed to classify at the bottom
    if (miscTabIds.length > 0) {
        try {
            const groupId = await browserAPI.tabs.group({ tabIds: miscTabIds });
            if (browserAPI.tabGroups) {
                await browserAPI.tabGroups.update(groupId, { title: "Misc", color: "grey" });
                await browserAPI.tabGroups.move(groupId, { index: -1 });
            }
        } catch(e) { console.error(e); }
    }
}

// --- Debugging Helper ---
// Expose function globally so you can test it directly in the background console
globalThis.testCluster = async () => {
    const tabs = await browserAPI.tabs.query({ windowId: browserAPI.windows.WINDOW_ID_CURRENT });
    const clusters = await clusterTabs(tabs);
    console.log("Clusters generated:", clusters);
    
    await applyClustersToTabs(clusters);
    
    return clusters;
};

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
