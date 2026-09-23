# FLEX — Project Spec

## 1. Vision

FLEX is a personal, no-frills music/podcast player for Android, styled after the **iPod Nano 3rd generation** (chrome body, click wheel, small screen, menu-driven navigation). Instead of a local music library, the source of content is **YouTube**: the user pastes a YouTube video or podcast link into the app, and it plays back through YouTube's own embedded player — controlled through the click-wheel interface instead of YouTube's own UI.

This is **not** a YouTube downloader or stream ripper. It only ever uses YouTube's official embeddable player (the IFrame Player API), the same mechanism any website uses to embed a YouTube video legitimately. No audio is extracted, cached, or redistributed.

## 2. Who it's for

- Primary: personal use on the creator's own Android phone.
- Secondary: shared informally with a handful of friends as an installable link (no app store, no distribution/signing pipeline).

## 3. Core user flow (current)

1. Open FLEX (installed to home screen, opens full-screen, no browser chrome). If something was playing last time, it reopens on **Now Playing** at the same spot, paused.
2. Otherwise land on the **Menu** screen (`Playlists`, `Quick Play`, `Now Playing`, `Settings`).
3. `Quick Play` → paste a YouTube URL (or a "Paste" button reads the system clipboard) → `Load`. Or `Playlists` → pick one → `+ Add Song` to save the link into a playlist.
4. App extracts the video ID, loads it into a hidden YouTube IFrame player, fetches title/thumbnail via YouTube's oEmbed endpoint, and switches to **Now Playing**.
5. Click wheel controls playback:
   - Center button — select in menus; play/pause on Now Playing
   - Top (MENU) — back
   - Left / Right (◀◀ / ▶▶) — tap for previous/next track, hold to seek
   - Bottom (▶❚❚) — play/pause
   - Dragging around the ring (starting anywhere on it, including over the labels) — scrolls lists, or changes volume on Now Playing
6. Now Playing shows title, channel/author, thumbnail-as-album-art, track position in the queue, a progress bar, and play state or any playback error.

## 4. Explicitly out of scope

- Search inside the app (user finds content in the YouTube app/site and shares/pastes the link into FLEX)
- Downloads or offline playback of YouTube audio (this would violate YouTube's Terms of Service and is not something to build, ever)
- iOS support (see §7 — background audio is far more restricted there and effectively requires YouTube Premium or a native app)

## 5. Tech stack

- **Plain HTML/CSS/JS**, no build step, no framework — kept dependency-free so it's trivial to host and modify.
- **YouTube IFrame Player API** (`https://www.youtube.com/iframe_api`) for playback — the only sanctioned way to embed and control YouTube content.
- **YouTube oEmbed endpoint** (`https://www.youtube.com/oembed?url=...&format=json`) for track title/author metadata, no API key required.
- **Web App Manifest + Service Worker** to make it installable on Android as a standalone PWA (`Add to Home Screen`), with **no Play Store step**.
- **Media Session API** (`navigator.mediaSession`) — best-effort lock-screen metadata and play/pause/seek controls, where the browser supports it.

## 6. Files in this prototype

| File | Purpose |
|---|---|
| `index.html` | The entire app: UI, click wheel, state machine, YouTube integration, playlists, persistence |
| `manifest.json` | PWA metadata — name, icons, standalone display mode |
| `service-worker.js` | Caches only the app shell (HTML/CSS/JS/icons), network-first so deploys show up immediately; never caches YouTube content |
| `icon-192.png`, `icon-512.png` | Placeholder home-screen icons — replace with real artwork |

No backend, no database, no API keys. It's a static site — deployable to any static host.

## 7. Known technical constraints (read before promising features)

These are platform limitations, not bugs to be fixed in code:

- **Background / lock-screen playback is not guaranteed.** Mobile browsers pause embedded video (including YouTube's iframe player) when the screen locks or the app is backgrounded, unless the OS/browser specifically allows audio-only background media. This varies by browser (Chrome, Firefox, Brave, Kiwi all behave differently) and by Android version. There is no code change that reliably forces this to work everywhere — it must be tested on the target device(s).
  - A known partial workaround: forcing "desktop site" mode in the browser can trick some engines into treating the tab as an ordinary background tab (audio keeps playing) rather than suspending it as a foreground video. Worth testing but not guaranteed and not something the app can force on the user's behalf.
- **YouTube Premium is the only officially supported way** to get guaranteed background playback of YouTube content on mobile. FLEX cannot replicate that entitlement.
- **CSP restriction if hosted inside a Claude.ai published Artifact:** Claude's Artifact hosting only allows scripts from a short allow-list of CDNs, which does not include `youtube.com`. This is why FLEX must be deployed to its own static host (see §8) rather than published as a Claude Artifact.
- **Mobile autoplay restriction:** YouTube's embedded player (like all embedded media on mobile Safari/Chrome) can only start playback from a direct user gesture (a tap), not programmatically on page load. The current design already routes every load through a user tap (`Load` button), so this should be fine — but don't add auto-play-on-open behavior later without testing.
- **This must stay within YouTube's Terms of Service.** No extraction of raw audio/video streams (e.g. via `yt-dlp`-style tools), no ad-blocking of the embedded player, no redistribution of fetched content. If any future feature request would need bypassing the embed player to get a "true" audio-only stream, that request should be declined — it crosses into scraping/ToS-violation territory, which is a hard line for this project.

## 8. Hosting & installation

FLEX is a static site — any static host works. Suggested: **Cloudflare Pages** (free, drag-and-drop deploy, gives a `*.pages.dev` URL, custom domain optional).

To install on Android once hosted:
1. Open the hosted URL in Chrome.
2. Chrome menu → **Add to Home Screen** / **Install app**.
3. Launches full-screen from the home screen icon, no Play Store involved.

To share with friends: send them the URL; they do the same "Add to Home Screen" step themselves.

**Deploying from GitHub:** the app lives in the `flex/` folder of the repo. The Cloudflare project (**Workers**, named `flex`) is connected to the GitHub repo, and `wrangler.jsonc` at the repo root tells it to serve `flex/` as static files — no build step, no server code. Every push to `main` deploys to production; pushes to other branches/PRs run a build check (and preview, if enabled). If the Cloudflare project is ever renamed, update `"name"` in `wrangler.jsonc` to match. (A Cloudflare **Pages** project would instead need Build command empty and Build output directory `flex`; a drag-and-drop project doesn't watch GitHub at all.)

`manifest.json` uses relative `start_url`/`scope` (`./`), so the app installs correctly whether it's served from a domain root (`*.pages.dev`) or a subfolder (e.g. GitHub Pages at `/Flex/`).

## 8a. Milestone 2 — playlists, media controls, full-screen skin (implemented)

Built on top of the working MVP (confirmed: audio survives screen lock and app backgrounding on Android/Brave):

- **Playlists**: create, view, add a YouTube link to a specific playlist (Menu → Playlists → pick one → + Add Song), and play any track in one (sets it as the active queue).
- **Reorder**: a "Reorder" toggle in a playlist's track list turns on drag handles (☰); drag rows to reorder, order is saved on drop. Playlists themselves are not yet reorderable — tracks within a playlist are.
- **Media controls**: proper next/previous track (not just seek), play/pause, and a three-state repeat mode (Off / Repeat All / Repeat One) set from Settings. Previous also restarts the current track if more than 3 seconds in, matching real iPod/media-player behavior.
- **Full-screen layout**: the device now fills the entire viewport (`100dvw`/`100dvh`) with safe-area padding for notches, rather than sitting as a small card on a dark background.
- **Wheel sound + haptics**: synthesized click-wheel "tick" sound (Web Audio, no external audio files) on every scroll detent and a lower "thock" on every button press, paired with `navigator.vibrate()` haptic pulses. Audio context is created lazily on first touch to satisfy browser autoplay policy.
- **Wheel gestures unified**: dragging around the ring scrolls the highlighted item in list screens (menu/playlists/playlist detail/settings) and adjusts volume on the Now Playing screen — same physical gesture, context-dependent action, matching the real device. Side buttons (◀◀/▶▶) do a quick-tap for previous/next track, or a press-and-hold for continuous seek.
- **Skin toggle**: Settings → Skin switches between a white/silver body and a black body via CSS custom properties (`data-skin` attribute), persisted to `localStorage`.
- **Persistence**: playlists, skin choice, and repeat mode are saved to `localStorage` under a single `flex_state_v1` key and reloaded on launch.
- Cache-busting reminder: the service worker's `CACHE_NAME` must be bumped (e.g. `v1` → `v2`) on every deploy that changes the app shell, or browsers (Brave in particular) will keep serving stale cached files even after redeploying — this bit us once already. (Since Milestone 3 the service worker is network-first, so this is a safety net rather than the only fix — but keep bumping it.)

## 8b. Milestone 3 — resume, editing, fixes (implemented)

- **Resume where you left off**: the queue, current track, playback position and track length are saved to `localStorage` under `flex_session_v1` (every ~5 s while playing, on pause, and when the app is hidden/closed). On launch FLEX reopens on Now Playing with that track *cued* at the saved position — not auto-played, because browsers only allow playback to start from a tap. Fixes the "reopen the app and it's blank" problem when Android discards the backgrounded tab.
- **Edit playlists**: the playlist toolbar button is now `Edit` (was `Reorder`). In edit mode: drag ☰ to reorder, ✕ to delete a track, plus `Rename Playlist` and `Delete Playlist` rows. Deletes need two taps (the button turns into `Delete?` / `Tap again…`); scrolling the wheel disarms it.
- **Live queue**: adding, removing or reordering tracks in the playlist that's playing updates the queue straight away. If the playing track is deleted it keeps playing and ▶▶ moves on to whatever followed it.
- **Playback errors on Now Playing**: YouTube errors show on the Now Playing screen in plain words (e.g. "The owner has disabled playback outside YouTube."), and in a multi-track queue FLEX skips to the next track after 2.5 s. It stops skipping once every track in the queue has failed.
- **Volume overlay**: spinning the wheel on Now Playing shows a volume bar with the level, which fades after ~1 s.
- **Wheel**: a touch that starts on MENU / ◀◀ / ▶▶ / ▶❚❚ becomes a scroll once the thumb moves ~10° around the ring. Before this, a scroll from any of those zones counted as a button press (e.g. skipping the track).
- **Layout**: the screen grows into the space the wheel doesn't need, so Now Playing no longer clips its bottom lines on tall phones; the wheel shrinks on short screens.
- **Links**: stricter parsing — accepts `youtube.com`, `m.`, `music.`, `youtu.be`, `/shorts/`, `/embed/`, `/live/`, `/v/`; rejects anything that isn't an 11-character video ID.
- **Lock screen**: Media Session now reports playing/paused state and supports seek backward/forward, and play/pause are separate actions rather than a single toggle.
- **Times** over an hour show as `h:mm:ss` (podcasts).
- **Service worker** `flex-shell-v3`, network-first for the app shell.

## 9. Open questions / next decisions

- [ ] Test on the actual target phone: does audio survive screen lock in stock Chrome? In Firefox/Brave/Kiwi? With "desktop site" forced?
- [ ] Real icon artwork — current icons are placeholders generated for testing installability only.
- [ ] Is a "recently played" list (stored in `localStorage`) wanted? (Resume-last-track is now done; a history list would be the next step.)
- [ ] Visual polish pass on the iPod Nano 3rd gen chrome/click-wheel styling (current version is a first-pass approximation, not a pixel-perfect replica).
- [ ] Decide whether volume-by-drag-on-wheel feels right, or whether a simpler up/down volume button pair is more reliable on touchscreens.

## 10. Guiding principle for anyone continuing this project

Keep it simple, keep it a thin wrapper around YouTube's own official embed, and don't chase "fixes" for the background-playback limitation that would require extracting or downloading YouTube content — that trade isn't worth making for a personal prototype, and it's the one line this project should not cross.
