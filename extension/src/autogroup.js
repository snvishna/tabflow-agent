/**
 * Decides which existing tab group a newly opened tab belongs to.
 * Pure logic, so it can be unit tested; the background supplies tab and group data.
 */
import { extractDomain } from './utils.js';

// Minimum semantic similarity for joining a group without a same-site match
export const AUTO_GROUP_SIMILARITY = 0.5;

/**
 * Picks the best existing group for a tab.
 * 1. A group that already holds tabs from the same site (most same-site tabs wins).
 * 2. Otherwise the group whose tabs are most similar in meaning, if similar enough.
 * @param {{url: string}} tab
 * @param {{id: number, tabs: {url: string}[]}[]} groups named groups in the tab's window
 * @param {(groupId: number) => number} [similarityFor] semantic similarity of the tab to a group (0..1)
 * @returns {number|null} group id, or null to leave the tab alone
 */
export function pickGroupForTab(tab, groups, similarityFor = null) {
    const domain = extractDomain(tab.url);
    if (!domain || groups.length === 0) return null;

    let best = null;
    let bestCount = 0;
    for (const group of groups) {
        const count = group.tabs.filter(t => extractDomain(t.url) === domain).length;
        if (count > bestCount) {
            best = group.id;
            bestCount = count;
        }
    }
    if (best !== null) return best;

    if (!similarityFor) return null;
    let bestScore = AUTO_GROUP_SIMILARITY;
    for (const group of groups) {
        const score = similarityFor(group.id);
        if (score > bestScore) {
            best = group.id;
            bestScore = score;
        }
    }
    return best;
}
