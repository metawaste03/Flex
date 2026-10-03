# FLEX — complete project folder

FLEX is a personal music & podcast player styled after the **iPod Nano 3rd generation**:
a silver (or black) body, a small screen with menus, and a working **click wheel**.
You give it YouTube links; it plays them through **YouTube's own embedded player**
(nothing is downloaded or ripped). It's a static web app you add to your Android
home screen — no app store, no server, no build step.

- **Live app:** https://flex.metawaste03.workers.dev/
- **Code on GitHub:** https://github.com/metawaste03/Flex (branch `main` is what's live)
- **Hosting:** Cloudflare Workers (project `flex`), deploys automatically on every push to `main`
- **Best browser on Android:** **Brave**, with *Settings → Media → Background video playback* on
  (music keeps playing with the screen off). Chrome works too but YouTube pauses when the screen
  turns off there — see [docs/LESSONS-phone-testing.md](docs/LESSONS-phone-testing.md).

This repository holds **everything** built so far: the app (`flex/`, which is what Cloudflare
publishes), plus its tests, tools, screenshots and project notes. Only `flex/` is served to users.

## What's in here

| Folder / file | What it is |
|---|---|
| [`flex/`](flex/) | **The app itself** — exactly what's deployed. `index.html` is the whole app (UI, wheel, playback, storage). |
| [`flex/FLEX_SPEC.md`](flex/FLEX_SPEC.md) | The product spec: vision, rules, every milestone and why things work the way they do. |
| [`wrangler.jsonc`](wrangler.jsonc) | Cloudflare config: "serve the `flex/` folder as a static site". |
| [`CLAUDE.md`](CLAUDE.md) | **Instructions for Claude** when continuing this project (rules, how to test, how to ship). |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | How the app is built: screens, storage, playback, every feature's moving parts. |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | What changed in each milestone / pull request, in order. |
| [`docs/LESSONS-phone-testing.md`](docs/LESSONS-phone-testing.md) | What we learned testing on the real phone (Brave vs Chrome vs Firefox, installing, sharing, background play). |
| [`tests/`](tests/) | 8 browser test suites (118 checks + 2 snapshot flows) that drive the real app with a stand-in for YouTube. `node run-all.mjs`. |
| [`tools/`](tools/) | The icon artwork (`icon.svg`) and scripts that regenerate the icons and the install-dialog screenshots. |
| [`screenshots/`](screenshots/) | Pictures of the screens we built (share screen, Recently Played, settings, install popups, off screen…). |
| [`archive/original-upload-Flex.zip`](archive/) | The original zip you uploaded at the start (MVP + Milestone 2 prototype). |

## Using FLEX (quick reference)

- **Wheel:** drag around the ring to scroll / change volume · centre = select (play/pause on Now Playing) ·
  MENU = back · ◀◀ / ▶▶ = previous / next (hold to seek) · ▶❚❚ = play/pause · **hold ▶❚❚ ≈1 s = turn off**.
- **Add music:** YouTube → Share → *Copy link* → FLEX → **Quick Play** (link is pre-filled) → Load.
  Or Playlists → pick one → **+ Add Song**. A YouTube *playlist* link offers **Import Whole YouTube Playlist**.
- **Settings:** Skin · Repeat · Shuffle · Sleep Timer · Background Play · Export / Import Backup · Install FLEX · Turn Off.
- **Your data lives in the browser** you use. Moving to another browser/phone: Settings → Export Backup, then Import Backup there.

## Running it locally

```bash
cd flex && python3 -m http.server 8765      # then open http://localhost:8765
```

## Running the tests

```bash
cd tests
npm install                 # installs Playwright
npx playwright install chromium
# in another terminal, serve the app:  cd flex && python3 -m http.server 8765
node run-all.mjs
```
