/**
 * Toolbar icon badge: shows the tab count of the focused window, and briefly
 * flashes the result of an action (e.g. "−3" after closing three duplicates).
 */
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const COUNT_COLOR = '#5f6368';
const FLASH_MS = 3000;
let flashUntil = 0;
let refreshTimer = null;

async function shortcutHint() {
    try {
        const commands = await browserAPI.commands.getAll();
        const palette = commands.find(c => c.name === 'toggle-palette');
        return palette && palette.shortcut ? ` (${palette.shortcut})` : '';
    } catch (e) {
        return '';
    }
}

/**
 * Updates the badge to the current tab count (or clears it when disabled).
 * @param {boolean} showTabCount the user's setting
 */
export async function refreshBadge(showTabCount) {
    if (!browserAPI.action || Date.now() < flashUntil) return;
    try {
        let count = 0;
        try {
            const win = await browserAPI.windows.getLastFocused({ windowTypes: ['normal'], populate: true });
            count = (win.tabs || []).length;
        } catch (e) { /* no normal window */ }
        await browserAPI.action.setBadgeBackgroundColor({ color: COUNT_COLOR });
        if (browserAPI.action.setBadgeTextColor) await browserAPI.action.setBadgeTextColor({ color: '#ffffff' });
        await browserAPI.action.setBadgeText({ text: showTabCount && count > 0 ? String(count) : '' });
        await browserAPI.action.setTitle({ title: `TabFlow Agent — ${count} tab${count === 1 ? '' : 's'} in this window${await shortcutHint()}` });
    } catch (e) {
        console.error("Badge update failed:", e);
    }
}

/** Debounced refresh for bursts of tab events. */
export function scheduleBadgeRefresh(getShowTabCount) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => refreshBadge(await getShowTabCount()), 150);
}

/**
 * Briefly shows text on the badge, then returns to the tab count.
 * @param {string} text e.g. "−3"
 * @param {string} color badge background
 */
export async function flashBadge(text, color, getShowTabCount) {
    if (!browserAPI.action) return;
    flashUntil = Date.now() + FLASH_MS;
    try {
        await browserAPI.action.setBadgeBackgroundColor({ color });
        await browserAPI.action.setBadgeText({ text });
    } catch (e) { /* ignore */ }
    setTimeout(async () => {
        flashUntil = 0;
        refreshBadge(await getShowTabCount());
    }, FLASH_MS);
}
