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
