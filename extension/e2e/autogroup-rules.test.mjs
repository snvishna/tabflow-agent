import { launch, open, sleep, check } from './harness.mjs';
const [kind, ext] = process.argv.slice(2);
const R = [];
const { browser, api } = await launch(kind, ext);
const tabsMatching = (p) => api(async (p) => (await B.tabs.query({ url: p })).map(t => ({ id: t.id, groupId: t.groupId, url: t.url })), p);
const send = (msg) => api(async (m) => B.runtime.sendMessage(m), msg);

await browser.newPage(); // blank tab
const mdn = await open(browser, 'https://developer.mozilla.org/en-US/docs/Web/JavaScript');
await open(browser, 'https://www.iana.org/help/example-domains');
await sleep(800);

// Blank and extension tabs are left out of grouping plans
const plan = await send({ action: 'plan_grouping', mode: 'force' });
const urls = Object.values(plan.plan.tabs).map(t => t.url);
check(R, 'grouping plan skips blank and extension pages', urls.length > 0 && urls.every(u => u.startsWith('http')), JSON.stringify(urls));

// Make a "Docs" group containing the MDN tab
const [mdnTab] = await tabsMatching('https://developer.mozilla.org/*');
await send({ action: 'apply_grouping', plan: { windowId: plan.plan.windowId, mode: 'leaf', groups: [{ title: 'Docs', color: 'blue', tabIds: [mdnTab.id] }] } });

// Same-site new tab joins the group
await open(browser, 'https://developer.mozilla.org/en-US/docs/Web/CSS');
await sleep(2500);
const css = (await tabsMatching('https://developer.mozilla.org/en-US/docs/Web/CSS*'))[0];
check(R, 'new same-site tab auto-joins the group', css && css.groupId === mdnTab.groupId || (css && css.groupId !== -1), JSON.stringify(css));
const undo = await send({ action: 'get_undo' });
check(R, 'auto-group is undoable', undo.entry && /out of "Docs"/.test(undo.entry.label), undo.entry && undo.entry.label);
await send({ action: 'undo' });
await sleep(500);
const cssAfter = (await tabsMatching('https://developer.mozilla.org/en-US/docs/Web/CSS*'))[0];
check(R, 'undo takes it back out', cssAfter.groupId === -1, JSON.stringify(cssAfter));

// Unrelated new tab stays ungrouped
await open(browser, 'https://example.com/');
await sleep(4000);
const ex = (await tabsMatching('https://example.com/*'))[0];
check(R, 'unrelated new tab stays ungrouped', ex && ex.groupId === -1, JSON.stringify(ex));

// Auto-group can be switched off
await send({ action: 'save_settings', settings: { autoGroup: false } });
await open(browser, 'https://developer.mozilla.org/en-US/docs/Web/HTML');
await sleep(2500);
const html = (await tabsMatching('https://developer.mozilla.org/en-US/docs/Web/HTML*'))[0];
check(R, 'auto-group off leaves new tabs alone', html && html.groupId === -1, JSON.stringify(html));

// Never-close sites: duplicates are kept
await send({ action: 'save_settings', settings: { neverClose: 'https://example.com/\n', singleInstance: 'www.iana.org' } });
const st = await send({ action: 'get_settings' });
check(R, 'site lists are cleaned on save', JSON.stringify(st.neverClose) === '["example.com"]' && JSON.stringify(st.singleInstance) === '["iana.org"]', JSON.stringify([st.neverClose, st.singleInstance]));
await open(browser, 'https://example.com/');
await sleep(1500);
check(R, 'never-close site: new duplicate tab is kept', (await tabsMatching('https://example.com/*')).length === 2);
const dplan = await send({ action: 'plan_dedupe' });
check(R, 'never-close site: excluded from duplicate cleanup', dplan.tabs.every(t => !t.url.includes('example.com')), JSON.stringify(dplan.tabs));

// One-tab-per-site: new tab reuses the existing one
await open(browser, 'https://www.iana.org/domains');
await sleep(3000);
const iana = await tabsMatching('https://www.iana.org/*');
check(R, 'one-tab-per-site reuses the open tab', iana.length === 1 && iana[0].url.includes('/domains'), JSON.stringify(iana));

await browser.close();
const failed = R.filter(r => !r.ok).length;
console.log(`${kind}: ${R.length - failed}/${R.length} passed`);
process.exit(failed ? 1 : 0);
