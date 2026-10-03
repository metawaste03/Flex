import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
// Stand-in where, when __blockAutoplay is on, loadVideoById only cues the next
// video (like a browser refusing to start it) until playVideo() is called.
let FAKE = fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8').replace(
  "self.loadVideoById = (v) => { __calls.push(['load', v]); vid = typeof v === 'string' ? v : v.videoId; t = typeof v === 'string' ? 0 : v.startSeconds; setTimeout(() => fire(1), 10); };",
  "self.loadVideoById = (v) => { __calls.push(['load', v]); vid = typeof v === 'string' ? v : v.videoId; t = typeof v === 'string' ? 0 : v.startSeconds; setTimeout(() => { fire(-1); fire(window.__blockAutoplay ? 5 : 1); }, 10); };");
if (!FAKE.includes('__blockAutoplay')) throw new Error('stand-in patch failed');
const browser = await chromium.launch(LAUNCH);
const ok = (name, cond, extra='') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : ''));
const ctx = await browser.newContext();
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
await ctx.addInitScript(() => {
  try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {}
  window.__handlers = {}; window.__pbStates = [];
  if (navigator.mediaSession) {
    const orig = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (a, f) => { window.__handlers[a] = f; try { orig(a, f); } catch (e) {} };
    let pb = 'none';
    Object.defineProperty(navigator.mediaSession, 'playbackState', { get: () => pb, set: (v) => { pb = v; window.__pbStates.push(v); } });
  }
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => { state.playlists = [{ id:'p', name:'P', tracks:['A','B','C'].map(x => ({id:'t'+x, videoId:x.repeat(11), title:x, author:''})) }]; setQueueFromPlaylist('p', 0); });
await wait(100);
ok('no Stop button on the notification any more', await page.evaluate(() => !('stop' in window.__handlers) && typeof window.__handlers.nexttrack === 'function'));

// Browser refuses to start the next song by itself
await page.evaluate(() => { window.__blockAutoplay = true; window.__pbStates.length = 0; __calls.length = 0; __end(); });
await wait(200);
ok('song ends -> next song loaded', (await page.evaluate(() => state.currentMeta.title)) === 'B');
ok('FLEX pressed play for it -> it is playing', await page.evaluate(() => state.isPlaying && __calls.some(c => c[0] === 'play')), JSON.stringify(await page.evaluate(() => __calls)));
ok('lock-screen player never showed "paused" during the gap', !(await page.evaluate(() => window.__pbStates.includes('paused'))), JSON.stringify(await page.evaluate(() => window.__pbStates)));

// Several songs in a row, all blocked
await page.evaluate(() => { __end(); }); await wait(200);
ok('keeps going: C playing', (await page.evaluate(() => state.currentMeta.title + (state.isPlaying ? '▶' : '⏸'))) === 'C▶');

// End of playlist, repeat off: stop there, no nudging
await page.evaluate(() => { __calls.length = 0; window.__pbStates.length = 0; __end(); }); await wait(200);
ok('end of playlist (repeat off) stops, no replay', await page.evaluate(() => !state.isPlaying && !__calls.some(c => c[0] === 'play') && state.currentMeta.title === 'C'), JSON.stringify(await page.evaluate(() => __calls)));
ok('...and lock-screen shows paused', (await page.evaluate(() => navigator.mediaSession.playbackState)) === 'paused');

// Repeat all wraps around even when blocked
await page.evaluate(() => { state.repeatMode = 'all'; togglePlay(); }); await wait(50);
await page.evaluate(() => { __end(); }); await wait(200);
ok('repeat all wraps to A and plays', (await page.evaluate(() => state.currentMeta.title + (state.isPlaying ? '▶' : '⏸'))) === 'A▶');

// A user pause right after is respected (no nudge fighting the user)
await page.evaluate(() => { __end(); }); await wait(200);   // -> B playing
await page.evaluate(() => { __calls.length = 0; togglePlay(); }); await wait(100);
ok('user pause is respected', await page.evaluate(() => !state.isPlaying && !__calls.some(c => c[0] === 'play')));
// Nudges are capped if the browser keeps refusing
await page.evaluate(() => { window.__blockAutoplay = true; const p = state.player; p.playVideo = () => { __calls.push(['play']); setTimeout(() => { state.player && onPlayerStateChange({ data: 5 }); }, 5); }; __calls.length = 0; nextTrack(true); });
await wait(400);
ok('gives up after 3 tries if it never starts', (await page.evaluate(() => __calls.filter(c => c[0] === 'play').length)) === 3, String(await page.evaluate(() => __calls.filter(c => c[0] === 'play').length)));
ok('no page errors', errs.length === 0, errs.join('; '));
await browser.close();
