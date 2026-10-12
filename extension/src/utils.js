/**
 * Calculates the cosine similarity between two mathematical vectors.
 * @param {Float32Array|Array} vecA 
 * @param {Float32Array|Array} vecB 
 * @returns {number} Score between -1 and 1
 */
export function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extracts the root domain from a URL string safely.
 */
export function extractDomain(urlString) {
    try {
        const url = new URL(urlString);
        return url.hostname.replace(/^www\./, '');
    } catch (e) {
        return '';
    }
}

/**
 * Checks if all space-separated words in a query exist within a target string.
 * This is used for intuitive, order-agnostic fuzzy searching.
 * @param {string} query The user's search string
 * @param {string} target The string to search inside (e.g. title + url)
 * @returns {boolean}
 */
export function fuzzyMatch(query, target) {
    if (!query) return true;
    if (!target) return false;
    
    const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    const searchTarget = target.toLowerCase();
    
    return terms.every(term => searchTarget.includes(term));
}

/**
 * True for http(s) URLs, the only pages the extension deduplicates, groups or archives.
 */
export function isWebUrl(urlString) {
    try {
        const { protocol } = new URL(urlString);
        return protocol === 'http:' || protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/**
 * Normalizes a URL for exact-duplicate comparison: drops the hash and a trailing slash.
 */
export function normalizeUrl(urlString) {
    try {
        const parsed = new URL(urlString);
        return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
    } catch (e) {
        return urlString;
    }
}

/**
 * True when hostname is the domain itself or one of its subdomains.
 * "mail.google.com" matches "google.com"; "notgoogle.com" does not.
 */
export function hostMatchesDomain(hostname, domain) {
    if (!hostname || !domain) return false;
    const h = hostname.toLowerCase();
    const d = domain.toLowerCase().replace(/^\*?\./, '');
    return h === d || h.endsWith('.' + d);
}

/**
 * Ranks which tab of a duplicate set to keep: active, then pinned, then audible, then most recently used.
 */
function keepPriority(tab) {
    return [tab.active ? 1 : 0, tab.pinned ? 1 : 0, tab.audible ? 1 : 0, tab.lastAccessed || 0];
}

function compareKeep(a, b) {
    const pa = keepPriority(a), pb = keepPriority(b);
    for (let i = 0; i < pa.length; i++) {
        if (pa[i] !== pb[i]) return pb[i] - pa[i];
    }
    return 0;
}

/**
 * Plans exact-duplicate closures. Tabs whose normalized URLs match are a duplicate set;
 * one tab per set is kept (see keepPriority) and the rest are returned for closing.
 * Pinned and audible tabs are never closed. Non-web URLs are ignored.
 * @returns {{ toClose: object[], toKeep: object[] }}
 */
export function planExactDuplicates(tabs) {
    const sets = new Map();
    const toKeep = [];
    for (const tab of tabs) {
        if (!isWebUrl(tab.url)) { toKeep.push(tab); continue; }
        const key = normalizeUrl(tab.url);
        if (!sets.has(key)) sets.set(key, []);
        sets.get(key).push(tab);
    }
    const toClose = [];
    for (const set of sets.values()) {
        set.sort(compareKeep);
        toKeep.push(set[0]);
        for (const tab of set.slice(1)) {
            if (tab.pinned || tab.audible) toKeep.push(tab);
            else toClose.push(tab);
        }
    }
    return { toClose, toKeep };
}

/**
 * Picks which tabs of a near-duplicate cluster to close: keeps the best tab (see keepPriority)
 * and never closes pinned or audible tabs.
 */
export function planClusterClosures(clusterTabs) {
    if (clusterTabs.length < 2) return [];
    const sorted = [...clusterTabs].sort(compareKeep);
    return sorted.slice(1).filter(t => !t.pinned && !t.audible);
}

/**
 * Selects tabs to archive: web pages not used for more than `days` days that are
 * not active, pinned or playing audio.
 */
export function selectStaleTabs(tabs, now, days) {
    const threshold = days * 24 * 60 * 60 * 1000;
    return tabs.filter(tab =>
        !tab.active && !tab.pinned && !tab.audible &&
        isWebUrl(tab.url) &&
        tab.lastAccessed && (now - tab.lastAccessed > threshold)
    );
}

/** Clamps the user's archive threshold to a whole number of days between 1 and 365. */
export function sanitizeArchiveDays(value, fallback = 3) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, 365);
}

/**
 * Parses a user-entered list of sites (one per line or comma separated) into clean domains.
 * Accepts "https://www.github.com/foo", "*.google.com", "localhost:3000" and drops junk.
 * @returns {string[]} unique lower-case domains
 */
export function parseDomainList(text) {
    if (!text) return [];
    const domains = String(text).split(/[\s,]+/).map(entry => {
        let d = entry.trim().toLowerCase();
        if (!d) return '';
        d = d.replace(/^[a-z]+:\/\//, '').replace(/^\*\./, '').replace(/^www\./, '');
        d = d.split(/[/?#]/)[0].split(':')[0];
        return /^[a-z0-9.-]+$/.test(d) && !d.startsWith('.') && !d.endsWith('.') ? d : '';
    }).filter(Boolean);
    return [...new Set(domains)];
}

/** True when the URL's host is one of the domains (or their subdomains). */
export function urlMatchesDomains(urlString, domains) {
    if (!domains || domains.length === 0) return false;
    try {
        const { hostname } = new URL(urlString);
        return domains.some(d => hostMatchesDomain(hostname, d));
    } catch (e) {
        return false;
    }
}

/** Defaults for the non-AI settings. */
export const SETTING_DEFAULTS = {
    archiveAfterDays: 3,
    autoArchive: false,
    autoGroup: true,
    neverClose: [],
    singleInstance: ['localhost'],
    showTabCount: true
};

/**
 * Fills in defaults and cleans user-entered values (day range, domain lists).
 * Domain lists may be stored as arrays or as raw text.
 */
export function withSettingDefaults(stored = {}) {
    const s = { ...SETTING_DEFAULTS, ...(stored || {}) };
    const toList = v => parseDomainList(Array.isArray(v) ? v.join('\n') : v);
    s.archiveAfterDays = sanitizeArchiveDays(s.archiveAfterDays);
    s.autoArchive = Boolean(s.autoArchive);
    s.autoGroup = s.autoGroup !== false;
    s.showTabCount = s.showTabCount !== false;
    s.neverClose = toList(s.neverClose);
    s.singleInstance = toList(s.singleInstance);
    return s;
}
