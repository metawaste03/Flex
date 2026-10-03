import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext();
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8') }));
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
const page = await ctx.newPage();
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
const ok = (name, cond, extra='') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); if (!cond) process.exitCode = 1; };
const results = {};
for (const [shuffle, repeat] of [[false,'off'],[true,'off'],[false,'all']]) {
  results[`${shuffle}/${repeat}`] = await page.evaluate(async ([shuffle, repeat]) => {
    state.shuffle = shuffle; state.repeatMode = repeat;
    state.playlists = [{ id:'p', name:'P', tracks:['A','B','C'].map(x => ({id:'t'+x, videoId:(x).repeat(11), title:x, author:''})) }];
    __calls.length = 0;
    setQueueFromPlaylist('p', 0); await new Promise(r => setTimeout(r, 50));
    const seq = [state.currentMeta.title];
    for (let i = 0; i < 3; i++) { __end(); await new Promise(r => setTimeout(r, 50)); seq.push(state.currentMeta.title + (state.isPlaying ? '▶' : '⏸')); }
    return { seq, loads: __calls.filter(c => c[0]==='load').length };
  }, [shuffle, repeat]);
}
const r1 = results['false/off'], r2 = results['true/off'], r3 = results['false/all'];
ok('in order: each ended song starts the next, stops after the last', r1.seq.join(' ') === 'A B▶ C▶ C⏸' && r1.loads === 3, r1.seq.join(' → '));
const shuffled = r2.seq.slice(0, 3).map(x => x.replace(/[▶⏸]/g, ''));
ok('shuffle: plays all 3 once, each starts, stops after the last', new Set(shuffled).size === 3 && r2.seq[1].endsWith('▶') && r2.seq[2].endsWith('▶') && r2.seq[3].endsWith('⏸') && r2.loads === 3, r2.seq.join(' → '));
ok('repeat all: wraps from the last song back to the first', r3.seq.join(' ') === 'A B▶ C▶ A▶' && r3.loads === 4, r3.seq.join(' → '));
await browser.close();
