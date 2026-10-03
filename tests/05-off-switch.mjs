import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8');
const browser = await chromium.launch(LAUNCH);
const ok = (name, cond, extra='') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : ''));
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
await ctx.addInitScript(() => {
  try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {}
  window.__closeCalls = 0; window.close = () => { window.__closeCalls++; };
  window.__handlers = {};
  if (navigator.mediaSession) { const orig = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (a, f) => { window.__handlers[a] = f; try { orig(a, f); } catch (e) {} }; }
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
await page.evaluate(() => { state.playlists = [{ id:'p', name:'P', tracks:[{id:'a',videoId:'LONGEPISOD1',title:'Ep',author:'Pod'},{id:'b',videoId:'BBBBBBBBBB2',title:'Song',author:'X'}] }]; saveState(); setQueueFromPlaylist('p', 0); pushPane('nowplaying'); });
await page.waitForTimeout(100);
await page.evaluate(() => __setT(754)); await page.waitForTimeout(600);
const box = await page.locator('.hit-play').boundingBox();
const cx = box.x + box.width/2, cy = box.y + box.height/2;

// short tap = play/pause, not off
await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(50);
ok('short tap on ▶❚❚ just pauses', !(await page.evaluate(() => state.off)) && !(await page.evaluate(() => state.isPlaying)));
await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(50);   // play again
// drag starting on ▶❚❚ = scroll (volume), not off
const w = await page.locator('#wheel').boundingBox(); const wx = w.x + w.width/2, wy = w.y + w.height/2, r = w.width*0.4;
await page.mouse.move(wx, wy + r); await page.mouse.down();
for (let i = 1; i <= 25; i++) { const a = Math.PI/2 - i*0.04; await page.mouse.move(wx + r*Math.cos(a), wy + r*Math.sin(a)); await page.waitForTimeout(60); }
await page.mouse.up();
ok('drag from ▶❚❚ scrolls, never turns off', !(await page.evaluate(() => state.off)) && (await page.locator('#volOverlay.show').count()) === 1);

// hold = off
await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(1400);
ok('hold ▶❚❚ turns off', await page.evaluate(() => state.off));
ok('off screen shown', (await page.locator('#offScreen.show').count()) === 1);
await page.mouse.up(); await page.waitForTimeout(300);
ok('releasing the hold does not turn it back on', await page.evaluate(() => state.off && performance.getEntriesByType('navigation')[0] && !window.__reloaded));
ok('player paused + stopped', await page.evaluate(() => { const c = __calls.map(c=>c[0]); return c.lastIndexOf('stop') > c.lastIndexOf('load') && c.includes('pause'); }));
ok('saved spot kept (not reset by stop)', (await page.evaluate(() => JSON.parse(localStorage.getItem('flex_session_v1')).position)) === 754, String(await page.evaluate(() => JSON.parse(localStorage.getItem('flex_session_v1')).position)));
ok('lock-screen player cleared', await page.evaluate(() => !navigator.mediaSession || (navigator.mediaSession.metadata === null && navigator.mediaSession.playbackState === 'none')));
await page.waitForTimeout(800);
ok('tried to close the window', (await page.evaluate(() => window.__closeCalls)) === 1);
await page.screenshot({ path: 'off.png' });
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
ok('pagehide while off keeps spot', (await page.evaluate(() => JSON.parse(localStorage.getItem('flex_session_v1')).position)) === 754);

// any button turns on -> reload, resumes cued at spot
await Promise.all([page.waitForNavigation(), page.locator('.hit-menu').click()]);
await page.waitForTimeout(400);
ok('any button turns on: back on Now Playing, cued at spot', (await page.evaluate(() => current().pane)) === 'nowplaying'
   && (await page.evaluate(() => JSON.stringify(__calls.find(c => c[0]==='cue')))) === JSON.stringify(['cue','LONGEPISOD1',754]), await page.evaluate(() => JSON.stringify(__calls)));
ok('media notification has no Stop (removed: it could end background playlists)', await page.evaluate(() => !('stop' in window.__handlers)));
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'settings',index:0}]; render(); });
ok('Settings has Turn Off row', (await page.locator('#settingsList').innerText()).includes('Turn Off'));
await page.click('#settingsList >> text=Turn Off'); await page.waitForTimeout(100);
ok('Settings Turn Off works', await page.evaluate(() => state.off));
ok('no page errors', errs.length === 0, errs.join('; '));
await browser.close();
