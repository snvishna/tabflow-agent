import { openPreview, isPreviewOpen, closePreview, applyPreview } from './preview.js';

const browserAPI = typeof browser !== "undefined" ? browser : chrome;
const el = id => document.getElementById(id);

async function showShortcuts() {
    let commands = [];
    try { commands = await browserAPI.commands.getAll(); } catch (e) { /* unavailable */ }
    const palette = commands.find(c => c.name === 'toggle-palette');
    const undo = commands.find(c => c.name === 'undo-last-action');
    const setKbd = (target, shortcut) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = shortcut;
        el(target).replaceChildren(kbd);
    };
    if (palette && palette.shortcut) setKbd('palette-shortcut', palette.shortcut);
    else {
        el('palette-shortcut').textContent = 'your shortcut';
        el('shortcut-warning').hidden = false;
    }
    if (undo && undo.shortcut) setKbd('undo-shortcut', undo.shortcut);
    else el('undo-shortcut').textContent = 'the Undo shortcut (set one below)';
}

// Firefox has no puzzle-piece menu tip to give
if (typeof browser !== "undefined") {
    el('pin-hint').textContent = 'Tip: if the TabFlow icon is hidden, right-click the toolbar and choose Customize Toolbar to add it.';
}

el('btn-open-palette').addEventListener('click', () => {
    browserAPI.runtime.sendMessage({ action: 'open_palette' }).catch(() => {});
});
el('btn-shortcuts').addEventListener('click', () => {
    browserAPI.runtime.sendMessage({ action: 'open_shortcut_settings' }).catch(() => {});
});

let lastUndoId = null;

function startPreview(kind, doneMessage) {
    el('try-actions').hidden = true;
    el('try-result-row').hidden = true;
    openPreview(kind, {
        onBack: () => { el('try-actions').hidden = false; },
        onDone: (result) => {
            el('try-actions').hidden = false;
            lastUndoId = result && result.undoId;
            el('try-result').textContent = doneMessage;
            el('btn-try-undo').hidden = !lastUndoId;
            el('try-result-row').hidden = false;
        }
    });
}

el('btn-try-undo').addEventListener('click', async () => {
    try { await browserAPI.runtime.sendMessage({ action: 'undo', id: lastUndoId }); } catch (e) { /* already undone */ }
    el('try-result').textContent = 'Undone. Everything is back the way it was.';
    el('btn-try-undo').hidden = true;
});

el('btn-try-organize').addEventListener('click', () => startPreview('group-force', 'Done! Your tabs are grouped.'));
el('btn-try-dedupe').addEventListener('click', () => startPreview('dedupe', 'Done! Closed duplicates are archived and can be restored from the palette.'));

document.addEventListener('keydown', (e) => {
    if (!isPreviewOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closePreview(); }
    else if (e.key === 'Enter' && !(document.activeElement && document.activeElement.classList.contains('group-name'))) {
        e.preventDefault();
        applyPreview();
    }
});

showShortcuts();
