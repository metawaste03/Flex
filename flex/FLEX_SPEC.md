# FLEX — Project Spec

## 1. Vision

FLEX is a personal, no-frills music/podcast player for Android, styled after the **iPod Nano 3rd generation** (chrome body, click wheel, small screen, menu-driven navigation). Instead of a local music library, the source of content is **YouTube**: the user pastes a YouTube video or podcast link into the app, and it plays back through YouTube's own embedded player — controlled through the click-wheel interface instead of YouTube's own UI.

This is **not** a YouTube downloader or stream ripper. It only ever uses YouTube's official embeddable player (the IFrame Player API), the same mechanism any website uses to embed a YouTube video legitimately. No audio is extracted, cached, or redistributed.

## 2. Who it's for

- Primary: personal use on the creator's own Android phone.
- Secondary: shared informally with a handful of friends as an installable link (no app store, no distribution/signing pipeline).

## 3. Core user flow (MVP)

1. Open FLEX (installed to home screen, opens full-screen, no browser chrome).
2. Land on the **Menu** screen (`Paste Link`, `Now Playing`).
3. Select `Paste Link` → paste a YouTube URL (or a "Paste" button reads the system clipboard) → `Load`.
4. App extracts the video ID, loads it into a hidden YouTube IFrame player, fetches title/thumbnail via YouTube's oEmbed endpoint, and switches to **Now Playing**.
5. Click wheel controls playback:
   - Center button — play/pause (also acts as "select" in menus)
   - Top (MENU) — back to menu
   - Left / Right — seek back/forward 10s (rewind/fast-forward)
   - Bottom (▶❚❚) — play/pause
   - Dragging around the ring — volume, like the real click wheel's scroll gesture
6. Now Playing shows title, channel/author, thumbnail-as-album-art, and a progress bar.

## 4. Explicitly out of scope for MVP

- Playlists / queueing multiple tracks
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
| `index.html` | The entire app: UI, click wheel, state machine, YouTube integration |
| `manifest.json` | PWA metadata — name, icons, standalone display mode |
| `service-worker.js` | Caches only the app shell (HTML/CSS/JS/icons); never caches YouTube content |
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

## 9. Open questions / next decisions

- [ ] Test on the actual target phone: does audio survive screen lock in stock Chrome? In Firefox/Brave/Kiwi? With "desktop site" forced?
- [ ] Real icon artwork — current icons are placeholders generated for testing installability only.
- [ ] Is a "recently played" list (stored in `localStorage`) wanted for MVP, or is single-track-at-a-time enough?
- [ ] Visual polish pass on the iPod Nano 3rd gen chrome/click-wheel styling (current version is a first-pass approximation, not a pixel-perfect replica).
- [ ] Decide whether volume-by-drag-on-wheel feels right, or whether a simpler up/down volume button pair is more reliable on touchscreens.

## 10. Guiding principle for anyone continuing this project

Keep it simple, keep it a thin wrapper around YouTube's own official embed, and don't chase "fixes" for the background-playback limitation that would require extracting or downloading YouTube content — that trade isn't worth making for a personal prototype, and it's the one line this project should not cross.
