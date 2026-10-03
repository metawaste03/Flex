import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.clear(); state.playlists=[{id:'p',name:'P',tracks:['A','B','C','D'].map(x=>({id:x,videoId:x.repeat(11),title:'T'+x,author:''}))}]; setQueueFromPlaylist('p',1); pushPane('nowplaying'); });
await page.waitForTimeout(100);
const box = await page.locator('#wheel').boundingBox();
const cx = box.x + box.width/2, cy = box.y + box.height/2, r = box.width*0.4;
async function arc(a0, a1){ await page.mouse.move(cx + r*Math.cos(a0), cy + r*Math.sin(a0)); await page.mouse.down();
  const st = (a1-a0)/20; for (let i=1;i<=20;i++){ const a=a0+st*i; await page.mouse.move(cx + r*Math.cos(a), cy + r*Math.sin(a)); } await page.mouse.up(); }
await arc(0, Math.PI/2);  // starts on the ▶▶ zone, clockwise
console.log('drag from ▶▶ zone: track', await page.evaluate(()=>state.currentMeta.id), 'vol', await page.evaluate(()=>state.volume), 'overlay', await page.locator('#volOverlay.show').count());
await page.screenshot({path:'np.png'});
await arc(-Math.PI/2, -Math.PI);  // from MENU zone, counter-clockwise
console.log('drag from MENU zone: pane', await page.evaluate(()=>current().pane), 'vol', await page.evaluate(()=>state.volume));
// plain tap on ▶▶ still skips
await page.locator('.hit-next').click(); await page.waitForTimeout(50);
console.log('tap ▶▶ -> track', await page.evaluate(()=>state.currentMeta.id));
// menu scroll from a button zone
await page.locator('.hit-menu').click();
await arc(0, Math.PI/3);
console.log('menu selection index', await page.evaluate(()=>current().index), 'pane', await page.evaluate(()=>current().pane));
// Orphan: playing C (index 2); delete C from the playlist -> next should be D
await page.evaluate(() => { state.stack=[{pane:'menu',index:0},{pane:'playlists',index:0},{pane:'playlistDetail',index:0,playlistId:'p'}]; render(); });
await page.click('#editToggle');
await page.screenshot({path:'edit.png'});
const row = page.locator('#playlistDetailList .list-row', { hasText: 'TC' });
await row.locator('.del-btn').click(); await row.locator('.del-btn').click();
await page.evaluate(() => { pushPane('nowplaying'); });
console.log('NP after deleting playing track:', (await page.locator('#npContent').innerText()).replace(/\n/g,' | '));
await page.evaluate(() => nextTrack(false)); await page.waitForTimeout(50);
console.log('next ->', await page.evaluate(()=>state.currentMeta.id));
// black skin screenshot
await page.evaluate(() => setSkin('black')); await page.screenshot({path:'black.png'});
console.log('errors', errs);
await browser.close();
