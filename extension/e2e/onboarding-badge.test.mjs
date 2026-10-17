import { launch, open, sleep, check } from './harness.mjs';
const [kind, ext] = process.argv.slice(2);
const SHOTS = process.env.SHOTS;
const R = [];
const { browser, base, extPage, api } = await launch(kind, ext);
const send = (msg) => api(async (m) => B.runtime.sendMessage(m), msg);
const badge = () => api(async () => B.action.getBadgeText({}));

// Listen for model progress in the extension page
await api(() => { globalThis.__progress = []; B.runtime.onMessage.addListener(m => { if (m.action === 'model_progress') __progress.push(m); }); });

const welcome = await api(async (base) => (await B.tabs.query({})).filter(t => (t.url || '').startsWith(base + '/welcome.html')).length, base);
check(R, 'welcome page opens on install', welcome === 1);

for (const u of ['https://example.com/', 'https://www.iana.org/help/example-domains', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript']) await open(browser, u);
await sleep(1500);
const tabCount = await api(async () => (await B.windows.getLastFocused({ windowTypes: ['normal'], populate: true })).tabs.length);
check(R, 'badge shows the tab count', (await badge()) === String(tabCount), `badge=${await badge()} tabs=${tabCount}`);

await send({ action: 'plan_grouping', mode: 'force' });
const progress = await api(() => __progress);
check(R, 'model download progress is reported', progress.length > 0 && progress[progress.length - 1].done === true, `${progress.length} events, last=${JSON.stringify(progress[progress.length - 1])}`);

// Make a duplicate in an existing tab and close it -> badge flash
const p = await open(browser, 'https://www.iana.org/domains'); await sleep(300);
try { await p.goto('https://example.com/', { timeout: 20000 }); } catch (e) {}
await sleep(800);
const plan = await send({ action: 'plan_dedupe' });
await send({ action: 'apply_dedupe', tabIds: plan.tabs.map(t => t.id) });
check(R, 'badge flashes the result of an action', (await badge()) === '−1', await badge());
await sleep(3500);
check(R, 'badge returns to the tab count', /^\d+$/.test(await badge()), await badge());

await send({ action: 'save_settings', settings: { showTabCount: false } });
await sleep(300);
check(R, 'tab count can be turned off', (await badge()) === '', JSON.stringify(await badge()));
await send({ action: 'save_settings', settings: { showTabCount: true } });

const shortcuts = await api(async () => (await B.commands.getAll()).map(c => [c.name, c.shortcut]));
check(R, 'shortcuts registered', shortcuts.some(([n]) => n === 'toggle-palette') && shortcuts.some(([n]) => n === 'undo-last-action'), JSON.stringify(shortcuts));

// Browser pages can't host the overlay, so their tabs get the palette as the toolbar popup
await open(browser, kind === 'firefox' ? 'about:robots' : 'chrome://version/');
await sleep(800);
const popups = await api(async () => Promise.all((await B.tabs.query({})).map(async t => [t.url, await B.action.getPopup({ tabId: t.id })])));
const popupFor = prefix => (popups.find(([u]) => (u || '').startsWith(prefix)) || [])[1];
check(R, 'browser pages open the palette as the toolbar popup', /palette\.html$/.test(popupFor(kind === 'firefox' ? 'about:robots' : 'chrome://version') || ''), JSON.stringify(popups));
check(R, 'web pages keep the in-page palette', popupFor('https://example.com') === '', JSON.stringify(popups));

if (kind === 'chrome') {
  for (const scheme of ['light', 'dark']) {
    const w = await browser.newPage();
    await w.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await w.setViewport({ width: 1000, height: 1300 });
    await w.goto(`${base}/welcome.html`);
    await sleep(800);
    const sc = await w.$eval('#palette-shortcut', e => e.textContent);
    if (scheme === 'light') check(R, 'welcome shows the palette shortcut', /Shift\+Space/.test(sc), sc);
    await w.screenshot({ path: `${SHOTS}/welcome-${scheme}.png`, fullPage: true });

    const pal = await browser.newPage();
    await pal.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await pal.setViewport({ width: 900, height: 760 });
    await pal.goto(`${base}/palette.html`);
    await sleep(800);
    await pal.screenshot({ path: `${SHOTS}/palette-${scheme}.png` });
    await pal.type('#search-input', '>');
    await sleep(200);
    await pal.screenshot({ path: `${SHOTS}/commands-${scheme}.png` });
    await pal.type('#search-input', 'settings');
    await pal.keyboard.press('Enter');
    await sleep(600);
    await pal.screenshot({ path: `${SHOTS}/settings-${scheme}.png` });
    if (scheme === 'dark') {
      const rows = await pal.$$eval('#shortcut-list kbd', els => els.length);
      check(R, 'settings lists shortcuts', rows >= 2, String(rows));
    }
    await pal.close();
  }

  // Welcome page: guided organize with inline undo
  const w = await browser.newPage();
  await w.setViewport({ width: 1000, height: 1300 });
  await w.goto(`${base}/welcome.html`);
  await sleep(500);
  await w.click('#btn-try-organize');
  await w.waitForFunction(() => !document.getElementById('preview-view').hidden && !document.getElementById('preview-view').classList.contains('loading'), { timeout: 60000 });
  await w.screenshot({ path: `${SHOTS}/welcome-preview.png`, fullPage: true });
  await w.click('#btn-preview-apply');
  await w.waitForFunction(() => !document.getElementById('try-result-row').hidden, { timeout: 20000 });
  const groups = await api(async () => (await B.tabGroups.query({})).length);
  check(R, 'welcome: organize applies groups', groups > 0, String(groups));
  check(R, 'welcome: shows Undo', await w.$eval('#btn-try-undo', b => !b.hidden));
  await w.click('#btn-try-undo');
  await sleep(800);
  check(R, 'welcome: Undo removes the groups', (await api(async () => (await B.tabGroups.query({})).length)) === 0);
}

await browser.close();
const failed = R.filter(r => !r.ok).length;
console.log(`${kind}: ${R.length - failed}/${R.length} passed`);
process.exit(failed ? 1 : 0);
