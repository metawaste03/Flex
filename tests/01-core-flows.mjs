import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const FAKE_YT = `
window.__calls = [];
window.YT = { PlayerState: { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 },
  Player: function(id, opts){
    const self = this; let t = 0, vol = 50, vid = null, st = -1, muted=false;
    const fire = (s) => { st = s; opts.events.onStateChange({ data: s }); };
    self.loadVideoById = (v) => { __calls.push(['load', v]); vid = v; t = 0;
      if (v === 'BADBADBAD00') setTimeout(() => opts.events.onError({ data: 150 }), 10);
      else setTimeout(() => fire(1), 10); };
    self.cueVideoById = (o) => { __calls.push(['cue', o.videoId, o.startSeconds]); vid = o.videoId; t = o.startSeconds; setTimeout(() => fire(5), 10); };
    self.playVideo = () => { __calls.push(['play']); fire(1); };
    self.pauseVideo = () => { __calls.push(['pause']); fire(2); };
    self.seekTo = (s) => { t = s; };
    self.getCurrentTime = () => st === 5 ? 0 : t;
    self.getDuration = () => vid ? 4000 : 0;
    self.getVolume = () => vol; self.setVolume = (v) => { vol = v; __calls.push(['vol', v]); };
    self.isMuted = () => muted; self.unMute = () => { muted = false; };
    window.__advance = (s) => { t += s; };
    window.__end = () => fire(0);
    setTimeout(() => opts.events.onReady(), 5);
  } };
setTimeout(() => window.onYouTubeIframeAPIReady(), 0);`;
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
await ctx.route('https://www.youtube.com/oembed**', r => {
  const id = new URL(new URL(r.request().url()).searchParams.get('url')).searchParams.get('v');
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: 'Song ' + id, author_name: 'Chan' }) });
});
await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const shot = (n) => page.screenshot({ path: n + '.png' });
const txt = (sel) => page.locator(sel).innerText();
const pause = (ms) => page.waitForTimeout(ms);
const U = 'http://localhost:8765/';
await page.goto(U); await pause(300);

// Link parsing
console.log('ids', await page.evaluate(() => [
  'https://youtu.be/dQw4w9WgXcQ?si=x', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=3',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://youtube.com/watch?v=x%27onerror%3D1', 'https://notyoutube.com/watch?v=dQw4w9WgXcQ'].map(extractVideoId)));

// Build a playlist with 3 tracks
await page.click('text=Playlists'); await page.click('text=+ New Playlist');
await page.fill('#newPlaylistInput', 'Road'); await page.click('#createPlaylistBtn');
await page.click('#playlistsList >> text=Road');
for (const id of ['AAAAAAAAAA1', 'BBBBBBBBBB2', 'CCCCCCCCCC3']) {
  await page.click('text=+ Add Song'); await page.fill('#linkInput', 'https://youtu.be/' + id);
  await page.click('#loadLink'); await pause(700);
}
console.log('detail rows:', await txt('#playlistDetailList'));
// Play track 2, then advance
await page.click('#playlistDetailList >> text=Song BBBBBBBBBB2'); await pause(200);
await page.evaluate(() => __advance(3725)); await pause(700);
console.log('NP:', (await txt('#npContent')).replace(/\n/g,' | '));
// Volume via wheel drag (clockwise arc on the ring)
const box = await page.locator('#wheel').boundingBox();
const cx = box.x + box.width/2, cy = box.y + box.height/2, r = box.width*0.4;
await page.mouse.move(cx + r, cy); await page.mouse.down();
for (let a = 0; a <= Math.PI/2; a += 0.1) await page.mouse.move(cx + r*Math.cos(a), cy + r*Math.sin(a));
await page.mouse.up();
console.log('overlay shown:', await page.locator('#volOverlay.show').count(), 'vol', await txt('#volNum'));
await shot('np');

// Back to playlist, edit mode: delete the currently-playing track (B)
await page.locator('.hit-menu').click();
await page.click('#editToggle');
await shot('edit');
const rowB = page.locator('#playlistDetailList .list-row', { hasText: 'BBBBBBBBBB2' });
await rowB.locator('.del-btn').click();
console.log('armed:', await rowB.locator('.del-btn').innerText());
await rowB.locator('.del-btn').click();
console.log('after delete:', (await txt('#playlistDetailList')).replace(/\n/g,' | '));
console.log('queue', await page.evaluate(() => JSON.stringify([state.queue.currentIndex, state.queue.tracks.map(t=>t.videoId)])));
await page.evaluate(() => nextTrack(false)); await pause(100);
console.log('next after delete ->', await page.evaluate(() => state.currentMeta.videoId));
// Rename
await page.click('text=Rename Playlist'); console.log('title', await txt('#titlebar'), 'prefill', await page.inputValue('#newPlaylistInput'));
await page.fill('#newPlaylistInput', 'Road Trip'); await page.click('#createPlaylistBtn');
console.log('title after rename:', await txt('#titlebar'));

// Reload -> should come back to Now Playing, cued at saved spot
await page.evaluate(() => { __advance(100); });
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
const saved = await page.evaluate(() => localStorage.getItem('flex_session_v1'));
console.log('saved pos', JSON.parse(saved).position);
await page.reload(); await pause(400);
console.log('after reload title:', await txt('#titlebar'), '|', (await txt('#npContent')).replace(/\n/g,' | '));
console.log('calls', JSON.stringify(await page.evaluate(() => __calls)));
await shot('restored');
// Reload again before pressing play: position must survive
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.reload(); await pause(400);
console.log('2nd reload calls', JSON.stringify(await page.evaluate(() => __calls)));
await page.locator('.hit-play').click(); await pause(100);
console.log('state after play:', await txt('#npState'));
await page.locator('.hit-menu').click();
console.log('menu after MENU:', await txt('#titlebar'));

// Error handling: playlist with a blocked video then a good one
await page.evaluate(() => { state.playlists.push({ id:'e', name:'Err', tracks:[
  {id:'x1',videoId:'BADBADBAD00',title:'Bad',author:''},{id:'x2',videoId:'GOODGOOD001',title:'Good',author:''}]}); });
await page.evaluate(() => { setQueueFromPlaylist('e', 0); pushPane('nowplaying'); }); await pause(100);
console.log('err shown:', await txt('#npState'), await page.locator('#npState.error').count());
await shot('error');
await pause(2700);
console.log('skipped to:', await page.evaluate(() => state.currentMeta.title), await txt('#npState'));
// Delete playlist two-tap
await page.evaluate(() => { state.stack = [{pane:'menu',index:0},{pane:'playlists',index:0},{pane:'playlistDetail',index:0,playlistId:'e'}]; render(); });
await page.click('#editToggle'); await page.click('text=Delete Playlist'); await page.click('text=Tap again to delete playlist');
console.log('after playlist delete:', await txt('#titlebar'), '|', (await txt('#playlistsList')).replace(/\n/g,' | '));
console.log('fmt', await page.evaluate(() => [fmtTime(59), fmtTime(3725)]));
// Service worker registered & serving
await page.reload(); await pause(500);
console.log('sw', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && (r.active||r.waiting||r.installing).scriptURL; }),
  await page.evaluate(() => caches.keys()));
console.log('errors:', errs);
await browser.close();
