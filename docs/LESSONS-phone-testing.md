# Lessons from testing on the real phone

Phone: Samsung Galaxy S10+ (Android, Google Play services). These are things the code-only tests
could not show — they came from trying FLEX on the phone.

## Which browser to use

| | Music with screen off / app in background | Share → FLEX from YouTube | Installs as a real app |
|---|---|---|---|
| **Brave** | ✅ (needs *Settings → Media → Background video playback* on) | ❌ | ❌ shortcut only |
| **Chrome** | ❌ YouTube pauses when hidden | ✅ | ✅ (WebAPK, shows in Settings → Apps) |
| **Firefox** | ❌ | ❌ | ❌ |

**Recommendation: Brave.** Getting links in without Share: YouTube → Share → *Copy link* → FLEX →
Quick Play (FLEX pre-fills the copied link) → Load.

Why: YouTube's embedded player pauses itself when the page is hidden. Brave's background-play
setting prevents that; Chrome and Firefox have no equivalent, and FLEX must not tamper with
YouTube's player (spec §10).

## Installing
- Chrome shows **"Add to Home screen"**; in the sheet it opens, choose **Install**, not
  "Create shortcut". FLEX's own **Install FLEX** popup triggers the real install directly.
- A real install appears in **Settings → Apps**. If it doesn't, it's a shortcut — and shortcuts
  can't receive shares.
- Firefox only ever shows FLEX's manual steps ("Got it" button), never one-tap Install.
- Each browser and each address (live vs preview link) keeps **its own playlists**. Move them with
  Settings → Export Backup / Import Backup.

## Closing and stopping
- Swiping an installed FLEX away from recent apps does **not** stop the music in Chrome/Firefox —
  the browser keeps the page alive, and a page can't tell that from a locked screen.
  → **Hold ▶❚❚ for about a second** to turn FLEX off (or Settings → Turn Off).

## Background playlists (the PR #3 regression)
- After Milestone 4, songs kept playing with the screen off but the **next song didn't start**.
  Milestone 3 had worked. Cause: changes to the media session around the song-end moment
  (a notification "stop" action, and briefly reporting "paused" between songs). Fixed in PR #3 and
  confirmed on the phone. Rule: phone-test any change to the media session or the song-end flow.

## Misunderstandings to avoid
- "Close & exit and the music still plays" meant *background play had stopped working in Chrome*,
  not "I want it to stop". Read reports twice and confirm before answering.
- "It stops at the end of a song" turned out to be a FLEX regression, not a browser limit. When the
  owner says it worked before, compare the code before/after first.

## Background playlists, again (Nov 2026 → PR #5)
- Reported: leave the app (or lock the screen), and one song on **Repeat One** keeps looping, but a
  playlist stops when the **next song** is due — in Brave and Chrome. The difference: repeat never
  loads a new video; moving on did, and browsers won't start new media in a hidden page without a
  tap. PR #5 hands the whole queue to YouTube as a playlist so YouTube moves on itself.
  If this ever regresses, check first whether FLEX is loading videos itself mid-playlist.
  **Confirmed on the phone** (installed app, screen off).
- Then: in the installed app the **lock-screen player** showed only for the first song (it does
  show after opening and leaving the app), and vanished when YouTube moved on, though the music
  continued. In a normal Brave tab it showed. PR #6 adds FLEX's own silent keep-alive sound so the
  page never goes quiet between songs.
