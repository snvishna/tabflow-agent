/**
 * Undo journal for actions that close, archive or regroup tabs.
 * Entries live in session storage (cleared when the browser closes) so they
 * survive service worker restarts.
 */
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const UNDO_KEY = 'undoStack';
const UNDO_MAX = 5;
// Undo is offered for 30 minutes after an action
export const UNDO_TTL_MS = 30 * 60 * 1000;

let undoMutex = Promise.resolve();

function withStack(mutator) {
    const run = undoMutex.then(async () => {
        const res = await browserAPI.storage.session.get([UNDO_KEY]);
        const now = Date.now();
        const stack = (res[UNDO_KEY] || []).filter(e => now - e.createdAt < UNDO_TTL_MS);
        const result = mutator(stack);
        await browserAPI.storage.session.set({ [UNDO_KEY]: stack });
        return result;
    });
    undoMutex = run.catch(() => {});
    return run;
}

/**
 * Records an undoable action and returns its id.
 * @param {{ kind: string, label: string }} entry plus kind-specific data
 */
export function recordUndo(entry) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return withStack(stack => {
        stack.push({ ...entry, id, createdAt: Date.now() });
        while (stack.length > UNDO_MAX) stack.shift();
        return id;
    });
}

/** Returns the most recent undoable action, or null. */
export function peekUndo() {
    return withStack(stack => stack[stack.length - 1] || null);
}

/** Removes and returns an action by id (or the latest when id is omitted). */
export function takeUndo(id) {
    return withStack(stack => {
        const index = id ? stack.findIndex(e => e.id === id) : stack.length - 1;
        if (index < 0) return null;
        return stack.splice(index, 1)[0];
    });
}

/** Captures what is needed to reopen a tab exactly where it was. */
export function describeClosedTab(tab, archivedId = null) {
    return {
        url: tab.url,
        title: tab.title,
        windowId: tab.windowId,
        index: tab.index,
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        groupId: typeof tab.groupId === 'number' ? tab.groupId : -1,
        archivedId
    };
}
