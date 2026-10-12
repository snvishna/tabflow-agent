// Shared e2e harness: launches Chromium or Firefox with an unpacked store package and
// exposes helpers to run extension API code from an extension page.
// Browsers come from CHROME_BIN and FF_BIN (see e2e/README.md).
import puppeteer from 'puppeteer-core';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const UUID = '11111111-2222-3333-4444-555555555555';

export async function launch(kind, extDir) {
  let browser, base;
  if (kind === 'firefox') {
    browser = await puppeteer.launch({ browser: 'firefox', executablePath: process.env.FF_BIN, headless: true, acceptInsecureCerts: true,
      args: ['-remote-allow-system-access'],
      extraPrefsFirefox: { 'extensions.webextensions.uuids': JSON.stringify({ 'tabflow-agent@snvishna.com': UUID }) } });
    await browser.installExtension(extDir);
    base = `moz-extension://${UUID}`;
  } else {
    browser = await puppeteer.launch({ browser: 'chrome', executablePath: process.env.CHROME_BIN,
      headless: true, pipe: true, enableExtensions: true, args: ['--no-sandbox'] });
    const id = await browser.installExtension(extDir);
    base = `chrome-extension://${id}`;
  }
  await sleep(2500);
  const extPage = await browser.newPage();
  // Firefox automation cannot open extension pages directly; API calls still run with extension access
  try { await extPage.goto(`${base}/palette.html`, { waitUntil: "domcontentloaded", timeout: 10000 }); } catch (e) { /* see above */ }
  await sleep(500);
  // Run fn inside the extension page; fn uses globalThis.B (browser or chrome namespace)
  await extPage.evaluate(() => { globalThis.B = typeof browser !== 'undefined' ? browser : chrome; });
  const api = (fn, ...args) => extPage.evaluate(fn, ...args);
  return { browser, base, extPage, api };
}

export async function open(browser, url) {
  const p = await browser.newPage();
  try { await p.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' }); } catch (e) { /* tab may be closed by dedupe */ }
  return p;
}

export function check(results, name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
