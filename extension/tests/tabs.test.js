import { describe, it, expect } from 'vitest';
import { isWebUrl, normalizeUrl, hostMatchesDomain, planExactDuplicates, planClusterClosures, selectStaleTabs, sanitizeArchiveDays } from '../src/utils.js';
import { detectProvider, defaultsForKey, modelMatchesKey, isDefaultModel } from '../src/providers.js';

const DAY = 24 * 60 * 60 * 1000;
const tab = (id, url, extra = {}) => ({ id, url, lastAccessed: 0, ...extra });

describe('isWebUrl', () => {
    it('accepts http and https', () => {
        expect(isWebUrl('https://example.com/')).toBe(true);
        expect(isWebUrl('http://localhost:3000')).toBe(true);
    });
    it('rejects blank, new-tab and browser pages', () => {
        for (const u of ['about:blank', 'about:newtab', 'chrome://newtab/', 'chrome-extension://x/palette.html', 'moz-extension://x/a', 'file:///tmp/a', '', undefined]) {
            expect(isWebUrl(u)).toBe(false);
        }
    });
});

describe('normalizeUrl', () => {
    it('ignores fragments and trailing slashes but keeps the query', () => {
        expect(normalizeUrl('https://a.com/x/#top')).toBe(normalizeUrl('https://a.com/x'));
        expect(normalizeUrl('https://a.com/x?q=1')).not.toBe(normalizeUrl('https://a.com/x?q=2'));
    });
});

describe('hostMatchesDomain', () => {
    it('matches the domain and its subdomains only', () => {
        expect(hostMatchesDomain('google.com', 'google.com')).toBe(true);
        expect(hostMatchesDomain('mail.google.com', 'google.com')).toBe(true);
        expect(hostMatchesDomain('notgoogle.com', 'google.com')).toBe(false);
        expect(hostMatchesDomain('google.com.evil.io', 'google.com')).toBe(false);
        expect(hostMatchesDomain('docs.google.com', '*.google.com')).toBe(true);
        expect(hostMatchesDomain('', 'google.com')).toBe(false);
    });
});

describe('planExactDuplicates', () => {
    it('keeps one tab per URL and prefers the active tab', () => {
        const tabs = [
            tab(1, 'https://a.com/x', { lastAccessed: 5 }),
            tab(2, 'https://a.com/x/', { active: true }),
            tab(3, 'https://a.com/x#frag', { lastAccessed: 9 }),
            tab(4, 'https://a.com/y')
        ];
        const { toClose, toKeep } = planExactDuplicates(tabs);
        expect(toClose.map(t => t.id).sort()).toEqual([1, 3]);
        expect(toKeep.map(t => t.id).sort()).toEqual([2, 4]);
    });
    it('never closes pinned or audible tabs', () => {
        const tabs = [tab(1, 'https://a.com', { lastAccessed: 9 }), tab(2, 'https://a.com', { pinned: true }), tab(3, 'https://a.com', { audible: true })];
        const { toClose } = planExactDuplicates(tabs);
        expect(toClose.map(t => t.id)).toEqual([1]);
    });
    it('ignores blank and browser pages', () => {
        const tabs = [tab(1, 'about:blank'), tab(2, 'about:blank'), tab(3, 'chrome://newtab/'), tab(4, 'chrome://newtab/')];
        expect(planExactDuplicates(tabs).toClose).toEqual([]);
    });
});

describe('planClusterClosures', () => {
    it('keeps the most recently used tab', () => {
        const closed = planClusterClosures([tab(1, 'https://a.com/1', { lastAccessed: 1 }), tab(2, 'https://a.com/2', { lastAccessed: 2 })]);
        expect(closed.map(t => t.id)).toEqual([1]);
    });
    it('closes nothing for a single tab', () => {
        expect(planClusterClosures([tab(1, 'https://a.com')])).toEqual([]);
    });
});

describe('selectStaleTabs', () => {
    const now = 100 * DAY;
    it('selects only web tabs older than the threshold', () => {
        const tabs = [
            tab(1, 'https://a.com', { lastAccessed: now - 4 * DAY }),
            tab(2, 'https://a.com', { lastAccessed: now - 2 * DAY }),
            tab(3, 'https://a.com', { lastAccessed: now - 10 * DAY, pinned: true }),
            tab(4, 'https://a.com', { lastAccessed: now - 10 * DAY, active: true }),
            tab(5, 'https://a.com', { lastAccessed: now - 10 * DAY, audible: true }),
            tab(6, 'chrome://settings', { lastAccessed: now - 10 * DAY })
        ];
        expect(selectStaleTabs(tabs, now, 3).map(t => t.id)).toEqual([1]);
        expect(selectStaleTabs(tabs, now, 1).map(t => t.id)).toEqual([1, 2]);
    });
});

describe('sanitizeArchiveDays', () => {
    it('clamps to 1..365 and falls back on junk', () => {
        expect(sanitizeArchiveDays(7)).toBe(7);
        expect(sanitizeArchiveDays('14')).toBe(14);
        expect(sanitizeArchiveDays(0)).toBe(3);
        expect(sanitizeArchiveDays('abc')).toBe(3);
        expect(sanitizeArchiveDays(1000)).toBe(365);
        expect(sanitizeArchiveDays(undefined)).toBe(3);
    });
});

describe('providers', () => {
    it('detects providers from key prefixes', () => {
        expect(detectProvider('sk-ant-abc')).toBe('anthropic');
        expect(detectProvider('sk-proj-abc')).toBe('openai');
        expect(detectProvider('AIzaXYZ')).toBe('gemini');
        expect(detectProvider('AQ.abc')).toBe('gemini');
        expect(detectProvider('jev-1')).toBe('typesafe');
        expect(detectProvider('random')).toBe(null);
    });
    it('returns defaults for known keys and blanks otherwise', () => {
        expect(defaultsForKey('sk-ant-x').url).toContain('anthropic.com');
        expect(defaultsForKey('nope')).toEqual({ url: '', model: '' });
    });
    it('preserves manual model overrides from the same family', () => {
        expect(modelMatchesKey('sk-ant-x', 'claude-sonnet-5-5')).toBe(true);
        expect(modelMatchesKey('sk-ant-x', 'gpt-4.1-mini')).toBe(false);
        expect(modelMatchesKey('sk-x', 'gpt-4o')).toBe(true);
    });
    it('recognises built-in default models', () => {
        expect(isDefaultModel(defaultsForKey('AIza1').model)).toBe(true);
        expect(isDefaultModel('my-custom-model')).toBe(false);
    });
});

import { parseDomainList, urlMatchesDomains, withSettingDefaults } from '../src/utils.js';
import { pickGroupForTab } from '../src/autogroup.js';

describe('parseDomainList', () => {
    it('cleans URLs, wildcards, ports and duplicates', () => {
        expect(parseDomainList('https://www.GitHub.com/foo\n*.google.com, localhost:3000\n\nexample.com example.com')).toEqual(['github.com', 'google.com', 'localhost', 'example.com']);
    });
    it('drops junk', () => {
        expect(parseDomainList('not a domain!\n.bad\nbad.')).toEqual(['not', 'a']);
        expect(parseDomainList('')).toEqual([]);
        expect(parseDomainList(undefined)).toEqual([]);
    });
});

describe('urlMatchesDomains', () => {
    it('matches subdomains and ignores non-web URLs', () => {
        expect(urlMatchesDomains('https://mail.google.com/x', ['google.com'])).toBe(true);
        expect(urlMatchesDomains('https://example.com', ['google.com'])).toBe(false);
        expect(urlMatchesDomains('not a url', ['google.com'])).toBe(false);
        expect(urlMatchesDomains('https://google.com', [])).toBe(false);
    });
});

describe('withSettingDefaults', () => {
    it('fills defaults', () => {
        const s = withSettingDefaults(undefined);
        expect(s).toMatchObject({ archiveAfterDays: 3, autoArchive: false, autoGroup: true, neverClose: [], singleInstance: ['localhost'] });
    });
    it('keeps AI settings and cleans lists given as text', () => {
        const s = withSettingDefaults({ cognitiveKey: 'k', neverClose: 'https://mail.google.com/\nfoo.com', singleInstance: [], autoGroup: false, archiveAfterDays: '0' });
        expect(s.cognitiveKey).toBe('k');
        expect(s.neverClose).toEqual(['mail.google.com', 'foo.com']);
        expect(s.singleInstance).toEqual([]);
        expect(s.autoGroup).toBe(false);
        expect(s.archiveAfterDays).toBe(3);
    });
});

describe('pickGroupForTab', () => {
    const groups = [
        { id: 1, tabs: [{ url: 'https://github.com/a' }] },
        { id: 2, tabs: [{ url: 'https://github.com/b' }, { url: 'https://www.github.com/c' }] },
        { id: 3, tabs: [{ url: 'https://news.ycombinator.com' }] }
    ];
    it('prefers the group with the most same-site tabs', () => {
        expect(pickGroupForTab({ url: 'https://github.com/new' }, groups)).toBe(2);
    });
    it('falls back to semantic similarity above the threshold', () => {
        const sim = { 1: 0.2, 2: 0.3, 3: 0.7 };
        expect(pickGroupForTab({ url: 'https://lobste.rs' }, groups, id => sim[id])).toBe(3);
        expect(pickGroupForTab({ url: 'https://lobste.rs' }, groups, () => 0.4)).toBe(null);
    });
    it('leaves the tab alone without groups or a valid URL', () => {
        expect(pickGroupForTab({ url: 'https://github.com' }, [])).toBe(null);
        expect(pickGroupForTab({ url: 'about:blank' }, groups, () => 0.9)).toBe(null);
    });
});
