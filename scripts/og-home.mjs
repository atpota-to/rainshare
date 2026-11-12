// Takes the home page's link preview: public/og.jpg, 1200 by 630. The picture is
// src/landing/og.html, which sets the home page's own words (HOME in api/_og/describe.js)
// beside the landing's garden. Run it after changing the headline, the logo or the scene:
//
//   npm run og
//
// It needs Playwright (not one of this project's dependencies), as render-plants.mjs does.
// In a browser with no GPU it draws with a software renderer. The rain falls where it likes,
// so no two pictures are the same to the byte.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'public/og.jpg';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (_) { console.error('This needs Playwright: npm i -D playwright'); process.exit(1); }

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/src/landing/og.html`);
  await page.waitForFunction(() => window.ogReady, null, { timeout: 60000 });
  await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log(`public/og.jpg  ${((await stat(out)).size / 1024).toFixed(1)} KB`);
} finally { await browser.close(); await server.close(); }
