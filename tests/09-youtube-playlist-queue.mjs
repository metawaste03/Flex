import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

// The queue is handed to YouTube as a playlist, so YouTube moves on to the next
// song by itself (background-safe) and FLEX follows along. The stand-in's
// __end() ends the current video and, like YouTube, starts the next one in the
// loaded playlist; with __blockAutoplay it only gets cued, like a browser that
// won't start it.
import fs from 'fs';
const browser = await chromium.launch(LAUNCH);
const ok = (name, cond, extra='') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); if (!cond) process.exitCode = 1; };
const ctx = await browser.newContext();
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8') }));
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
const ev = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);
const flexLoads = () => ev(() => __calls.filter(c => ['load','loadList','cueList','cue','playAt'].includes(c[0])));
const setup = (names, opts = {}) => ev(([names, opts]) => {
  state.shuffle = !!opts.shuffle; state.repeatMode = opts.repeat || 'off'; state.sleep = null; updateSleepBadge();
  state.positions = {};
  state.playlists = [{ id:'p', name:'P', tracks: names.map(x => ({ id:'t'+x, videoId:(x + x.repeat(11)).slice(0, 11), title:x, author:'' })) }];
  window.__blockAutoplay = false;
  setQueueFromPlaylist('p', 0);
}, [names, opts]);
const now = () => ev(() => state.currentMeta.title + (state.isPlaying ? '▶' : '⏸'));
const listTitles = () => ev(() => { const l = __list(); return l ? l.ids.map(v => v[0]).join('') + (l.loop ? ' loop' : '') : 'none'; });

// 1. Hand-over and following YouTube, with the browser refusing to start videos
await setup(['A','B','C']); await wait(60);
ok('playlist handed to YouTube in order, no loop', (await listTitles()) === 'ABC', await listTitles());
await ev(() => { window.__blockAutoplay = true; __calls.length = 0; __end(); }); await wait(80);
ok('YouTube moved on by itself and FLEX followed: B playing', (await now()) === 'B▶', await now());
ok('...FLEX loaded nothing itself (only pressed play)', (await flexLoads()).length === 0 && (await ev(() => __calls.some(c => c[0] === 'play'))), JSON.stringify(await ev(() => __calls)));
ok('...lock screen shows B', (await ev(() => navigator.mediaSession.metadata && navigator.mediaSession.metadata.title)) === 'B');
ok('...B is in Recently Played and the saved session', await ev(() => state.recent[0].title === 'B' && JSON.parse(localStorage.getItem('flex_session_v1')).queue.currentIndex === 1));
// Real YouTube in a playlist goes straight to the next video without an "ended" event
await ev(() => { window.__pbStates = []; const d = Object.getOwnPropertyDescriptor(navigator.mediaSession, 'playbackState'); __calls.length = 0; __end(true); }); await wait(80);
ok('no "ended" event, browser only cues C: FLEX still presses play', (await now()) === 'C▶' && (await ev(() => __calls.some(c => c[0] === 'play'))), JSON.stringify(await ev(() => __calls)));
ok('...lock screen stayed "playing"', (await ev(() => navigator.mediaSession.playbackState)) === 'playing');
await ev(() => { window.__blockAutoplay = false; prevTrack(); }); await wait(60);   // back to B for the next checks

// 2. ▶▶ / ◀◀ jump inside the loaded playlist instead of reloading
await ev(() => { __calls.length = 0; nextTrack(false); }); await wait(60);
ok('▶▶ jumps within YouTube playlist', (await now()) === 'C▶' && JSON.stringify(await flexLoads()) === JSON.stringify([['playAt', 2]]), JSON.stringify(await flexLoads()));
await ev(() => { __calls.length = 0; prevTrack(); }); await wait(60);
ok('◀◀ jumps back within it', (await now()) === 'B▶' && JSON.stringify(await flexLoads()) === JSON.stringify([['playAt', 1]]), JSON.stringify(await flexLoads()));

// 3. Repeat All: list from the current song, looping, keeping the spot
await ev(() => { __setT(42); __calls.length = 0; cycleRepeatMode(); }); await wait(60);   // off -> all
ok('Repeat All reloads from current song, looping, same spot', (await listTitles()) === 'BCA loop' && (await ev(() => __calls.find(c => c[0] === 'loadList')[3])) === 42 && (await now()) === 'B▶', (await listTitles()) + ' ' + JSON.stringify(await flexLoads()));
await ev(() => { __end(); }); await wait(60); await ev(() => { __end(); }); await wait(60);
ok('...and YouTube wraps around by itself: C then A', (await now()) === 'A▶', await now());

// 4. Repeat One: just this song
await ev(() => { __setT(10); __calls.length = 0; cycleRepeatMode(); }); await wait(60);   // all -> one
ok('Repeat One loads only the current song at the same spot', JSON.stringify(await flexLoads()) === JSON.stringify([['load', { videoId: 'AAAAAAAAAAA', startSeconds: 10 }]]) && (await listTitles()) === 'none', JSON.stringify(await flexLoads()));
await ev(() => { __end(); }); await wait(60);
ok('...and it repeats', (await now()) === 'A▶');
await ev(() => { cycleRepeatMode(); }); await wait(60);   // one -> off
ok('Repeat Off: playlist again from the current song', (await listTitles()) === 'ABC', await listTitles());

// 5. Editing the playing playlist updates what YouTube plays next
await ev(() => { const pl = state.playlists[0]; pl.tracks.push({ id:'tD', videoId:'DDDDDDDDDDD', title:'D', author:'' }); syncQueueWithPlaylist(pl); }); await wait(60);
ok('added song is queued in YouTube too', (await listTitles()) === 'ABCD' && (await now()) === 'A▶', await listTitles());
await ev(() => { __calls.length = 0; const pl = state.playlists[0]; pl.tracks = pl.tracks.filter(t => t.title !== 'B'); syncQueueWithPlaylist(pl); }); await wait(60);
ok('removed song is gone from YouTube list', (await listTitles()) === 'ACD', await listTitles());
await ev(() => { __calls.length = 0; const pl = state.playlists[0]; pl.tracks = pl.tracks.filter(t => t.title !== 'A'); syncQueueWithPlaylist(pl); }); await wait(60);
ok('deleting the playing song: it keeps playing, then C, D follow', (await listTitles()) === 'ACD' && (await now()) === 'A▶', (await listTitles()) + ' ' + JSON.stringify(await flexLoads()));
await ev(() => { __end(); }); await wait(60);
ok('...next is C', (await now()) === 'C▶');

// 6. Shuffle: YouTube gets FLEX's shuffled order
await setup(['A','B','C','D','E'], { shuffle: true }); await wait(60);
const order = await ev(() => state.queue.order.map(id => state.queue.tracks.find(t => t.id === id).title).join(''));
ok('shuffled order handed to YouTube', (await listTitles()) === order, (await listTitles()) + ' vs ' + order);
await ev(() => { __end(); }); await wait(60);
ok('...and FLEX tracks its place in the shuffle', await ev(() => state.queue.orderPos === 1));

// 7. Sleep "end of track": YouTube only has this song, so it stops at its end
await setup(['A','B','C']); await wait(60);
await ev(() => { for (let i = 0; i < 5; i++) cycleSleep(); }); await wait(60);   // -> End of track
ok('sleep end-of-track: only the current song loaded', (await listTitles()) === 'none' && (await ev(() => state.sleep && state.sleep.option)) === 'track');
await ev(() => { __end(); }); await wait(60);
ok('...stops at the end of A', (await now()) === 'A⏸' && (await ev(() => navigator.mediaSession.playbackState)) === 'paused', await now());

// 8. A broken video YouTube skips by itself is not skipped twice
await setup(['A','B','C']); await wait(60);
await ev(() => { onPlayerError({ data: 150 }); __end(); }); await wait(2800);
ok('error + YouTube moved on: stays on B (no double skip)', (await now()) === 'B▶', await now());
await ev(() => { onPlayerError({ data: 150 }); }); await wait(2800);
ok('error and YouTube stuck: FLEX skips to C', (await now()) === 'C▶', await now());

// 9. Per-episode resume when YouTube moves on to a long episode
await setup(['A','B','C']); await wait(60);
await ev(() => { state.positions[state.queue.tracks[1].videoId] = { t: 500, d: 4000, at: Date.now() }; __end(); }); await wait(80);
ok('next episode resumes at its saved spot', (await now()) === 'B▶' && (await ev(() => state.player.getCurrentTime())) === 500, String(await ev(() => state.player.getCurrentTime())));

// 10. Very long queues go in batches of 200
await ev(() => {
  state.shuffle = false; state.repeatMode = 'off';
  state.playlists = [{ id:'big', name:'Big', tracks: Array.from({ length: 250 }, (_, i) => ({ id:'b'+i, videoId:('V' + String(i).padStart(10, '0')), title:'#'+i, author:'' })) }];
  setQueueFromPlaylist('big', 0);
}); await wait(60);
ok('250 songs: first 200 handed over', await ev(() => __list().ids.length === 200 && !__list().loop));
await ev(() => { state.player.playVideoAt(199); }); await wait(60);   // YouTube itself got to the last of the batch
ok('...FLEX followed YouTube to #199', (await now()) === '#199▶', await now());
await ev(() => { __calls.length = 0; __end(); }); await wait(80);
ok('...at the end of the batch FLEX loads the next one', (await now()) === '#200▶' && (await ev(() => __list().ids.length)) === 50 && (await ev(() => __calls.some(c => c[0] === 'loadList'))), await now());

// 11. Restoring on launch cues the playlist, so pressing play continues through it
await ev(() => { __setT(30); saveSession(); }); await page.reload(); await wait(400);
ok('reopen: playlist cued at the saved song and spot', await ev(() => { const c = __calls.find(c => c[0] === 'cueList'); return c && c[1][0] === 'V0000000200' && c[3] === 30; }), JSON.stringify(await ev(() => __calls)));

ok('no page errors', errs.length === 0, errs.join('; '));
await browser.close();
