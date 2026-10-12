/**
 * Preview screen for actions that change many tabs at once (organize, close duplicates,
 * archive). Shows what will happen and applies it only when the user confirms.
 */
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const GROUP_COLOR_HEX = {
    grey: '#8e8e93', blue: '#0a84ff', red: '#ff453a', yellow: '#ffd60a', green: '#30d158',
    pink: '#ff375f', purple: '#bf5af2', cyan: '#64d2ff', orange: '#ff9f0a'
};
const BLANK_ICON = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const KINDS = {
    'group-force': {
        loading: 'Finding groups for all tabs…',
        plan: () => ({ action: 'plan_grouping', mode: 'force' })
    },
    'group-leaf': {
        loading: 'Finding groups for ungrouped tabs…',
        plan: () => ({ action: 'plan_grouping', mode: 'leaf' })
    },
    'dedupe': {
        loading: 'Looking for duplicate tabs…',
        plan: () => ({ action: 'plan_dedupe' })
    },
    'archive': {
        loading: 'Looking for tabs you have not used lately…',
        plan: () => ({ action: 'plan_archive' })
    }
};

const el = id => document.getElementById(id);
let state = null;

function tabRow(tab, { checkbox = false, badge = '' } = {}) {
    const row = document.createElement(checkbox ? 'label' : 'div');
    row.className = 'preview-tab';
    if (checkbox) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        box.dataset.tabId = tab.id;
        box.addEventListener('change', updateApplyLabel);
        row.appendChild(box);
    }
    const img = document.createElement('img');
    img.className = 'result-icon';
    img.alt = '';
    img.src = tab.favIconUrl && /^(https?:|data:)/.test(tab.favIconUrl) ? tab.favIconUrl : BLANK_ICON;
    img.addEventListener('error', () => { img.src = BLANK_ICON; });
    row.appendChild(img);
    const text = document.createElement('span');
    text.className = 'preview-tab-title';
    text.textContent = tab.title || tab.url;
    text.title = tab.url || '';
    row.appendChild(text);
    if (badge) {
        const b = document.createElement('span');
        b.className = 'preview-badge';
        b.textContent = badge;
        row.appendChild(b);
    }
    return row;
}

function renderGroupingPlan(plan) {
    const body = el('preview-body');
    const total = plan.groups.reduce((n, g) => n + g.tabIds.length, 0);
    el('preview-title').textContent = `${total} tabs → ${plan.groups.length} group${plan.groups.length === 1 ? '' : 's'}`;
    el('preview-subtitle').textContent = 'Rename any group before applying. Nothing changes until you apply.';
    plan.groups.forEach((group, i) => {
        const section = document.createElement('section');
        section.className = 'preview-group';
        const header = document.createElement('div');
        header.className = 'preview-group-header';
        const dot = document.createElement('span');
        dot.className = 'group-dot';
        dot.style.background = GROUP_COLOR_HEX[group.color] || GROUP_COLOR_HEX.grey;
        const name = document.createElement('input');
        name.className = 'group-name';
        name.value = group.title;
        name.maxLength = 40;
        name.setAttribute('aria-label', `Name for group ${i + 1}`);
        name.addEventListener('input', () => { group.title = name.value; });
        const count = document.createElement('span');
        count.className = 'preview-badge';
        count.textContent = `${group.tabIds.length}`;
        header.append(dot, name, count);
        section.appendChild(header);
        for (const id of group.tabIds) {
            const tab = plan.tabs[id];
            if (tab) section.appendChild(tabRow(tab));
        }
        body.appendChild(section);
    });
    el('btn-preview-apply').textContent = 'Apply groups';
    el('btn-preview-apply').disabled = plan.groups.length === 0;
}

function renderTabList(tabs, verb) {
    const body = el('preview-body');
    const reasons = { exact: 'Exact duplicate', near: 'Near-identical' };
    for (const tab of tabs) body.appendChild(tabRow(tab, { checkbox: true, badge: reasons[tab.reason] || '' }));
    state.verb = verb;
    updateApplyLabel();
}

function selectedTabIds() {
    return [...el('preview-body').querySelectorAll('input[type=checkbox]:checked')].map(b => Number(b.dataset.tabId));
}

function updateApplyLabel() {
    const n = selectedTabIds().length;
    el('btn-preview-apply').textContent = `${state.verb} ${n} tab${n === 1 ? '' : 's'}`;
    el('btn-preview-apply').disabled = n === 0;
}

function showEmpty(title, subtitle) {
    el('preview-title').textContent = title;
    el('preview-subtitle').textContent = subtitle;
    el('btn-preview-apply').disabled = true;
    el('btn-preview-apply').textContent = 'Apply';
}

/**
 * Opens the preview for a kind ('group-force' | 'group-leaf' | 'dedupe' | 'archive').
 * @param {{ onBack: Function, onDone: Function }} handlers
 */
export async function openPreview(kind, handlers) {
    const config = KINDS[kind];
    state = { kind, handlers, plan: null, verb: '', busy: false };
    el('preview-view').hidden = false;
    el('preview-body').replaceChildren();
    el('preview-title').textContent = config.loading;
    el('preview-subtitle').textContent = kind.startsWith('group') ? 'The first run downloads a small AI model and can take a few seconds.' : '';
    el('preview-view').classList.add('loading');
    el('model-progress').hidden = true;
    el('btn-preview-apply').disabled = true;
    el('btn-preview-apply').textContent = 'Apply';
    el('btn-preview-apply').focus();

    let res;
    try {
        res = await browserAPI.runtime.sendMessage(config.plan());
    } catch (e) {
        res = { status: 'error', error: e.message };
    }
    if (!state || state.kind !== kind) return; // user left the preview
    el('preview-view').classList.remove('loading');
    el('model-progress').hidden = true;
    if (!res || res.status !== 'success') {
        showEmpty('Something went wrong', (res && res.error) || 'Please try again.');
        return;
    }

    if (kind.startsWith('group')) {
        state.plan = res.plan;
        if (!res.plan.groups.length) showEmpty('Nothing to organize', 'There are not enough tabs to group in this window.');
        else renderGroupingPlan(res.plan);
    } else if (kind === 'dedupe') {
        if (!res.tabs.length) showEmpty('No duplicates found', 'Every tab in this window is unique.');
        else {
            el('preview-title').textContent = `${res.tabs.length} duplicate tab${res.tabs.length === 1 ? '' : 's'}`;
            el('preview-subtitle').textContent = 'Closed tabs are archived and can be restored. Untick any tab to keep it.';
            renderTabList(res.tabs, 'Close');
        }
    } else if (kind === 'archive') {
        if (!res.tabs.length) showEmpty('Nothing to archive', `No tabs have been unused for more than ${res.days} day${res.days === 1 ? '' : 's'}.`);
        else {
            el('preview-title').textContent = `${res.tabs.length} tab${res.tabs.length === 1 ? '' : 's'} unused for ${res.days}+ day${res.days === 1 ? '' : 's'}`;
            el('preview-subtitle').textContent = 'Archived tabs stay searchable in the palette for 90 days. Untick any tab to keep it open.';
            renderTabList(res.tabs, 'Archive');
        }
    }
    el('btn-preview-apply').focus();
}

export function isPreviewOpen() {
    return !el('preview-view').hidden;
}

export function closePreview() {
    el('preview-view').hidden = true;
    const handlers = state && state.handlers;
    state = null;
    if (handlers) handlers.onBack();
}

export async function applyPreview() {
    if (!state || state.busy || el('btn-preview-apply').disabled) return;
    state.busy = true;
    const btn = el('btn-preview-apply');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    let message;
    if (state.kind.startsWith('group')) message = { action: 'apply_grouping', plan: state.plan };
    else if (state.kind === 'dedupe') message = { action: 'apply_dedupe', tabIds: selectedTabIds() };
    else message = { action: 'apply_archive', tabIds: selectedTabIds() };
    // Wait for the background to finish before the palette is torn down (see coding standards)
    let result = null;
    try { result = await browserAPI.runtime.sendMessage(message); } catch (e) { console.error(e); }
    const handlers = state.handlers;
    el('preview-view').hidden = true;
    state = null;
    handlers.onDone(result);
}

// The first local-AI run downloads the model; show how far along it is
browserAPI.runtime.onMessage.addListener((message) => {
    if (message.action !== 'model_progress' || !state || !el('preview-view').classList.contains('loading')) return;
    const bar = el('model-progress');
    bar.hidden = message.done;
    bar.firstElementChild.style.width = `${message.percent}%`;
    el('preview-subtitle').textContent = message.done
        ? 'AI model ready. Sorting your tabs…'
        : `Downloading the on-device AI model (one time only)… ${message.percent}%`;
});

el('btn-preview-cancel').addEventListener('click', closePreview);
el('btn-preview-apply').addEventListener('click', applyPreview);
