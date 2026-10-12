import { launch, open, sleep, check } from './harness.mjs';
const [kind, ext] = process.argv.slice(2);
const R = [];
const { browser, api } = await launch(kind, ext);
const countUrl = (pattern) => api(async (p) => (await B.tabs.query({ url: p })).length, pattern);

// Blank tabs survive
const before = (await api(async () => (await B.tabs.query({})).length));
await browser.newPage(); await browser.newPage(); await sleep(800);
check(R, 'second/third blank tab stays open', (await api(async () => (await B.tabs.query({})).length)) === before + 2);

// New tab to an already-open URL is deduplicated
await open(browser, 'https://example.com/'); await sleep(500);
await open(browser, 'https://example.com/'); await sleep(1500);
check(R, 'new tab duplicate is closed', (await countUrl('https://example.com/*')) === 1);

// Navigating an existing tab to an open URL does NOT close it
const p = await open(browser, 'https://www.iana.org/help/example-domains'); await sleep(500);
try { await p.goto('https://example.com/', { timeout: 20000 }); } catch (e) { console.log('nav err', e.message.slice(0, 80)); }
await sleep(1500);
check(R, 'in-tab navigation to an open URL keeps the tab', (await countUrl('https://example.com/*')) === 2);

// Two different pages on one site are not "duplicates"
await open(browser, 'https://developer.mozilla.org/en-US/docs/Web/JavaScript');
await open(browser, 'https://developer.mozilla.org/en-US/docs/Web/CSS');
await sleep(1000);
const dd = await api(async () => {
  const [w] = await B.windows.getAll({ windowTypes: ['normal'] });
  return await B.runtime.sendMessage({ action: 'deduplicate_tabs' });
});
await sleep(1000);
check(R, 'dedupe closes the exact duplicate', dd && dd.exactClosed === 1 && (await countUrl('https://example.com/*')) === 1, JSON.stringify(dd));
check(R, 'dedupe keeps different pages on the same site', (await countUrl('https://developer.mozilla.org/*')) === 2);
const archived = await api(async () => (await B.runtime.sendMessage({ action: 'get_archived_tabs' })).tabs.map(t => t.url));
check(R, 'closed duplicate is archived', archived.some(u => u.startsWith('https://example.com')), JSON.stringify(archived));

// Settings merge + archive threshold + auto-archive alarm
await api(async () => B.runtime.sendMessage({ action: 'save_settings', settings: { cognitiveKey: 'sk-ant-test', cognitiveModel: 'claude-haiku-5-5' } }));
await api(async () => B.runtime.sendMessage({ action: 'save_settings', settings: { archiveAfterDays: 7, autoArchive: true } }));
const st = await api(async () => B.runtime.sendMessage({ action: 'get_settings' }));
check(R, 'saving one setting keeps the others', st.cognitiveKey === 'sk-ant-test' && st.archiveAfterDays === 7, JSON.stringify(st));
check(R, 'auto-archive alarm is scheduled', Boolean(await api(async () => B.alarms.get('auto-archive'))));
await api(async () => B.runtime.sendMessage({ action: 'save_settings', settings: { archiveAfterDays: 0, autoArchive: false } }));
const st2 = await api(async () => B.runtime.sendMessage({ action: 'get_settings' }));
check(R, 'invalid days fall back and alarm is cleared', st2.archiveAfterDays === 3 && !(await api(async () => B.alarms.get('auto-archive'))));
const arch = await api(async () => B.runtime.sendMessage({ action: 'archive_stale_tabs' }));
check(R, 'archive command runs', arch.status === 'success', JSON.stringify(arch));

await browser.close();
const failed = R.filter(r => !r.ok).length;
console.log(`${kind}: ${R.length - failed}/${R.length} passed`);
process.exit(failed ? 1 : 0);
