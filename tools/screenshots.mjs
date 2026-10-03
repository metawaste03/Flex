import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = fs.readFileSync(new URL('../tests/fake_yt.js', import.meta.url),'utf8');
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
await ctx.route('https://img.youtube.com/**', r => r.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b5876"/><stop offset=".55" stop-color="#4e4376"/><stop offset="1" stop-color="#c06c84"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="160" cy="90" r="46" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="10"/><circle cx="160" cy="90" r="12" fill="#fff" fill-opacity=".5"/></svg>` }));
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
const page = await ctx.newPage();
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
await page.evaluate(() => {
  state.playlists = [
    { id:'a', name:'Morning Run', tracks: [] }, { id:'b', name:'Podcasts', tracks: [] }, { id:'c', name:'Late Night', tracks: [] }];
  state.playlists[0].tracks = ['Blue Monday|New Order','Such Great Heights|The Postal Service','Midnight City|M83','Digital Love|Daft Punk','Heroes|David Bowie']
    .map((x,i) => { const [t,a] = x.split('|'); const v=('V'+i).padEnd(11,'x'); return { id:'t'+i, videoId:v, title:t, author:a, thumb:'https://img.youtube.com/vi/'+v+'/mqdefault.jpg' }; });
  state.stack = [{pane:'menu',index:0},{pane:'playlists',index:0},{pane:'playlistDetail',index:1,playlistId:'a'}];
  render();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '../flex/screenshot-playlist.png' });
await page.evaluate(() => { setQueueFromPlaylist('a', 1); pushPane('nowplaying'); });
await page.waitForTimeout(300);
await page.evaluate(() => { __setT(96); });
await page.waitForTimeout(700);
await page.screenshot({ path: '../flex/screenshot-nowplaying.png' });
await browser.close();
