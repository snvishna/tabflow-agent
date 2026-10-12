import { describe, it, expect, beforeAll, vi } from 'vitest';

// Minimal in-memory chrome.storage.session for the undo journal
const store = {};
globalThis.chrome = {
    storage: {
        session: {
            get: async (keys) => Object.fromEntries(keys.map(k => [k, store[k]])),
            set: async (obj) => Object.assign(store, obj)
        }
    }
};

let undo;
beforeAll(async () => { undo = await import('../src/undo.js'); });

describe('undo journal', () => {
    it('returns the latest entry and removes it when taken', async () => {
        const a = await undo.recordUndo({ kind: 'close', label: 'A', tabs: [] });
        const b = await undo.recordUndo({ kind: 'close', label: 'B', tabs: [] });
        expect((await undo.peekUndo()).id).toBe(b);
        expect((await undo.takeUndo()).label).toBe('B');
        expect((await undo.takeUndo(a)).label).toBe('A');
        expect(await undo.takeUndo()).toBe(null);
    });

    it('keeps at most five entries', async () => {
        for (let i = 0; i < 7; i++) await undo.recordUndo({ kind: 'close', label: `L${i}`, tabs: [] });
        expect(store.undoStack.length).toBe(5);
        expect(store.undoStack[0].label).toBe('L2');
        while (await undo.takeUndo()) { /* drain */ }
    });

    it('expires entries after 30 minutes', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        await undo.recordUndo({ kind: 'close', label: 'old', tabs: [] });
        vi.setSystemTime(new Date('2026-01-01T00:31:00Z'));
        expect(await undo.peekUndo()).toBe(null);
        vi.useRealTimers();
    });

    it('describes closed tabs for reopening', () => {
        const d = undo.describeClosedTab({ url: 'https://a.com', title: 'A', windowId: 1, index: 3, pinned: true, groupId: 7 }, 42);
        expect(d).toEqual({ url: 'https://a.com', title: 'A', windowId: 1, index: 3, pinned: true, active: false, groupId: 7, archivedId: 42 });
        expect(undo.describeClosedTab({ url: 'x' }).groupId).toBe(-1);
    });
});
