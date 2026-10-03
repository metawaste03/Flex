# CLAUDE.md — working on FLEX

Read this first, then `docs/HANDOFF.md` (how the code works) and `flex/FLEX_SPEC.md` (product spec).
The owner is not a developer: explain things in plain words, keep answers short, and show
results (screenshots, a preview link) rather than code.

## The project in one paragraph
FLEX is a single-file web app (`flex/index.html`, ~2,000 lines of plain HTML/CSS/JS, no
framework, no build) that looks and works like an iPod Nano 3rd gen and plays YouTube links
through YouTube's official IFrame Player API. It's installed to an Android home screen as a
PWA. Hosting is Cloudflare Workers static assets (`wrangler.jsonc` → `flex/`); GitHub
`metawaste03/Flex` `main` auto-deploys to https://flex.metawaste03.workers.dev/ and every
other branch gets a preview at `https://<branch>-flex.metawaste03.workers.dev`.

## Hard rules
1. **Stay within YouTube's Terms of Service.** Only the official embedded player. Never
   download/extract audio or video, never block ads, never tamper with or spoof anything
   inside YouTube's iframe (it's cross-origin anyway). If a request needs that, say no and
   explain (spec §7 and §10). This is the one line the project never crosses.
2. **Bump `CACHE_NAME` in `flex/service-worker.js`** (`flex-shell-vN` → `vN+1`) in any change
   that ships to `main` and touches the app's files. Current: `flex-shell-v5`.
3. **Keep it dependency-free.** No frameworks, bundlers or npm packages in `flex/`.
   Playwright is only for the tests.
4. **Never push straight to `main`.** Work on a branch → open a PR → the owner tests the
   Cloudflare **preview link on their phone** → the owner merges. Ask before pushing if
   they've said to wait for confirmation.
5. **Update `flex/FLEX_SPEC.md`** (milestone section) when behaviour changes.

## How to check a change before it goes to the owner
1. Syntax: `node -e "const s=require('fs').readFileSync('flex/index.html','utf8'); new Function(s.split('<script>')[1].split('</script>')[0])"`
2. Serve: `cd flex && python3 -m http.server 8765`
3. Tests: `cd tests && node run-all.mjs` — all suites must pass. Add checks for new behaviour
   (copy the style of `tests/08-background-auto-advance.mjs`). If a snapshot suite (01/02)
   changes on purpose, regenerate `tests/expected/*.txt` and say why.
4. Look at it: take Playwright screenshots at 390×844 and 360×640 and actually view them.
5. Cloudflare dry run (optional): `npx wrangler deploy --dry-run` should read 8 files from `flex/`.

The tests use a **stand-in for YouTube** (`tests/fake_yt.js`), so they prove FLEX's own logic
but **not** real YouTube or phone behaviour. Always tell the owner what still needs checking
on the phone, and say plainly when something can't be tested here.

## Things learned the hard way (details in docs/LESSONS-phone-testing.md)
- **Background play only works in Brave** (Settings → Media → Background video playback).
  YouTube's player pauses itself when the page is hidden; Chrome/Firefox can't stop that.
- **Brave can't install a real app**, only shortcuts → no Share → FLEX in Brave. Chrome can
  (WebAPK) → Share works there, but no background play. FLEX therefore steers people to Brave
  and offers auto-paste of copied links in Quick Play instead of Share.
- An installed app's window being swiped away doesn't stop the page, and a page can't tell
  that from a locked screen → **hold ▶❚❚ = turn off** is the explicit off switch.
- **Don't change how the media session behaves between songs without phone-testing.** A
  notification "stop" action plus flipping `playbackState` to `paused` at song end made
  playlists stop after one song with the screen off (fixed in PR #3). Keep it `playing` while
  FLEX advances by itself.
- Each address (live vs preview, Brave vs Chrome) has **separate storage**. Remind the owner to
  use Export / Import Backup when switching.
- Listen carefully to the owner's bug reports and confirm what they mean before arguing it's a
  platform limit — twice a report was misread at first.
