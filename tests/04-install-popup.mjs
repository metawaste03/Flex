import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8');
const browser = await chromium.launch(LAUNCH);
const ok = (name, cond, extra='') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : ''));
async function newPage(init){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
  await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
  return page;
}
const fireBIP = (page, outcome) => page.evaluate((outcome) => {
  window.__prompted = 0;
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted++; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(e);
  window.__bipDefaultPrevented = e.defaultPrevented;
}, outcome);
const shown = (page) => page.locator('#installSheet.show').count();

// 1. Chrome-style one-tap install
let page = await newPage();
ok('no popup before browser offers install', (await shown(page)) === 0);
await fireBIP(page, 'accepted');
ok('popup appears when installable', (await shown(page)) === 1 && (await page.locator('#installGo').innerText()) === 'Install');
ok("browser's own mini-bar suppressed", await page.evaluate(() => window.__bipDefaultPrevented));
await page.waitForTimeout(250);
await page.screenshot({ path: 'install-popup.png' });
await page.click('#installGo'); await page.waitForTimeout(100);
ok('Install triggers the real browser prompt', (await page.evaluate(() => window.__prompted)) === 1 && (await shown(page)) === 0);
await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
ok('installed toast', (await page.locator('#toast').innerText()).includes('FLEX installed'));

// 2. Declined in the browser dialog -> snoozed; Not now -> snoozed; Settings brings it back
page = await newPage();
await fireBIP(page, 'dismissed');
await page.click('#installGo'); await page.waitForTimeout(100);
ok('declining snoozes', await page.evaluate(() => !!localStorage.getItem('flex_install_dismissed_at')));
await page.reload(); await page.waitForTimeout(300);
await fireBIP(page, 'accepted');
ok('snoozed: no automatic popup', (await shown(page)) === 0);
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'settings',index:0}]; render(); });
ok('Settings has Install FLEX row', (await page.locator('#settingsList').innerText()).includes('Install FLEX'));
await page.click('#settingsList >> text=Install FLEX');
ok('Settings row opens popup', (await shown(page)) === 1 && (await page.locator('#installGo').innerText()) === 'Install');
await page.locator('.hit-menu').click();
ok('wheel MENU = Not now', (await shown(page)) === 0 && (await page.evaluate(() => current().pane)) === 'settings');
await page.click('#settingsList >> text=Install FLEX');
await page.locator('#centerBtn').click(); await page.waitForTimeout(100);
ok('wheel centre = Install', (await page.evaluate(() => window.__prompted)) === 1);
ok('no page errors (chrome flow)', page.errs.length === 0, page.errs.join('; '));

// 3. Already installed (running as the app): never shown, no Settings row
page = await newPage(() => { const mm = window.matchMedia; window.matchMedia = (q) => q.includes('standalone') ? { matches: true, addEventListener(){}, removeEventListener(){} } : mm.call(window, q); });
await fireBIP(page, 'accepted');
ok('installed app: no popup', (await shown(page)) === 0);
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'settings',index:0}]; render(); });
ok('installed app: no Install row', !(await page.locator('#settingsList').innerText()).includes('Install FLEX'));

// 4. Browser without one-tap install (Safari/Firefox style): manual steps after ~3 s
page = await newPage(() => { delete Window.prototype.onbeforeinstallprompt; delete window.onbeforeinstallprompt; });
ok('manual: not immediately', (await shown(page)) === 0);
await page.waitForTimeout(3200);
ok('manual steps shown', (await shown(page)) === 1 && (await page.locator('#installGo').innerText()) === 'Got it'
  && (await page.locator('#installBody').innerText()).includes('Add to Home screen'), await page.locator('#installBody').innerText());
await page.screenshot({ path: 'install-manual.png' });
await page.click('#installGo');
ok('Got it closes + snoozes', (await shown(page)) === 0 && await page.evaluate(() => !!localStorage.getItem('flex_install_dismissed_at')));
// iPhone wording
page = await newPage(() => { delete Window.prototype.onbeforeinstallprompt; delete window.onbeforeinstallprompt; Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' }); });
await page.waitForTimeout(3200);
ok('iPhone steps', (await page.locator('#installBody').innerText()).includes('Add to Home Screen'), await page.locator('#installBody').innerText());
await browser.close();
