// Takes the pictures for Rainshare's Bluesky profile, by day and by night, and saves them to brand/:
//
//   bluesky-avatar.png, bluesky-avatar-night.png   the profile picture: the logo on a square
//                                                  of sky, 1000 pixels, inside the circle Bluesky cuts it to
//   bluesky-banner.jpg, bluesky-banner-night.jpg   the banner, 1500 by 500 (src/landing/bluesky.html)
//
// Run it after changing the logo, the garden or the banner's words:  npm run bluesky
//
// The profile picture is drawn as the logo's other pictures are (render-logo.mjs), with no
// browser. The banner is the landing's garden, so it needs Playwright (not one of this
// project's dependencies), as og-home.mjs does; with no GPU it draws with a software renderer.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderStill, encodePng } from './render-logo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), dir = root + 'brand/';
await mkdir(dir, { recursive: true });
const said = async file => console.log(`brand/${file}  ${((await stat(dir + file)).size / 1024).toFixed(0)} KB`);

// The sky behind the logo: the landing's, a shade deeper at the top so the drop stands out
// at the size Bluesky shows it in a feed. At night, the page's night sky.
const AVATARS = [
  { file: 'bluesky-avatar.png', look: 'day', sky: ['#C9DBFF', '#EEF3FF'] },
  { file: 'bluesky-avatar-night.png', look: 'night', sky: ['#1B2C5A', '#0B1220'] }
];
for (const a of AVATARS) {
  await writeFile(dir + a.file, encodePng(renderStill({ size: 1000, frame: 'avatar', look: a.look, sky: a.sky }, 3), 1000, 1000));
  await said(a.file);
}

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (_) { console.error('The banners need Playwright: npm i -D playwright'); process.exit(1); }
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [file, query] of [['bluesky-banner.jpg', ''], ['bluesky-banner-night.jpg', '?dark']]) {
    const page = await browser.newPage({ viewport: { width: 750, height: 250 }, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${port}/src/landing/bluesky.html${query}`);
    await page.waitForFunction(() => window.bannerReady, null, { timeout: 120000 });
    await page.screenshot({ path: dir + file, type: 'jpeg', quality: 90 });
    await said(file);
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
