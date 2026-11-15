// Takes the pictures announcing @rainshare.dev's direct messages on Bluesky, and saves them to
// brand/dms/ (its README.md has posts to go with them, and alt text for each):
//
//   1-the-dm.png                   the message itself
//   2-notifications-like-rain.png  three of them falling like rain onto a plant
//   3-seed-to-garden.png           what the person who asked and the one who helped each hear
//   4-two-ticks-night.png          the two ticks that switch them on, by night
//   5-youve-got-rain-night.png     "You've got rain.", by night
//
// They're the cards in src/promo/dms.html, laid out at 1200 by 675 and taken at 2000 by 1125:
// as big as Bluesky keeps a picture, in the shape its feed shows whole. Bluesky takes pictures
// up to 1 MB, and this says if one is over.
//
// Run it after changing the page:  npm run promo
//
// Like bluesky.mjs, it needs Playwright (not one of this project's dependencies).
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), dir = root + 'brand/dms/';
const CARDS = [
  ['c1', '1-the-dm.png'],
  ['c2', '2-notifications-like-rain.png'],
  ['c3', '3-seed-to-garden.png'],
  ['c4', '4-two-ticks-night.png'],
  ['c5', '5-youve-got-rain-night.png']
];
const WIDE = 1200, TAKEN = 2000, MOST = 1000000;
await mkdir(dir, { recursive: true });

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (_) { console.error('The pictures need Playwright: npm i -D playwright'); process.exit(1); }
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDE + 120, height: 800 }, deviceScaleFactor: TAKEN / WIDE });
  await page.goto(`http://127.0.0.1:${port}/src/promo/dms.html`);
  await page.waitForFunction(() => window.cardsReady, null, { timeout: 120000 });
  for (const [id, file] of CARDS) {
    await page.locator('#' + id).screenshot({ path: dir + file });
    const { size } = await stat(dir + file);
    console.log(`brand/dms/${file}  ${(size / 1024).toFixed(0)} KB${size > MOST ? '  (over Bluesky’s 1 MB: it will be squeezed when posted)' : ''}`);
  }
} finally { await browser.close(); await server.close(); }
