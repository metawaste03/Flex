import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const FAKE_YT = `
window.__calls = [];
window.YT = { PlayerState: { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 },
  Player: function(id, opts){
    const self = this;
    const pv = opts.playerVars || {};
    if (pv.list) {   // playlist resolver instance
      __calls.push(['resolver', pv.list, pv.mute]);
      let ready = false;
      self.getPlaylist = () => ready ? (pv.list === 'PLgoodgoodgood' ? ['AAAAAAAAAA1','PRIVATEVID1','CCCCCCCCCC3'] : null) : null;
      self.destroy = () => __calls.push(['destroyed']);
      setTimeout(() => { opts.events.onReady(); setTimeout(() => { ready = true; if (pv.list !== 'PLgoodgoodgood') opts.events.onError({data:100}); }, 200); }, 5);
      return;
    }
    let t = 0, vol = 50, vid = null, st = -1;
    const fire = (s) => { st = s; opts.events.onStateChange({ data: s }); };
    self.loadVideoById = (v) => { __calls.push(['load', v]); vid = typeof v === 'string' ? v : v.videoId; t = typeof v === 'string' ? 0 : v.startSeconds; setTimeout(() => fire(1), 10); };
    self.cueVideoById = (o) => { __calls.push(['cue', o.videoId, o.startSeconds]); vid = o.videoId; t = o.startSeconds; setTimeout(() => fire(5), 10); };
    self.playVideo = () => { __calls.push(['play']); fire(1); };
    self.pauseVideo = () => { __calls.push(['pause']); fire(2); };
    self.stopVideo = () => { __calls.push(['stop']); t = 0; fire(5); };
    self.seekTo = (s) => { t = s; };
    self.getCurrentTime = () => st === 5 ? 0 : t;
    self.getDuration = () => vid ? (vid.startsWith('LONG') ? 4000 : 200) : 0;
    self.getVolume = () => vol; self.setVolume = (v) => { vol = v; __calls.push(['vol', v]); };
    self.isMuted = () => false; self.unMute = () => {};
    window.__advance = (s) => { t += s; };
    window.__setT = (s) => { t = s; };
    window.__end = () => fire(0);
    window.__vid = () => vid;
    setTimeout(() => opts.events.onReady(), 5);
  } };
setTimeout(() => window.onYouTubeIframeAPIReady(), 0);`;
fs.writeFileSync('fake_yt.js', FAKE_YT);
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
await ctx.route('https://www.youtube.com/oembed**', r => {
  const inner = new URL(new URL(r.request().url()).searchParams.get('url'));
  if (inner.pathname === '/playlist') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: 'My YT Mix Tape', author_name: 'Me' }) });
  const id = inner.searchParams.get('v');
  if (id === 'PRIVATEVID1') return r.fulfill({ status: 401, body: 'Unauthorized' });
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: 'Song ' + id, author_name: 'Chan ' + id.slice(0,1) }) });
});
await ctx.route('https://img.youtube.com/**', r => r.fulfill({ status: 404, body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const U = 'http://localhost:8765/';
const wait = (ms) => page.waitForTimeout(ms);
const txt = async (sel) => (await page.locator(sel).innerText()).replace(/\n+/g, ' | ');
const ev = (f, a) => page.evaluate(f, a);
const ok = (name, cond, extra='') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : ''));

await page.goto(U); await wait(300);
ok('menu has Recently Played', (await txt('#menuList')).includes('Recently Played'), await txt('#menuList'));

// ---------- 1. Share a video link (YouTube app style: link inside "text")
await ev(() => { state.playlists.push({ id: 'pl1', name: 'Road', tracks: [] }); saveState(); });
await page.goto(U + '?title=&text=' + encodeURIComponent('Watch this! https://youtu.be/BBBBBBBBBB2?si=abc') ); await wait(400);
ok('share opens Shared Link screen', (await txt('#titlebar')) === 'Shared Link');
ok('share URL cleaned', await ev(() => location.search === ''), await ev(() => location.href));
ok('share header shows title', (await txt('#rowsHeader')).includes('Song BBBBBBBBBB2'), await txt('#rowsHeader'));
ok('share rows', (await txt('#rowsList')) === 'Play Now | ▶ | Add to Road | 0 tracks', await txt('#rowsList'));
await page.click('#rowsList >> text=Add to Road'); await wait(100);
ok('added -> playlist detail', (await txt('#titlebar')) === 'Road' && (await txt('#playlistDetailList')).includes('Song BBBBBBBBBB2'));
await page.goto(U + '?url=' + encodeURIComponent('https://youtu.be/BBBBBBBBBB2')); await wait(300);
await page.click('#rowsList >> text=Play Now'); await wait(100);
ok('share Play Now plays', (await txt('#titlebar')) === 'Now Playing' && (await ev(() => __vid())) === 'BBBBBBBBBB2');
await page.goto(U + '?text=' + encodeURIComponent('no link here')); await wait(300);
ok('share without link -> message', (await txt('#rowsList')).includes("isn't a YouTube"), await txt('#rowsList'));

// ---------- 2. Share / import a whole YouTube playlist
await page.goto(U + '?url=' + encodeURIComponent('https://www.youtube.com/playlist?list=PLgoodgoodgood')); await wait(300);
ok('playlist share offers import', (await txt('#rowsList')).includes('Import Whole Playlist'), await txt('#rowsList'));
await page.click('#rowsList >> text=Import Whole Playlist'); await wait(1200);
ok('import created playlist', (await txt('#titlebar')) === 'My YT Mix Tape', await txt('#titlebar'));
ok('import skipped private video', (await txt('#playlistDetailList')).startsWith('Song AAAAAAAAAA1 | Chan A | ▶ | Song CCCCCCCCCC3'), await txt('#playlistDetailList'));
ok('import toast', (await txt('#toast')).includes('Added 2 videos') && (await txt('#toast')).includes('1 unavailable'), await txt('#toast'));
ok('resolver muted & destroyed', await ev(() => __calls.some(c => c[0]==='resolver' && c[2]===1) && __calls.some(c => c[0]==='destroyed')));
// Paste screen: button appears for list links; list-only link on Load imports into current playlist
await ev(() => { state.stack = [{pane:'menu',index:0},{pane:'playlists',index:0},{pane:'playlistDetail',index:0,playlistId:'pl1'}]; render(); });
await page.click('text=+ Add Song');
ok('import button hidden for plain link', await ev(() => { const i=document.getElementById('linkInput'); i.value='https://youtu.be/AAAAAAAAAA1'; i.dispatchEvent(new Event('input')); return document.getElementById('importListBtn').classList.contains('hidden'); }));
await page.fill('#linkInput', 'https://www.youtube.com/watch?v=AAAAAAAAAA1&list=PLgoodgoodgood');
ok('import button shown for list link', (await page.locator('#importListBtn').isVisible()) && (await txt('#importListBtn')) === 'Add Whole YouTube Playlist');
await page.fill('#linkInput', 'https://www.youtube.com/playlist?list=PLgoodgoodgood');
await page.click('#loadLink'); await wait(1200);
ok('list-only Load adds all to current playlist', (await txt('#titlebar')) === 'Road' && (await ev(() => state.playlists.find(p=>p.id==='pl1').tracks.length)) === 3, await ev(() => state.playlists.find(p=>p.id==='pl1').tracks.map(t=>t.videoId).join(',')));
await page.goto(U); await wait(300);
await ev(() => importYouTubePlaylist('PLbadbadbadbad', null)); await wait(3500);
ok('bad playlist -> error toast', (await txt('#toast')).includes("Couldn't read that playlist"), await txt('#toast'));

// ---------- 3. Per-episode resume
await ev(() => { state.playlists.push({ id:'pod', name:'Pods', tracks:[
  {id:'e1',videoId:'LONGEPISOD1',title:'Episode 1',author:'Pod'},{id:'e2',videoId:'LONGEPISOD2',title:'Episode 2',author:'Pod'}]}); saveState();
  setQueueFromPlaylist('pod', 0); pushPane('nowplaying'); });
await wait(100);
await ev(() => __setT(1234)); await wait(600); await ev(() => saveSession());
ok('position remembered', await ev(() => state.positions.LONGEPISOD1 && state.positions.LONGEPISOD1.t === 1234), JSON.stringify(await ev(() => state.positions)));
await ev(() => nextTrack(false)); await wait(100);
await ev(() => prevTrack()); await wait(100);   // t of ep2 is 0 (<3s) -> goes back to ep1
ok('resumes at saved spot', await ev(() => JSON.stringify(__calls.filter(c=>c[0]==='load').pop()) === JSON.stringify(['load',{videoId:'LONGEPISOD1',startSeconds:1234}])), JSON.stringify(await ev(() => __calls.filter(c=>c[0]==='load').pop())));
ok('resume toast', (await txt('#toast')).includes('Resuming at 20:34'), await txt('#toast'));
await page.screenshot({ path: 'f-resume.png' });
await ev(() => prevTrack()); await wait(600); await ev(() => saveSession());   // "start over"
ok('start over forgets spot', await ev(() => !state.positions.LONGEPISOD1));
await ev(() => __setT(3990)); await wait(600); await ev(() => saveSession());
ok('near end not remembered', await ev(() => !state.positions.LONGEPISOD1));
await ev(() => { __setT(50); }); await wait(600); await ev(() => { saveSession(); __end(); }); await wait(100);
ok('ended forgets spot', await ev(() => !state.positions.LONGEPISOD1));
ok('short videos never remembered', await ev(() => !Object.keys(state.positions).some(k => !k.startsWith('LONG'))));

// ---------- 4. Recently Played
await page.goto(U); await wait(300);
await ev(() => { state.stack=[{pane:'menu',index:1}]; render(); });
await page.click('#menuList >> text=Recently Played');
const recentTxt = await txt('#rowsList');
ok('recent newest first', recentTxt.startsWith('Episode 2 | Pod | ▶ | Episode 1'), recentTxt);
ok('recent has clear row', recentTxt.endsWith('Clear History'));
await page.screenshot({ path: 'f-recent.png' });
await page.click('#rowsList >> text=Song BBBBBBBBBB2'); await wait(100);
ok('recent plays item', (await ev(() => __vid())) === 'BBBBBBBBBB2' && (await txt('#titlebar')) === 'Now Playing');
await page.locator('.hit-menu').click();
ok('MENU from recent-play returns to menu', (await txt('#titlebar')) === 'Menu');
await ev(() => { pushPane('rows', {kind:'recent'}); });
await page.click('#rowsList >> text=Clear History');
ok('clear needs 2nd tap', (await txt('#rowsList')).includes('Tap again to clear history'));
await page.click('#rowsList >> text=Tap again to clear history');
ok('history cleared', (await txt('#rowsList')) === 'Nothing played yet.', await txt('#rowsList'));

// ---------- 5. Shuffle
await ev(() => { state.playlists.push({ id:'s', name:'Shuf', tracks: 'ABCDE'.split('').map(x => ({id:'t'+x, videoId:(x+'SHUFFLE').padEnd(11,'x'), title:'T'+x, author:''})) }); saveState(); });
await ev(() => { state.stack=[{pane:'menu',index:0},{pane:'settings',index:2}]; render(); });
ok('settings has 9 rows (incl. Background Play, Install FLEX, Turn Off)', (await ev(() => listLength(current()))) === 9, await txt('#settingsList'));
await page.locator('#centerBtn').click();   // select "Shuffle" via the wheel centre
ok('shuffle on via wheel', await ev(() => state.shuffle));
await ev(() => { setQueueFromPlaylist('s', 2); });
await wait(50);
const seen = [await ev(() => state.currentMeta.title)];
for (let i = 0; i < 4; i++) { await ev(() => nextTrack(true)); await wait(30); seen.push(await ev(() => state.currentMeta.title)); }
ok('shuffle starts with chosen track, plays all once', seen[0] === 'TC' && new Set(seen).size === 5, seen.join(','));
const pausesBefore = await ev(() => __calls.filter(c=>c[0]==='pause').length);
await ev(() => nextTrack(true)); await wait(30);
ok('shuffle end (repeat off) stops', (await ev(() => __calls.filter(c=>c[0]==='pause').length)) === pausesBefore + 1);
await ev(() => prevTrack()); await wait(30);
ok('prev walks shuffle order back', (await ev(() => state.currentMeta.title)) === seen[3], await ev(() => state.currentMeta.title));
// edit playlist while shuffled: delete a not-yet... then add
await ev(() => { const pl = state.playlists.find(p=>p.id==='s'); pl.tracks.push({id:'tF',videoId:'FSHUFFLExxx',title:'TF',author:''}); syncQueueWithPlaylist(pl); });
ok('added track joins shuffle order', await ev(() => state.queue.order.includes('tF') && state.queue.order.length === 6));
ok('now playing shows shuffled', (await ev(() => { pushPane('nowplaying'); return document.getElementById('npContent').innerText; })).includes('shuffled'));
await ev(() => { state.repeatMode = 'all'; });
await ev(() => { state.queue.orderPos = state.queue.order.length - 1; const last = state.queue.order[state.queue.orderPos]; playTrackById(last); window.__last = last; nextTrack(true); });
await wait(30);
ok('repeat-all reshuffles without immediate repeat', await ev(() => state.currentMeta.id !== window.__last && state.queue.orderPos === 0));
await ev(() => { state.repeatMode = 'off'; toggleShuffle(); });
ok('shuffle off clears order', await ev(() => !state.queue.order && !state.shuffle));

// ---------- 6. Sleep timer
await ev(() => { state.stack=[{pane:'menu',index:0},{pane:'settings',index:3}]; render(); });
await page.locator('#centerBtn').click();
ok('sleep 15 min', (await txt('#settingsList')).includes('Sleep Timer | 15 min left') && (await txt('#sbLeft')) === 'FLEX ☾ 15m', (await txt('#sbLeft')));
await page.screenshot({ path: 'f-settings.png' });
for (let i=0;i<4;i++) await page.locator('#centerBtn').click();
ok('sleep cycles to End of track', (await txt('#settingsList')).includes('End of track') && (await txt('#sbLeft')) === 'FLEX ☾ end');
await ev(() => { setQueueFromPlaylist('s', 0); }); await wait(50);
const before = await ev(() => state.currentMeta.id);
await ev(() => __end()); await wait(50);
ok('end-of-track sleep: stops, no next track', (await ev(() => state.currentMeta.id)) === before && (await ev(() => state.sleep)) === null && (await txt('#sbLeft')) === 'FLEX');
await ev(() => { playTrackAtQueueIndex(1); }); await wait(50);
await ev(() => { state.sleep = { option: 15, at: Date.now() - 1 }; });
await wait(9500);
ok('timer fades then pauses and restores volume', await ev(() => { const v = __calls.filter(c=>c[0]==='vol').map(c=>c[1]); return !state.isPlaying && v.includes(0) && v[v.length-1] === 50; }), JSON.stringify(await ev(() => __calls.filter(c=>c[0]==='vol').map(c=>c[1]).slice(-4))));
await ev(() => { cycleSleep(); cycleSleep(); cycleSleep(); cycleSleep(); cycleSleep(); cycleSleep(); });
ok('sleep cycles back to Off', (await ev(() => state.sleep)) === null);

// ---------- 7. Backup export / import
await ev(() => { state.stack=[{pane:'menu',index:0},{pane:'settings',index:5}]; render(); });
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#centerBtn').click()]);
const file = 'backup.json'; await dl.saveAs(file);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
ok('export file', dl.suggestedFilename().startsWith('flex-backup-') && data.app === 'FLEX' && data.playlists.length === 4, dl.suggestedFilename() + ' ' + data.playlists.map(p=>p.name).join(','));
await ev(() => { localStorage.clear(); }); await page.goto(U); await wait(300);
ok('storage wiped', (await ev(() => state.playlists.length)) === 0);
await ev(() => { state.stack=[{pane:'menu',index:0},{pane:'settings',index:6}]; render(); });
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#centerBtn').click()]);
await chooser.setFiles(file); await wait(300);
ok('import restores playlists', (await ev(() => state.playlists.map(p=>p.name).join(','))) === data.playlists.map(p=>p.name).join(','), await txt('#toast'));
ok('import toast', (await txt('#toast')).includes('4 new'), await txt('#toast'));
const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#centerBtn').click()]);
await chooser2.setFiles(file); await wait(300);
ok('re-import updates, no duplicates', (await ev(() => state.playlists.length)) === 4 && (await txt('#toast')).includes('4 updated'), await txt('#toast'));
fs.writeFileSync('evil.json', JSON.stringify({ app:'FLEX', playlists:[{ id:'x"><img>', name:'<b>hi</b>', tracks:[{ videoId:'AAAAAAAAAA1', title:'<img src=x onerror=alert(1)>', thumb:"x') ; background:url('evil" }, { videoId:'bad' }] }] }));
const [chooser3] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#centerBtn').click()]);
await chooser3.setFiles('evil.json'); await wait(300);
ok('hostile backup sanitised', await ev(() => { const p = state.playlists[state.playlists.length-1]; return /^[a-z0-9]+$/.test(p.id) && p.tracks.length === 1 && p.tracks[0].thumb === 'https://img.youtube.com/vi/AAAAAAAAAA1/mqdefault.jpg'; }));
await ev(() => { const p = state.playlists[state.playlists.length-1]; state.stack=[{pane:'menu',index:0},{pane:'playlistDetail',index:0,playlistId:p.id}]; render(); });
ok('hostile title shown as text', (await page.locator('#playlistDetailList img').count()) === 0 && (await txt('#titlebar')) === '<b>hi</b>');
fs.writeFileSync('notflex.json', '{"hello":1}');
const [chooser4] = await Promise.all([page.waitForEvent('filechooser'), ev(() => { state.stack=[{pane:'menu',index:0},{pane:'settings',index:6}]; render(); }).then(() => page.locator('#centerBtn').click())]);
await chooser4.setFiles('notflex.json'); await wait(300);
ok('non-backup file rejected', (await txt('#toast')).includes("isn't a FLEX backup"));

// ---------- 8. Home-screen shortcuts, SW, manifest
await page.goto(U + '?open=recent'); await wait(300);
ok('shortcut ?open=recent', (await txt('#titlebar')) === 'Recently Played' && (await ev(() => location.search)) === '');
await page.goto(U + '?open=quickplay'); await wait(300);
ok('shortcut ?open=quickplay', (await txt('#titlebar')) === 'Paste Link');
await wait(500);
ok('service worker v4', JSON.stringify(await ev(() => caches.keys())).includes('flex-shell-v5'), JSON.stringify(await ev(() => caches.keys())));
const man = await ev(() => fetch('manifest.json').then(r => r.json()));
ok('manifest share_target', man.share_target && man.share_target.action === './' && man.share_target.method === 'GET');
console.log('page errors:', errs);
await browser.close();
