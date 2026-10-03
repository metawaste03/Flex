# FLEX tests

Browser tests that drive the real `flex/index.html` in Chromium (via Playwright). YouTube is
replaced by **`fake_yt.js`**, a stand-in for the IFrame Player API that records every call FLEX makes
(load, cue, play, pause, stop, volume) and lets a test end a song, jump in time, or refuse to start
the next video. So: **no internet needed**, and FLEX's own logic is fully checked — but real YouTube
and real phone behaviour (background play, installing, share sheet) still need a phone test.

## Run

```bash
npm install && npx playwright install chromium     # once
cd ../flex && python3 -m http.server 8765          # in another terminal (tests use localhost:8765)
cd ../tests && node run-all.mjs
```
Set `CHROMIUM_PATH=/path/to/chrome` to use a specific browser binary.

## Suites

| File | Kind | Covers |
|---|---|---|
| `03-milestone4-features.mjs` | 56 checks | Share to FLEX, playlist import, resume spots, Recently Played, shuffle, sleep timer, backup (incl. a hostile file), shortcuts, service worker, manifest. Also (re)writes `fake_yt.js` — run it first (`run-all` does). |
| `01-core-flows.mjs` | snapshot | Link parsing, playlists, edit/delete/rename, queue sync, reload → resume, errors + skip, playlist delete. Output must equal `expected/01-core-flows.txt`. |
| `02-click-wheel.mjs` | snapshot | Dragging from ring labels scrolls, taps still work, deleting the playing song. `expected/02-click-wheel.txt`. |
| `04-install-popup.mjs` | 18 checks | One-tap install, snooze, Settings row, wheel buttons, installed app, manual steps (incl. iPhone). |
| `05-off-switch.mjs` | 15 checks | Hold ▶❚❚ = off, saved spot kept, any button = on, no notification Stop. |
| `06-autopaste-brave.mjs` | 15 checks | Auto-paste rules, Brave/Chrome/Firefox wording, Background Play row. |
| `07-auto-advance-logic.mjs` | 3 checks | Song end → next song, with shuffle and Repeat All. |
| `08-background-auto-advance.mjs` | 11 checks | The PR #3 fix: next song blocked from starting → FLEX starts it; session never "paused" mid-playlist; caps and user pauses respected. |

If a snapshot suite fails because behaviour changed **on purpose**, look at
`<name>.actual.txt`, then copy it over `expected/<name>.txt`.
