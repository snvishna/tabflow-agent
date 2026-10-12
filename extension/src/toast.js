/**
 * In-page toast with an Undo button, injected into the active tab after an action.
 * Falls back to the action badge on pages where scripts cannot run (browser pages).
 */
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Runs inside the web page: must be self-contained (no closures over module scope).
function renderToast(message, undoId, undoLabel) {
    const HOST_ID = 'tabflow-agent-toast';
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const style = document.createElement('style');
    style.textContent = `
        .toast { display:flex; align-items:center; gap:12px; padding:10px 12px 10px 16px; border-radius:12px;
            font:500 14px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background:${dark ? 'rgba(44,44,46,0.96)' : 'rgba(255,255,255,0.98)'}; color:${dark ? '#f5f5f7' : '#1d1d1f'};
            box-shadow:0 12px 32px rgba(0,0,0,0.25), 0 0 0 1px ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
            ${reduceMotion ? '' : 'animation: in 180ms ease-out;'} max-width: 520px; }
        @keyframes in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
        .msg { flex:1; }
        button { font:600 13px/1 inherit; border:0; border-radius:8px; padding:8px 12px; cursor:pointer; }
        .undo { background:#0A84FF; color:#fff; }
        .undo:focus-visible, .close:focus-visible { outline:2px solid #0A84FF; outline-offset:2px; }
        .close { background:transparent; color:inherit; opacity:0.6; padding:6px 8px; font-size:16px; }
    `;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = message;
    toast.appendChild(msg);

    let timer = setTimeout(() => host.remove(), 8000);
    if (undoId) {
        const undo = document.createElement('button');
        undo.className = 'undo';
        undo.textContent = undoLabel || 'Undo';
        undo.addEventListener('click', async () => {
            clearTimeout(timer);
            undo.disabled = true;
            const api = typeof browser !== 'undefined' ? browser : chrome;
            try {
                const res = await api.runtime.sendMessage({ action: 'undo', id: undoId });
                msg.textContent = res && res.status === 'success' ? 'Restored.' : 'Nothing left to undo.';
            } catch (e) {
                msg.textContent = 'Undo failed.';
            }
            undo.remove();
            timer = setTimeout(() => host.remove(), 2000);
        });
        toast.appendChild(undo);
    }
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => host.remove());
    toast.appendChild(close);

    root.append(style, toast);
    (document.body || document.documentElement).appendChild(host);
}

/**
 * Shows a toast in the active tab of the given (or last focused) window.
 * @returns {Promise<boolean>} true when the toast could be shown in the page
 */
export async function showToast(message, { undoId = null, windowId = null } = {}) {
    try {
        const query = windowId ? { active: true, windowId } : { active: true, lastFocusedWindow: true };
        const [tab] = await browserAPI.tabs.query(query);
        if (!tab) return false;
        await browserAPI.scripting.executeScript({
            target: { tabId: tab.id },
            func: renderToast,
            args: [message, undoId, 'Undo']
        });
        return true;
    } catch (e) {
        // Browser pages (new tab, settings) do not allow scripts; the palette still lists the undo
        return false;
    }
}
