import { chromium } from 'playwright';
// Uses your own Chromium unless CHROMIUM_PATH points at a specific browser binary.
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

import fs from 'fs';
const svg = fs.readFileSync('icon.svg', 'utf8');
const browser = await chromium.launch(LAUNCH);
for (const size of [512, 192]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: `../flex/icon-${size}.png`, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
// Preview: full square, and masked to a circle (what many Android launchers show)
const page = await browser.newPage({ viewport: { width: 560, height: 280 } });
await page.setContent(`<html><body style="margin:0;background:#333;display:flex;gap:20px;padding:20px">
  <img src="data:image/png;base64,${fs.readFileSync('../flex/icon-512.png').toString('base64')}" width="240" height="240" style="border-radius:40px">
  <img src="data:image/png;base64,${fs.readFileSync('../flex/icon-512.png').toString('base64')}" width="240" height="240" style="border-radius:50%;clip-path:circle(40%)">
</body></html>`);
await page.screenshot({ path: 'icon-preview.png' });
await browser.close();
