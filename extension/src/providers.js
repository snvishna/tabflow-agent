/**
 * Default endpoint and model for each AI provider, detected from the API key prefix.
 * Shared by the background worker and the palette settings UI.
 */
export const PROVIDER_DEFAULTS = {
    anthropic: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-5-5', modelPrefixes: ['claude'] },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-3.6-flash', modelPrefixes: ['gemini'] },
    typesafe: { url: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', modelPrefixes: ['jev'] },
    openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4.1-mini', modelPrefixes: ['gpt', 'o1', 'o3', 'o4'] }
};

/**
 * Returns the provider id for an API key, or null when the prefix is unknown.
 * @param {string} key
 * @returns {string|null}
 */
export function detectProvider(key) {
    if (!key) return null;
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('AIza') || key.startsWith('AQ')) return 'gemini';
    if (key.startsWith('ts-') || key.startsWith('jev-')) return 'typesafe';
    if (key.startsWith('sk-')) return 'openai';
    return null;
}

/**
 * Returns { url, model } defaults for a key, or empty strings when the provider is unknown.
 * @param {string} key
 */
export function defaultsForKey(key) {
    const provider = detectProvider(key);
    if (!provider) return { url: '', model: '' };
    const { url, model } = PROVIDER_DEFAULTS[provider];
    return { url, model };
}

/**
 * True when a model name belongs to the provider of the given key, so a manual
 * override such as a newer model of the same family is preserved.
 */
export function modelMatchesKey(key, model) {
    const provider = detectProvider(key);
    if (!provider || !model) return false;
    return PROVIDER_DEFAULTS[provider].modelPrefixes.some(p => model.startsWith(p));
}

/** True when the model is one of the built-in defaults. */
export function isDefaultModel(model) {
    return Object.values(PROVIDER_DEFAULTS).some(p => p.model === model);
}
