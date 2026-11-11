# FLEX changelog

Newest last. PR links are on https://github.com/metawaste03/Flex/pulls?q=is%3Apr.

## MVP (before this work; original upload)
Paste a YouTube link → plays through YouTube's hidden embedded player, controlled by an iPod-style
click wheel. Installable PWA. Small device "card" on a dark page. (`archive/original-upload-Flex.zip`)

## Milestone 2 — playlists & media controls (from the original upload; put in the repo in PR #1)
Playlists (create, add songs, reorder by drag), next/previous track, repeat Off/All/One, full-screen
device layout, synthesized click sounds + vibration, wheel scrolls lists / changes volume, white or
black body, everything saved in `localStorage`.

## Milestone 3 — PR #1 (merged): resume, editing, fixes
- **Resume on reopen** — fixed "app is blank when I come back": queue + track + position are saved;
  FLEX reopens on Now Playing, paused at the same spot.
- **Playlist Edit mode** — reorder, delete songs, rename / delete playlists (two-tap confirm).
- Editing the playing playlist updates the queue live.
- Playback errors shown on Now Playing in plain words; unplayable videos skipped in a queue.
- Volume bar overlay; a drag that starts on MENU/◀◀/▶▶/▶❚❚ now scrolls instead of pressing.
- Screen grows to fill tall phones; stricter YouTube link parsing; h:mm:ss times.
- Service worker network-first, `flex-shell-v3`; manifest `start_url: ./`.
- `wrangler.jsonc` added so Cloudflare Workers Builds can deploy (first build had failed without it).

## Milestone 4 — PR #2 (merged)
- **Share to FLEX** (installed app appears in Android's share sheet) + home-screen icon shortcuts.
- **Recently Played**, **per-episode resume** for long videos, **shuffle**, **sleep timer**,
  **backup export/import**, **import a whole YouTube playlist**, **new icons**.
- **Install popup** — "Install FLEX" with one tap in Chrome/Edge/Samsung; manual steps elsewhere.
- **Off switch** — hold ▶❚❚ to turn FLEX off (stops music in installed apps).
- **Background play → Brave**: browser-aware install popup, Settings → Background Play row,
  auto-paste of copied YouTube links in Quick Play / + Add Song.
- Service worker `flex-shell-v4`.

## Fix — PR #3 (merged): playlists stopped after one song with the screen off
Regression from Milestone 4 found on the phone. Removed the notification "stop" action, kept the
media session "playing" through the gap between songs, and FLEX now presses play if the next song
loads but doesn't start (max 3 tries, never against a user pause). Confirmed on the phone.
Service worker `flex-shell-v5`.

## Fix — PR #5: playlists still stopped in the background when moving to another song
Reported 2026-11: in Brave (and Chrome), with the app left or the screen locked, one song on
Repeat One kept looping but a playlist stopped when the next song was due, until FLEX was opened.
Cause: each next song was a new video loaded by FLEX, and browsers won't start new media in a
hidden page that no tap started (PR #3's "press play" retry couldn't always get past that).
Now FLEX hands the queue to YouTube's player as an official playlist (`loadPlaylist`), so YouTube
moves on by itself and FLEX follows along (title, lock screen, Recently Played, resume spots).
Repeat One, one-song queues and sleep "end of track" still load a single video. New test suite
`09-youtube-playlist-queue` (30 checks); the test runner now works on Windows.
Service worker `flex-shell-v6`. **Confirmed on the phone** (installed, screen off: next songs play by themselves).

## Fix — PR #6: lock-screen player disappeared after the first song
Found while phone-testing PR #5 in the installed app: the media notification showed for the
first song, then vanished when YouTube moved on, though the music kept playing. The notification
follows whatever is making sound in the page — only YouTube's player, which briefly stops between
songs. FLEX now plays its own looping silent sound (generated in the page, YouTube untouched)
while music is on, kept on through song changes and off wherever FLEX really stops. Its own page
being part of the sound should also make the notification use FLEX's title and buttons.
New test suite `10-keep-notification` (14 checks). Service worker `flex-shell-v7`.
**Needs a phone test.**
