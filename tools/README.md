# Tools

Run from this folder (they write into `../flex/`). They need Playwright: run
`npm install playwright && npx playwright install chromium` in this folder once.

| File | What it does |
|---|---|
| `icon.svg` | The FLEX icon artwork (silver Nano face, lit screen, click wheel), drawn inside Android's maskable safe zone. Edit this to change the icon. |
| `make-icons.mjs` | Renders `icon.svg` to `../flex/icon-512.png` and `../flex/icon-192.png`, plus `icon-preview.png` (square + circle-cropped preview). |
| `screenshots.mjs` | Renders the two install-dialog screenshots `../flex/screenshot-nowplaying.png` / `screenshot-playlist.png` (needs the app served on localhost:8765). |

After changing icons or screenshots, bump `CACHE_NAME` in `../flex/service-worker.js`.
