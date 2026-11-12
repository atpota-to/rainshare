// Takes the plants' pictures: the four 3D models in src/plants, in each of the kinds the app
// picks between (PLANT_KINDS in ui/bits.js), each drawn once with a clear background and saved
// to public/plants/<stage>.webp (kind 0) or <stage>-<kind>.webp, which is what the app shows on
// cards and lists. Run it after changing a model, or how many kinds there are:  npm run plants
//
// It needs Playwright (not one of this project's dependencies): npm i -D playwright, or have
// it installed globally. In a browser with no GPU it draws with a software renderer.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), SIZE = 320;
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (_) { console.error('This needs Playwright: npm i -D playwright'); process.exit(1); }

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/src/plants/sheet.html?stills`);
  await page.waitForFunction(() => window.plantsReady, null, { timeout: 30000 });
  const stills = await page.evaluate(size => window.plantStills(size), SIZE);
  await mkdir(root + 'public/plants', { recursive: true });
  let total = 0, written = 0;
  // Stages named on the command line are the only ones written (npm run plants -- seed), so a
  // change to one model doesn't rewrite every other picture byte for byte differently.
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  for (const [file, url] of Object.entries(stills)) {
    if (only.length && !only.some(st => file === st + '.webp' || file.startsWith(st + '-'))) continue;
    const bytes = Buffer.from(url.split(',')[1], 'base64');
    await writeFile(`${root}public/plants/${file}`, bytes);
    total += bytes.length; written++;
    console.log(`public/plants/${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
  console.log(`${written} pictures, ${(total / 1024).toFixed(0)} KB in all`);
} finally { await browser.close(); await server.close(); }
