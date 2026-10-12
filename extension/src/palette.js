import { defaultsForKey, modelMatchesKey, isDefaultModel } from './providers.js';
import { openPreview, isPreviewOpen, closePreview, applyPreview } from './preview.js';

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const input = document.getElementById('search-input');
const list = document.getElementById('results-list');
const badge = document.getElementById('command-badge');

let allItems = [];
let visibleItems = [];
let selectedIndex = 0;
let isCommandMode = false;

const commands = [
    { type: 'command', title: "Organize All Tabs (AI Magic)", action: "cmd_group_tabs_force", icon: "✨", section: "Commands" },
    { type: 'command', title: "Organize Ungrouped Tabs", action: "cmd_group_tabs_leaf", icon: "🌱", section: "Commands" },
    { type: 'command', title: "Ungroup All Tabs", action: "cmd_ungroup_all", icon: "💥", section: "Commands" },
    { type: 'command', title: "Consolidate All Windows", action: "cmd_consolidate", icon: "🗂️", section: "Commands" },
    { type: 'command', title: "Close Duplicate Tabs", action: "cmd_dedupe", icon: "🧹", section: "Commands" },
    { type: 'command', title: "Archive Unused Tabs (> 3 Days)", action: "cmd_archive", icon: "📦", section: "Commands" },
    { type: 'command', title: "Recover Last Archived", action: "cmd_recover", icon: "♻️", section: "Commands" },
    { type: 'command', title: "Undo Last Action", action: "cmd_undo", icon: "↶", section: "Commands" },
    { type: 'command', title: "Settings", action: "cmd_settings", icon: "⚙️", section: "Commands" },
    { type: 'command', title: "Welcome, Tips & Shortcuts", action: "cmd_welcome", icon: "👋", section: "Help" },
    { type: 'command', title: "Export Backup (Tabs & Archives)", action: "cmd_export_backup", icon: "💾", section: "Backup & Restore" },
    { type: 'command', title: "Import Backup", action: "cmd_import_backup", icon: "📥", section: "Backup & Restore" }
];

// Initialize
input.focus();

// Show the user's archive threshold in the command title
async function refreshArchiveCommandTitle() {
    try {
        const s = await browserAPI.runtime.sendMessage({ action: 'get_settings' });
        const days = s && s.archiveAfterDays ? s.archiveAfterDays : 3;
        const cmd = commands.find(c => c.action === 'cmd_archive');
        cmd.title = `Archive Unused Tabs (> ${days} Day${days === 1 ? '' : 's'})`;
    } catch (e) { /* keep default title */ }
}
refreshArchiveCommandTitle();

// Fetch tabs
async function loadTabs() {
    const response = await browserAPI.runtime.sendMessage({ action: 'get_all_tabs' });
    
    const active = response.activeTabs.map(tab => ({
        type: 'tab',
        title: tab.title,
        url: tab.url,
        icon: tab.favIconUrl,
        tabId: tab.id,
        windowId: tab.windowId,
        lastAccessed: tab.lastAccessed,
        section: "Active Tabs"
    }));

    const pastClosed = (response.closedTabs || []).sort((a,b) => b.timestamp - a.timestamp).map(tab => ({
        type: 'closed_tab',
        title: tab.title,
        url: tab.url,
        icon: tab.favIconUrl || "🗑️",
        sessionId: tab.sessionId,
        timestamp: tab.timestamp,
        section: "Past Tabs"
    }));

    const pastArchived = (response.archivedTabs || []).sort((a,b) => b.timestamp - a.timestamp).map(tab => ({
        type: 'archived_tab',
        title: tab.title,
        url: tab.url,
        icon: tab.favIconUrl || "📦",
        dbId: tab.id,
        timestamp: tab.timestamp,
        section: "Past Tabs"
    }));

    // Merge closed and archived into a single "Past Tabs" list, sorted perfectly
    let allPast = [...pastClosed, ...pastArchived].sort((a,b) => b.timestamp - a.timestamp);

    // Deduplicate Past Tabs by URL (keep the most recent one)
    const seenUrls = new Set();
    allPast = allPast.filter(tab => {
        if (!tab.url || seenUrls.has(tab.url)) return false;
        seenUrls.add(tab.url);
        return true;
    });

    // Offer the most recent undoable action at the top
    let undoItems = [];
    try {
        const undo = await browserAPI.runtime.sendMessage({ action: 'get_undo' });
        if (undo && undo.entry) {
            undoItems = [{ type: 'undo', title: `Undo: ${undo.entry.label}`, icon: '↶', undoId: undo.entry.id, section: 'Undo' }];
        }
    } catch (e) { /* no undo available */ }

    allItems = [...undoItems, ...active, ...allPast];
    if (!isCommandMode && !input.value) renderList(allItems);
}

function getFriendlyDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const options = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) {
        options.year = 'numeric';
    }
    return d.toLocaleDateString(undefined, options);
}

function renderList(items) {
    list.innerHTML = '';
    visibleItems = items;
    selectedIndex = 0;
    if (list) list.scrollTop = 0;

    let currentSection = null;

    if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.setAttribute('role', 'presentation');
        empty.textContent = isCommandMode ? 'No commands match.' : 'No tabs match. Type > to see commands.';
        list.appendChild(empty);
        input.removeAttribute('aria-activedescendant');
        return;
    }

    items.forEach((item, index) => {
        if (item.section && item.section !== currentSection) {
            const header = document.createElement('li');
            header.setAttribute('role', 'presentation');
            header.className = 'section-header';
            header.textContent = item.section;
            list.appendChild(header);
            currentSection = item.section;
        }

        const li = document.createElement('li');
        li.className = 'result-item';
        li.id = `result-${index}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        
        // Icon
        // Emoji icons (commands, tabs without a favicon) render as text, favicons as images
        const isImageIcon = item.icon && /^(https?:|data:|chrome:|chrome-extension:|moz-extension:)/.test(item.icon);
        if (item.type === 'command' || item.type === 'undo' || (item.icon && !isImageIcon)) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'result-icon';
            iconSpan.textContent = item.icon;
            iconSpan.setAttribute('aria-hidden', 'true');
            li.appendChild(iconSpan);
        } else {
            const img = document.createElement('img');
            img.className = 'result-icon';
            img.alt = '';
            img.src = item.icon || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            img.onerror = () => { img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };
            li.appendChild(img);
        }
        
        // Text Container
        const textDiv = document.createElement('div');
        textDiv.className = 'result-text';
        
        const title = document.createElement('div');
        title.className = 'result-title';
        title.textContent = item.title;
        textDiv.appendChild(title);
        
        if (item.url) {
            const url = document.createElement('div');
            url.className = 'result-url';
            url.textContent = item.url.replace(/^https?:\/\//, '');
            textDiv.appendChild(url);
        }
        
        li.appendChild(textDiv);
        
        // Timestamps
        if (item.type === 'archived_tab' && item.timestamp) {
            const timeSpan = document.createElement('div');
            timeSpan.className = 'result-time';
            timeSpan.textContent = getFriendlyDate(item.timestamp);
            li.appendChild(timeSpan);
        } else if (item.type === 'closed_tab' && item.timestamp) {
            const timeSpan = document.createElement('div');
            timeSpan.className = 'result-time';
            const hours = Math.round((Date.now() - item.timestamp) / (1000 * 60 * 60));
            timeSpan.textContent = hours > 24 ? `${Math.round(hours/24)}d ago` : (hours > 0 ? `${hours}h ago` : "Just now");
            li.appendChild(timeSpan);
        } else if (item.type === 'tab' && item.lastAccessed) {
            const timeSpan = document.createElement('div');
            timeSpan.className = 'result-time';
            const hours = Math.round((Date.now() - item.lastAccessed) / (1000 * 60 * 60));
            timeSpan.textContent = hours > 24 ? `${Math.round(hours/24)}d ago` : (hours > 0 ? `${hours}h ago` : "Just now");
            li.appendChild(timeSpan);
        }
        
        // Hover and Click
        li.onmouseenter = () => updateSelection(index);
        li.onclick = () => executeItem(item);
        
        list.appendChild(li);
    });
    
    updateSelection(0);
}

function updateSelection(newIndex) {
    if (newIndex < 0 || newIndex >= visibleItems.length) return;
    
    const items = list.querySelectorAll('.result-item');
    if (items[selectedIndex]) {
        items[selectedIndex].classList.remove('selected');
        items[selectedIndex].setAttribute('aria-selected', 'false');
    }
    
    selectedIndex = newIndex;
    if (!items[selectedIndex]) return;
    items[selectedIndex].classList.add('selected');
    items[selectedIndex].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', items[selectedIndex].id);
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
}

function closeUI() {
    if (window.parent !== window) {
        window.parent.postMessage('close-palette', '*');
    } else {
        window.close();
    }
}

/** Shows one of the palette screens: 'search', 'settings' or 'preview' (managed by preview.js). */
function setView(view) {
    const isSearch = view === 'search';
    document.getElementById('search-header').style.display = isSearch ? 'flex' : 'none';
    list.style.display = isSearch ? 'block' : 'none';
    document.getElementById('palette-footer').style.display = isSearch ? 'flex' : 'none';
    document.getElementById('settings-view').style.display = view === 'settings' ? 'block' : 'none';
    if (isSearch) input.focus();
}

function showSearchView() {
    setView('search');
}

// Commands that change many tabs show a preview first
const PREVIEW_COMMANDS = {
    cmd_group_tabs_force: 'group-force',
    cmd_group_tabs_leaf: 'group-leaf',
    cmd_dedupe: 'dedupe',
    cmd_archive: 'archive'
};

function executeItem(item) {
    let promise = null;
    let shouldClose = true;

    if (item.type === 'command' && PREVIEW_COMMANDS[item.action]) {
        setView('preview');
        openPreview(PREVIEW_COMMANDS[item.action], { onBack: showSearchView, onDone: closeUI });
        return;
    }

    if (item.type === 'command' && item.action === 'cmd_settings') {
        openSettings();
        return;
    }

    if (item.type === 'command' && item.action === 'cmd_welcome') {
        browserAPI.runtime.sendMessage({ action: 'open_welcome' }).catch(e => console.error(e)).finally(closeUI);
        return;
    }

    if (item.type === 'undo' || (item.type === 'command' && item.action === 'cmd_undo')) {
        // Wait for the undo to finish before closing the palette
        browserAPI.runtime.sendMessage({ action: 'undo', id: item.undoId })
            .catch(e => console.error(e))
            .finally(closeUI);
        return;
    }

    if (item.type === 'tab') {
        promise = browserAPI.runtime.sendMessage({ action: 'switch_to_tab', tabId: item.tabId, windowId: item.windowId });
    } else if (item.type === 'archived_tab') {
        promise = browserAPI.runtime.sendMessage({ action: 'restore_archived_tab', dbId: item.dbId, url: item.url });
    } else if (item.type === 'closed_tab') {
        promise = browserAPI.runtime.sendMessage({ action: 'restore_closed_tab', sessionId: item.sessionId });
    } else if (item.type === 'command') {
        if (item.action === 'cmd_ungroup_all') {
            promise = browserAPI.runtime.sendMessage({ action: 'ungroup_all' });
        } else if (item.action === 'cmd_consolidate') {
            promise = browserAPI.runtime.sendMessage({ action: 'consolidate_windows' });
        } else if (item.action === 'cmd_recover') {
            promise = browserAPI.runtime.sendMessage({ action: 'recover_last_archived' });
        } else if (item.action === 'cmd_export_backup') {
            promise = browserAPI.runtime.sendMessage({ action: 'export_backup' }).then(response => {
                const blob = new Blob([JSON.stringify(response.backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tab-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        } else if (item.action === 'cmd_import_backup') {
            shouldClose = false;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'application/json';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const backup = JSON.parse(event.target.result);
                        browserAPI.runtime.sendMessage({ action: 'import_backup', backup }).then(() => {
                            if (window.parent !== window) {
                                window.parent.postMessage('close-palette', '*');
                            } else {
                                window.close();
                            }
                        });
                    } catch(err) { alert("Invalid backup file!"); }
                };
                reader.readAsText(file);
            };
            fileInput.click();
        } else {
            console.log("Command not implemented yet:", item.action);
        }
    }

    if (shouldClose) {
        // Snappy feel: Close the palette immediately so the user isn't blocked 
        // while the background thread handles the AI network requests.
        closeUI();
        if (promise && typeof promise.then === 'function') {
            promise.catch(e => console.error(e));
        }
    }
}

// Input handling (Filtering and Commands)
input.addEventListener('input', (e) => {
    let query = e.target.value;
    
    // Check command mode
    if (query === '>' && !isCommandMode) {
        isCommandMode = true;
        input.value = '';
        query = '';
    } else if (query.startsWith('>')) {
        isCommandMode = true;
        input.value = query.substring(1);
        query = input.value;
    }

    if (isCommandMode) {
        badge.style.display = 'block';
        document.getElementById('settings-trigger').style.display = 'block';
        input.style.paddingLeft = '8px';
        query = query.toLowerCase().trim();
        
        const terms = query.split(/\s+/).filter(t => t.length > 0);
        const filteredCommands = commands.filter(c => {
            const target = `${c.title} ${c.action}`.toLowerCase();
            return terms.every(term => target.includes(term));
        }).map(c => ({ ...c, type: 'command' }));
        
        renderList(filteredCommands);
    } else {
        isCommandMode = false;
        badge.style.display = 'none';
        document.getElementById('settings-trigger').style.display = 'none';
        input.style.paddingLeft = '0px';
        query = query.toLowerCase().trim();
        
        if (query === '') {
            renderList(allItems);
        } else {
            const terms = query.split(/\s+/).filter(t => t.length > 0);
            const filteredTabs = allItems.filter(t => {
                const target = `${t.title || ''} ${t.url || ''}`.toLowerCase();
                return terms.every(term => target.includes(term));
            });
            renderList(filteredTabs);
        }
    }
});

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    if (isPreviewOpen()) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closePreview();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (document.activeElement && document.activeElement.classList.contains('group-name')) {
                document.getElementById('btn-preview-apply').focus();
            } else {
                applyPreview();
            }
        }
        return;
    }

    if (e.key === 'Escape') {
        if (window.parent !== window) {
            window.parent.postMessage('close-palette', '*');
        } else {
            window.close();
        }
        return;
    }

    // Exit command mode on backspace when input is empty
    if (e.key === 'Backspace' && isCommandMode && input.value === '') {
        isCommandMode = false;
        badge.style.display = 'none';
        document.getElementById('settings-trigger').style.display = 'none';
        input.style.paddingLeft = '0px';
        renderList(allItems);
        return;
    }
    
    if (visibleItems.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateSelection((selectedIndex + 1) % visibleItems.length);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateSelection((selectedIndex - 1 + visibleItems.length) % visibleItems.length);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeItem(visibleItems[selectedIndex]);
    }
});

window.addEventListener('message', (event) => {
    if (event.data === 'reset-palette') {
        input.value = '';
        input.placeholder = 'Search Tabs...';
        isCommandMode = false;
        badge.style.display = 'none';
        document.getElementById('settings-trigger').style.display = 'none';
        input.style.paddingLeft = '';
        if (list) list.scrollTop = 0;
        loadTabs();
    }
});

// Settings Events
document.getElementById('settings-trigger').addEventListener('click', () => openSettings());

/** Lists the extension's keyboard shortcuts, flagging any the browser could not assign. */
async function renderShortcuts() {
    const container = document.getElementById('shortcut-list');
    container.replaceChildren();
    let commandsList = [];
    try { commandsList = await browserAPI.commands.getAll(); } catch (e) { /* not available */ }
    for (const cmd of commandsList) {
        if (!cmd.description) continue;
        const name = document.createElement('span');
        name.textContent = cmd.description;
        const keys = document.createElement('span');
        if (cmd.shortcut) {
            const kbd = document.createElement('kbd');
            kbd.textContent = cmd.shortcut;
            keys.appendChild(kbd);
        } else {
            keys.className = 'unset';
            keys.textContent = 'Not set';
        }
        container.append(name, keys);
    }
}

document.getElementById('btn-change-shortcuts').addEventListener('click', () => {
    browserAPI.runtime.sendMessage({ action: 'open_shortcut_settings' }).catch(e => console.error(e)).finally(closeUI);
});

function openSettings() {
    setView('settings');
    renderShortcuts();
    
    // Load existing
    browserAPI.runtime.sendMessage({ action: 'get_settings' }).then(s => {
        const mainKey = s.cognitiveKey || '';
        document.getElementById('setting-main-key').value = mainKey;
        
        document.getElementById('setting-reflex-url').value = s.reflexUrl || '';
        document.getElementById('setting-reflex-key').value = (s.reflexKey && s.reflexKey !== mainKey) ? s.reflexKey : '';
        document.getElementById('setting-reflex-model').value = s.reflexModel || '';
        document.getElementById('setting-cognitive-url').value = s.cognitiveUrl || '';
        document.getElementById('setting-cognitive-model').value = s.cognitiveModel || '';

        // Auto-detect if advanced settings are in use
        let useAdvanced = false;
        if (s.reflexKey && s.reflexKey !== mainKey) useAdvanced = true;
        if (s.reflexUrl && s.reflexUrl !== s.cognitiveUrl) useAdvanced = true;
        if (s.reflexModel && s.reflexModel !== s.cognitiveModel) useAdvanced = true;
        if (s.cognitiveUrl && !s.cognitiveUrl.includes('api.anthropic.com') && !s.cognitiveUrl.includes('api.openai.com') && !s.cognitiveUrl.includes('generativelanguage.googleapis.com') && s.cognitiveUrl !== '') useAdvanced = true;
        if (s.cognitiveModel && !isDefaultModel(s.cognitiveModel)) useAdvanced = true;

        document.getElementById('setting-archive-days').value = s.archiveAfterDays || 3;
        document.getElementById('setting-auto-archive').checked = Boolean(s.autoArchive);
        document.getElementById('setting-auto-group').checked = s.autoGroup !== false;
        document.getElementById('setting-never-close').value = (s.neverClose || []).join('\n');
        document.getElementById('setting-single-instance').value = (s.singleInstance || []).join('\n');
        document.getElementById('setting-badge-count').checked = s.showTabCount !== false;
        
        document.getElementById('advanced-toggle').checked = useAdvanced;
        document.getElementById('advanced-settings').style.display = useAdvanced ? 'block' : 'none';
    });
}

document.getElementById('advanced-toggle').addEventListener('change', (e) => {
    document.getElementById('advanced-settings').style.display = e.target.checked ? 'block' : 'none';
});

function autoPopulateFields(key, urlInput, modelInput) {
    if (!key) return;
    const defaults = defaultsForKey(key);
    if (!defaults.url) return;
    // Keep a user's URL/model when it already belongs to the key's provider
    const urlHost = new URL(defaults.url).hostname;
    if (!urlInput.value || !urlInput.value.includes(urlHost)) urlInput.value = defaults.url;
    if (!modelInput.value || !modelMatchesKey(key, modelInput.value)) modelInput.value = defaults.model;
}

document.getElementById('setting-main-key').addEventListener('input', (e) => {
    const key = e.target.value.trim();
    const cogUrl = document.getElementById('setting-cognitive-url');
    const cogModel = document.getElementById('setting-cognitive-model');
    const refUrl = document.getElementById('setting-reflex-url');
    const refModel = document.getElementById('setting-reflex-model');
    const refKey = document.getElementById('setting-reflex-key');
    
    // Auto-populate Cognitive Engine
    autoPopulateFields(key, cogUrl, cogModel);
    
    // Only auto-populate Reflex Engine if the user hasn't explicitly set a separate Reflex Key
    if (!refKey.value.trim()) {
        autoPopulateFields(key, refUrl, refModel);
    }
});

document.getElementById('setting-reflex-key').addEventListener('input', (e) => {
    const key = e.target.value.trim();
    const refUrl = document.getElementById('setting-reflex-url');
    const refModel = document.getElementById('setting-reflex-model');
    
    autoPopulateFields(key, refUrl, refModel);
});

document.getElementById('btn-cancel-settings').addEventListener('click', () => setView('search'));

document.getElementById('btn-save-settings').addEventListener('click', () => {
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    
    const useAdvanced = document.getElementById('advanced-toggle').checked;
    const mainKey = document.getElementById('setting-main-key').value.trim();
    
    let s = {};
    if (!useAdvanced) {
        const defaults = defaultsForKey(mainKey);
        s = {
            cognitiveKey: mainKey,
            cognitiveUrl: defaults.url,
            cognitiveModel: defaults.model,
            reflexKey: mainKey,
            reflexUrl: defaults.url,
            reflexModel: defaults.model
        };
    } else {
        s = {
            cognitiveKey: mainKey,
            cognitiveUrl: document.getElementById('setting-cognitive-url').value.trim(),
            cognitiveModel: document.getElementById('setting-cognitive-model').value.trim(),
            reflexKey: document.getElementById('setting-reflex-key').value.trim() || mainKey,
            reflexUrl: document.getElementById('setting-reflex-url').value.trim(),
            reflexModel: document.getElementById('setting-reflex-model').value.trim()
        };
    }
    s.archiveAfterDays = Number(document.getElementById('setting-archive-days').value);
    s.autoArchive = document.getElementById('setting-auto-archive').checked;
    s.autoGroup = document.getElementById('setting-auto-group').checked;
    // Domain lists are cleaned up by the background (see withSettingDefaults)
    s.neverClose = document.getElementById('setting-never-close').value;
    s.singleInstance = document.getElementById('setting-single-instance').value;
    s.showTabCount = document.getElementById('setting-badge-count').checked;
    
    browserAPI.runtime.sendMessage({ action: 'save_settings', settings: s }).then(() => {
        btn.textContent = "Saved ✓";
        refreshArchiveCommandTitle();
        setTimeout(() => {
            btn.textContent = originalText;
            document.getElementById('btn-cancel-settings').click();
        }, 600);
    });
});

loadTabs();
