# FLEX — technical handoff

How the app is put together, so anyone (or any Claude session) can change it safely.
Product reasoning lives in `flex/FLEX_SPEC.md`; rules and workflow in `CLAUDE.md`.

## Files that ship (`flex/`)

| File | Role |
|---|---|
| `index.html` | The entire app: CSS, the device markup (screen + wheel), and one `<script>` with all logic. |
| `manifest.json` | PWA install info: name, icons, `start_url`/`scope` `./`, `display: standalone`, **`share_target`** (GET `./?title&text&url`), two **`shortcuts`** (`./?open=recent`, `./?open=quickplay`), two **`screenshots`** for Chrome's install dialog. |
| `service-worker.js` | Caches only FLEX's own files, **network-first** (online = always latest; cache = offline fallback). Never caches YouTube. `CACHE_NAME` must be bumped per release. |
| `icon-192.png`, `icon-512.png` | Icons (maskable-safe). Regenerate with `tools/make-icons.mjs` from `tools/icon.svg`. |
| `screenshot-*.png` | Install-dialog screenshots. Regenerate with `tools/screenshots.mjs`. |
| `FLEX_SPEC.md` | Product spec (also served, harmless). |

`wrangler.jsonc` (repo root) tells Cloudflare Workers to serve `flex/` as static assets under the
Worker name `flex`.

## Sections of `index.html`'s script (in order)

State & storage → Recently played → Toast → Rendering/navigation → Menu → Playlists →
Playlist detail (incl. Edit mode, two-tap deletes, queue sync) → New/rename playlist → Settings →
Paste (Quick Play / + Add Song, auto-paste, link parsing) → List screens (Recently Played, Shared
link) → Share to FLEX → Shuffle → Sleep timer → Backup → Import YouTube playlist → Install popup →
Off switch → YouTube playback/queue → Now Playing render → Drag reorder → Wheel (sound, haptics,
gestures) → Init.

Each section starts with a `/* ===== Name ===== */` or `/* ---- Name ---- */` banner.

## Screens ("panes")

The screen shows one `.pane` at a time; navigation is a stack `state.stack` of
`{ pane, index, ...extra }` (index = highlighted row). `pushPane` / `popPane` / `render()`.

| pane | What it is |
|---|---|
| `menu` | Playlists · Recently Played · Quick Play · Now Playing · Settings (`MENU_ITEMS`) |
| `playlists` | List of playlists + "+ New Playlist" |
| `playlistDetail` | Songs of one playlist (`playlistId`); **Edit** toggles reorder/delete/rename/delete-playlist |
| `newPlaylist` | Name input; with `playlistId` it's "Rename Playlist" |
| `paste` | Quick Play / + Add Song (with `playlistId`); Load, Paste, "Whole YouTube Playlist" |
| `nowplaying` | Art, title, channel, position, progress, state line, volume overlay |
| `settings` | Built from `settingsRows()` (Skin, Repeat, Shuffle, Sleep Timer, Background Play, Export, Import, Install FLEX*, Turn Off) |
| `rows` | Generic list screen; `kind: 'recent'` (Recently Played) or `kind: 'shared'` (Shared Link). Rows come from `ROW_SCREENS[kind].rows(entry)` |

(*Install FLEX only shows in a browser tab, not inside the installed app.)

## Saved data (`localStorage`, per browser + per address)

| Key | Contents | Written |
|---|---|---|
| `flex_state_v1` | `{ playlists, skin, repeatMode, shuffle, recent }` — playlists are `{id, name, tracks:[{id, videoId, title, author, thumb}]}` | `saveState()` on any change |
| `flex_session_v1` | `{ queue, position, duration }` — what was playing and where | `saveSession()` ~5 s while playing, on pause, on hide/close |
| `flex_positions_v1` | `{ videoId: {t, d, at} }` — per-episode resume spots for videos ≥10 min | with `saveSession()` |
| `flex_install_dismissed_at` | timestamp — install popup snoozed 3 days | "Not now" |
| `flex_last_clipboard_link` | last auto-pasted link, so it's not offered twice | auto-paste |

Backup export = `{ app:'FLEX', version:1, playlists, recent, positions, settings }`; import merges
and rebuilds every track from its `videoId` (`cleanTrack`).

## Playback (the part to be most careful with)

- One hidden `YT.Player` in `#ytMount` (1×1px). `state.player`, `state.ytReady`.
- **Queue:** `state.queue = { tracks, currentIndex, playlistId, order?, orderPos? }`.
  `order`/`orderPos` exist only when shuffle is on (track **ids**, so edits don't break it).
- `playTrackAtQueueIndex(i)` → `loadVideoById` (with `startSeconds` if a resume spot exists) →
  `addRecent`, `renderNowPlaying`, `updateMediaSession`, `startProgressLoop`, `saveSession`.
- **Song end:** `onPlayerStateChange(ENDED)` → forget resume spot → sleep "end of track"? stop :
  repeat one? replay : `nextTrack(true)`.
- **Auto-advance safety (PR #3):** `nextTrack(true)` sets `state.autoAdvance`; while it's set, the
  media session stays `playing`, and if the next video comes back CUED/PAUSED, FLEX calls
  `playVideo()` (max 3). Cleared on PLAYING, user play/pause, sleep fade, power-off, end of list.
  **`paused` is reported only where FLEX truly stops.** Don't add a media-session `stop` handler.
- **Errors:** `onPlayerError` shows a plain message; in a queue, skips after 2.5 s (stops once
  every track has failed).
- **Restore on launch:** `restoreSession()` → `cueVideoById` at the saved spot (no autoplay; the
  user presses play).
- **Media Session:** metadata + handlers play, pause, previoustrack, nexttrack, seekbackward,
  seekforward.
- **Progress loop** (500 ms): progress bar/time, `checkSleep()`, periodic `saveSession()`.

## Other feature notes
- **Wheel:** pointer events on `#wheel`; 24 detents per turn; a press on a ring label turns into a
  scroll after ~10° of movement; ◀◀/▶▶ hold = continuous seek; **▶❚❚ hold 1.2 s = `powerOff()`**.
- **Off switch:** saves spot, pause+stop, clears media session, tries `window.close()`, shows the
  Off screen; any button → `location.reload()` (restores cued at the spot). `saveSession` is a
  no-op while off.
- **Share to FLEX / shortcuts:** `handleLaunchLinks()` at init reads `?open=` or share params, then
  `history.replaceState` removes them.
- **Install popup:** listens for `beforeinstallprompt` (Chrome/Edge/Samsung) → own popup → `prompt()`.
  Other browsers get manual steps after 3 s (12 s where the event exists). `browserKind()` tailors
  text (Brave / Chrome / Firefox / Samsung / iOS).
- **Auto-paste:** opening Quick Play / + Add Song calls `navigator.clipboard.readText()` inside the
  same tap; fills only a YouTube link, never over typed text, never the same link twice.
- **YouTube playlist import:** a second hidden, muted `YT.Player` with `listType:'playlist'` →
  `getPlaylist()` (≤200 ids) → oEmbed titles 6 at a time (401/403/404 = skipped).
- **Sleep timer:** wall-clock deadline checked twice a second; fade over ~8 s, pause, restore volume.

## Ideas not built yet
- Real lock-screen artwork sizes / higher-res thumbnails.
- Reorder playlists themselves (only songs are reorderable).
- A "Queue" screen showing what's up next.
- Optional: test a `loadPlaylist`-based queue if background advancing ever regresses again.
