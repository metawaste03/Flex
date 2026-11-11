import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

// FLEX's own silent keep-alive sound: on while music plays, kept on through the
// gap between songs (so the phone's media notification doesn't drop), off
// wherever FLEX really stops. Can't show the phone notification itself — that
// needs a phone test.
import fs from 'fs';
const browser = await chromium.launch({ ...LAUNCH, args: ['--autoplay-policy=no-user-gesture-required'] });
const ok = (name, cond, extra='') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); if (!cond) process.exitCode = 1; };
const ctx = await browser.newContext();
await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('fake_yt.js', import.meta.url),'utf8') }));
await ctx.addInitScript(() => { try { localStorage.setItem('flex_install_dismissed_at', String(Date.now())); } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8765/'); await page.waitForTimeout(300);
const ev = (f) => page.evaluate(f);
const wait = (ms) => page.waitForTimeout(ms);
// on = FLEX wants it on; playing = the <audio> element really is playing
const alive = () => ev(() => ({ on: !!state.keepAliveOn, playing: !!(state.silentAudio && !state.silentAudio.paused) }));
const isOn = async () => { const a = await alive(); return a.on && a.playing; };
const isOff = async () => { const a = await alive(); return !a.on && !a.playing; };

ok('nothing playing: no silent sound', await isOff());
await ev(() => {
  state.repeatMode = 'off'; state.shuffle = false;
  state.playlists = [{ id:'p', name:'P', tracks:['A','B','C'].map(x => ({ id:'t'+x, videoId:x.repeat(11), title:x, author:'' })) }];
  setQueueFromPlaylist('p', 0);
}); await wait(150);
ok('playing: silent sound on', await isOn(), JSON.stringify(await alive()));
ok('...it is FLEX\'s own looping 10 s silent WAV', await ev(() => state.silentAudio.loop && state.silentAudio.src.startsWith('blob:') && Math.round(state.silentAudio.duration) === 10), await ev(() => state.silentAudio.duration));

// Gap between songs, with the browser only cueing the next one
// (record every on/off FLEX asks for, to prove it never switched off mid-change)
await ev(() => { window.__trace = []; const orig = window.keepAlive; window.keepAlive = (on) => { window.__trace.push(!!on); orig(on); }; });
await ev(() => { window.__blockAutoplay = true; __end(); }); await wait(150);
ok('song change (cued, FLEX pressed play): never switched off', (await isOn()) && (await ev(() => state.currentMeta.title)) === 'B' && !(await ev(() => window.__trace.includes(false))), JSON.stringify(await ev(() => window.__trace)));
await ev(() => { window.__trace = []; window.__blockAutoplay = false; __end(true); }); await wait(150);
ok('song change without an "ended" event: never switched off', (await isOn()) && (await ev(() => state.currentMeta.title)) === 'C' && !(await ev(() => window.__trace.includes(false))), JSON.stringify(await ev(() => window.__trace)));

// User pause / play
await ev(() => togglePlay()); await wait(100);
ok('user pause: off', await isOff());
await ev(() => togglePlay()); await wait(100);
ok('user play: on again', await isOn());
await ev(() => { navigator.mediaSession && state.player.pauseVideo(); }); await wait(100);
ok('paused from the notification: off', await isOff());
await ev(() => togglePlay()); await wait(100);

// End of playlist
await ev(() => __end()); await wait(150);
ok('end of playlist: off', await isOff(), JSON.stringify(await alive()));

// Sleep timer fade
await ev(() => { setQueueFromPlaylist('p', 0); }); await wait(150);
await ev(() => { state.sleep = { option: 15, at: Date.now() - 1 }; }); await wait(10000);
ok('sleep timer: off after the fade', (await isOff()) && !(await ev(() => state.isPlaying)), JSON.stringify(await alive()));

// Error with nothing else to play
await ev(() => { state.playlists.push({ id:'one', name:'One', tracks:[{ id:'x', videoId:'XXXXXXXXXXX', title:'X', author:'' }] }); setQueueFromPlaylist('one', 0); }); await wait(150);
await ev(() => onPlayerError({ data: 150 })); await wait(50);
ok('unplayable single song: off', await isOff());

// Off switch
await ev(() => setQueueFromPlaylist('p', 0)); await wait(150);
ok('(playing again)', await isOn());
await ev(() => powerOff()); await wait(100);
ok('turn off: off', await isOff());

ok('no page errors', errs.length === 0, errs.join('; '));
await browser.close();
