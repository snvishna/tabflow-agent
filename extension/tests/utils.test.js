import { describe, it, expect } from 'vitest';
import { cosineSimilarity, extractDomain, fuzzyMatch, canShowOverlay } from '../src/utils.js';

describe('cosineSimilarity', () => {
    it('should calculate identical vectors as 1.0', () => {
        const vecA = [1, 2, 3];
        const vecB = [1, 2, 3];
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
    });

    it('should calculate orthogonal vectors as 0', () => {
        const vecA = [1, 0];
        const vecB = [0, 1];
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0);
    });
    
    it('should calculate opposite vectors as -1', () => {
        const vecA = [1, 1];
        const vecB = [-1, -1];
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1);
    });

    it('should handle zero vectors gracefully', () => {
        const vecA = [0, 0];
        const vecB = [1, 1];
        expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });
});

describe('extractDomain', () => {
    it('should extract hostname without www', () => {
        expect(extractDomain('https://www.github.com/google')).toBe('github.com');
    });

    it('should handle subdomains', () => {
        expect(extractDomain('https://api.example.com/v1')).toBe('api.example.com');
    });

    it('should gracefully handle invalid URLs', () => {
        expect(extractDomain('not a url')).toBe('');
    });
});

describe('fuzzyMatch', () => {
    it('should return true for empty query', () => {
        expect(fuzzyMatch('', 'hello world')).toBe(true);
        expect(fuzzyMatch('   ', 'hello world')).toBe(true);
    });

    it('should return false for empty target if query is not empty', () => {
        expect(fuzzyMatch('test', '')).toBe(false);
    });

    it('should match exactly', () => {
        expect(fuzzyMatch('hello', 'hello world')).toBe(true);
    });

    it('should match case-insensitively', () => {
        expect(fuzzyMatch('HeLLo', 'hello WORLD')).toBe(true);
    });

    it('should match out of order tokens (fuzzy AND search)', () => {
        expect(fuzzyMatch('world hello', 'hello beautiful world')).toBe(true);
    });

    it('should match partial tokens within words', () => {
        expect(fuzzyMatch('vec comp', 'vector databases: a complete guide')).toBe(true);
    });

    it('should fail if any token is missing', () => {
        expect(fuzzyMatch('vec comp random', 'vector databases: a complete guide')).toBe(false);
    });
});

describe('canShowOverlay', () => {
    it('should allow ordinary web pages', () => {
        expect(canShowOverlay('https://example.com/page')).toBe(true);
        expect(canShowOverlay('http://localhost:3000/')).toBe(true);
    });

    it('should refuse browser pages', () => {
        for (const url of ['about:debugging#/runtime/this-firefox', 'about:newtab', 'chrome://extensions/', 'edge://settings',
            'brave://settings', 'view-source:https://example.com', 'chrome-extension://abc/page.html', 'moz-extension://abc/page.html',
            'file:///home/me/notes.html', '', undefined]) {
            expect(canShowOverlay(url)).toBe(false);
        }
    });

    it('should refuse extension stores', () => {
        expect(canShowOverlay('https://chromewebstore.google.com/detail/x')).toBe(false);
        expect(canShowOverlay('https://chrome.google.com/webstore/detail/x')).toBe(false);
        expect(canShowOverlay('https://addons.mozilla.org/addon/tabflow-agent/')).toBe(false);
        expect(canShowOverlay('https://microsoftedge.microsoft.com/addons/detail/x')).toBe(false);
        expect(canShowOverlay('https://chrome.google.com/search')).toBe(true);
    });
});
