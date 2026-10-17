import { launch, open, sleep, check } from './harness.mjs';
const [kind, ext] = process.argv.slice(2);
const R = [];
const { browser, base, extPage, api } = await launch(kind, ext);
const countUrl = (p) => api(async (p) => (await B.tabs.query({ url: p })).length, p);
const groupTitles = () => api(async () => (await B.tabGroups.query({})).map(g => g.title).sort());

const pages = [];
for (const u of ['https://example.com/', 'https://www.iana.org/help/example-domains', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', 'https://developer.mozilla.org/en-US/docs/Web/CSS', 'https://www.wikipedia.org/']) pages.push(await open(browser, u));
await sleep(1000);

// --- Grouping preview + apply + undo
const plan = await api(async () => B.runtime.sendMessage({ action: 'plan_grouping', mode: 'force' }));
check(R, 'plan_grouping returns groups without changing tabs', plan.status === 'success' && plan.plan.groups.length > 0 && (await groupTitles()).length === 0, JSON.stringify(plan.plan && plan.plan.groups.map(g => g.title)));
plan.plan.groups[0].title = 'Renamed In Preview';
const applied = await api(async (p) => B.runtime.sendMessage({ action: 'apply_grouping', plan: p }), plan.plan);
const titles = await groupTitles();
check(R, 'apply_grouping applies the edited plan', applied.grouped > 0 && titles.includes('Renamed In Preview'), JSON.stringify(titles));
const undoG = await api(async () => B.runtime.sendMessage({ action: 'get_undo' }));
check(R, 'grouping is undoable', Boolean(undoG.entry), JSON.stringify(undoG.entry));
await api(async () => B.runtime.sendMessage({ action: 'undo' }));
check(R, 'undo restores ungrouped state', (await groupTitles()).length === 0, JSON.stringify(await groupTitles()));

// --- Duplicate preview + apply + undo
const p = await open(browser, 'https://www.iana.org/domains'); await sleep(300);
try { await p.goto('https://example.com/', { timeout: 20000 }); } catch (e) {}
await sleep(800);
const dplan = await api(async () => B.runtime.sendMessage({ action: 'plan_dedupe' }));
check(R, 'plan_dedupe lists the duplicate only', dplan.tabs.length === 1 && dplan.tabs[0].reason === 'exact' && (await countUrl('https://example.com/*')) === 2, JSON.stringify(dplan.tabs));
await api(async (ids) => B.runtime.sendMessage({ action: 'apply_dedupe', tabIds: ids }), dplan.tabs.map(t => t.id));
check(R, 'apply_dedupe closes it', (await countUrl('https://example.com/*')) === 1);
await api(async () => B.runtime.sendMessage({ action: 'undo' }));
await sleep(1500);
const archivedAfter = await api(async () => (await B.runtime.sendMessage({ action: 'get_archived_tabs' })).tabs.length);
check(R, 'undo reopens the closed duplicate and removes its archive entry', (await countUrl('https://example.com/*')) === 2 && archivedAfter === 0, `archived=${archivedAfter}`);

// --- Navigation dedupe shows a toast and can be undone
const before = await countUrl('https://www.wikipedia.org/*');
await open(browser, 'https://www.wikipedia.org/'); await sleep(2000);
check(R, 'new-tab duplicate redirected', (await countUrl('https://www.wikipedia.org/*')) === before);
const wiki = pages[4];
let toast = false;
try { toast = await wiki.evaluate(() => Boolean(document.getElementById('tabflow-agent-toast'))); } catch (e) { console.log('toast eval', e.message.slice(0, 80)); }
check(R, 'toast with Undo shown in the existing tab', toast);
await api(async () => B.runtime.sendMessage({ action: 'undo' }));
await sleep(2500);
check(R, 'undo reopens the redirected tab and it stays open', (await countUrl('https://www.wikipedia.org/*')) === before + 1);

// --- Archive preview (nothing stale) + ungroup undo
const aplan = await api(async () => B.runtime.sendMessage({ action: 'plan_archive' }));
check(R, 'plan_archive works', aplan.status === 'success' && Array.isArray(aplan.tabs) && aplan.days === 3, JSON.stringify(aplan));

// --- Palette UI preview (Chrome only: Firefox automation cannot drive extension pages)
if (kind === 'chrome') {
  const pal = await browser.newPage();
  await pal.setViewport({ width: 900, height: 760 });
  await pal.goto(`${base}/palette.html`);
  await sleep(800);
  await pal.type('#search-input', '>organize all');
  await sleep(300);
  await pal.keyboard.press('Enter');
  await pal.waitForFunction(() => !document.getElementById('preview-view').hidden && !document.getElementById('preview-view').classList.contains('loading'), { timeout: 60000 });
  const title = await pal.$eval('#preview-title', e => e.textContent);
  check(R, 'palette shows grouping preview', /tabs → \d+ group/.test(title), title);
  await pal.screenshot({ path: `${process.env.SHOTS || '.'}/preview.png` });
  await pal.keyboard.press('Escape');
  await sleep(300);
  check(R, 'Esc goes back to search', await pal.$eval('#preview-view', e => e.hidden));
  await pal.$eval('#search-input', e => { e.value = ''; });
  await pal.type('#search-input', 'organize');
  await sleep(300);
  const found = await pal.$$eval('.result-item', items => items.map(i => i.textContent));
  check(R, 'plain search finds the Organize command', found.some(t => t.includes('Organize All Tabs')), JSON.stringify(found));
}

await browser.close();
const failed = R.filter(r => !r.ok).length;
console.log(`${kind}: ${R.length - failed}/${R.length} passed`);
process.exit(failed ? 1 : 0);
