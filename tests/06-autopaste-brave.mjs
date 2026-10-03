import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8');
const browser = await chromium.launch(LAUNCH);
const ok = (name, cond, extra='') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : ''));
async function newPage({ init, clipboard = true } = {}){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8765' });
  await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
  await ctx.route('https://www.youtube.com/oembed**', r => r.fulfill({ contentType: 'application/json', body: '{"title":"T","author_name":"A"}' }));
  await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('keep_popup')) localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
  return page;
}
const openQuickPlay = async (page) => { await page.evaluate(() => { state.stack = [{pane:'menu',index:2}]; render(); }); await page.click('#menuList >> text=Quick Play'); await page.waitForTimeout(200); };

// 1. Auto-paste
let page = await newPage();
await page.evaluate(() => navigator.clipboard.writeText('Check this out https://youtu.be/AAAAAAAAAA1?si=xyz'));
await openQuickPlay(page);
ok('copied YouTube link is pasted on opening Quick Play', (await page.inputValue('#linkInput')) === 'https://youtu.be/AAAAAAAAAA1?si=xyz', await page.inputValue('#linkInput'));
ok('status says press Load', (await page.locator('#pasteStatus').innerText()).includes('press Load'));
await page.click('#loadLink'); await page.waitForTimeout(200);
ok('Load plays it', (await page.evaluate(() => current().pane)) === 'nowplaying' && (await page.evaluate(() => __vid())) === 'AAAAAAAAAA1');
await openQuickPlay(page);
ok('same link not offered again', (await page.inputValue('#linkInput')) === '');
await page.evaluate(() => navigator.clipboard.writeText('https://www.youtube.com/playlist?list=PLgoodgoodgood'));
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'playlists',index:0}]; state.playlists=[{id:'p',name:'P',tracks:[]}]; render(); });
await page.click('#playlistsList >> text=P'); await page.click('text=+ Add Song'); await page.waitForTimeout(200);
ok('works from + Add Song, and a playlist link shows the import button', (await page.inputValue('#linkInput')).includes('list=PLgoodgoodgood') && await page.locator('#importListBtn').isVisible());
await page.fill('#linkInput', '');
await page.evaluate(() => navigator.clipboard.writeText('just some text https://example.com/page'));
await openQuickPlay(page);
ok('non-YouTube clipboard ignored', (await page.inputValue('#linkInput')) === '');
await page.fill('#linkInput', 'https://youtu.be/BBBBBBBBBB2');
await page.evaluate(() => navigator.clipboard.writeText('https://youtu.be/CCCCCCCCCC3'));
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'paste',index:0}]; render(); }); await page.waitForTimeout(150);
ok('never overwrites what you typed', (await page.inputValue('#linkInput')) === 'https://youtu.be/BBBBBBBBBB2');
ok('no page errors', page.errs.length === 0, page.errs.join('; '));
page = await newPage({ clipboard: false });
await openQuickPlay(page);
ok('clipboard blocked: stays quiet', (await page.inputValue('#linkInput')) === '' && (await page.locator('#pasteStatus').innerText()) === '' && page.errs.length === 0, await page.locator('#pasteStatus').innerText());

// 2 + 3. Browser-aware install popup and Background Play row
const settingsText = async (page) => { await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'settings',index:0}]; render(); }); return page.locator('#settingsList').innerText(); };
page = await newPage({ init: () => { navigator.brave = { isBrave: () => Promise.resolve(true) }; } });
ok('Brave: Settings says Background Play ✓', (await settingsText(page)).includes('Background Play\nBrave ✓'));
await page.click('#settingsList >> text=Background Play');
ok('Brave: row explains the Media setting', (await page.locator('#toast').innerText()).includes('Background video playback'));
await page.click('#settingsList >> text=Install FLEX'); await page.waitForTimeout(250);
const braveBody = await page.locator('#installBody').innerText();
ok("Brave: popup shows Brave's steps + keep background play on", braveBody.includes("Brave's menu") && braveBody.includes('Background video playback') && !braveBody.includes('Chrome'), braveBody);
await page.screenshot({ path: 'popup-brave.png' });
page = await newPage();
ok('Chrome: Settings says Needs Brave', (await settingsText(page)).includes('Background Play\nNeeds Brave'));
await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await page.click('#settingsList >> text=Install FLEX'); await page.waitForTimeout(250);
const chromeBody = await page.locator('#installBody').innerText();
ok('Chrome: Install popup warns + points to Brave', (await page.locator('#installGo').innerText()) === 'Install' && chromeBody.includes('open this link in Brave'), chromeBody);
await page.screenshot({ path: 'popup-chrome.png' });
page = await newPage({ init: () => { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Android 12; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0' }); } });
await settingsText(page);
await page.click('#settingsList >> text=Install FLEX'); await page.waitForTimeout(250);
ok('Firefox: steps + Brave tip', (await page.locator('#installBody').innerText()).includes('open this link in Brave'));
await browser.close();
