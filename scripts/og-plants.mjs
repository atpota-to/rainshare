// The plant pictures again, for link previews. The library that draws a preview card
// (api/og.js) can't read WebP, and a card has no need of a see-through picture: each plant
// sits on a white tile. So this takes every picture in public/plants and saves it as a small
// JPEG on white in api/_og/plants, where the function reads it.
//
//   npm run plants      takes the pictures, and then runs this
//   npm run plants:og   just this
//
// It needs Chromium through Playwright, as render-plants.mjs does.
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const SIZE = 320, QUALITY = 0.86;   // the size the pictures were taken at
const from = here('../public/plants/'), to = here('../api/_og/plants/');

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = await import('playwright')); }

const files = (await readdir(from)).filter(f => f.endsWith('.webp')).sort();
await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
let total = 0;
for (const f of files) {
  const src = 'data:image/webp;base64,' + (await readFile(from + f)).toString('base64');
  const jpeg = await page.evaluate(async ({ src, size, quality }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: size, height: size }), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/jpeg', quality).split(',')[1];
  }, { src, size: SIZE, quality: QUALITY });
  const out = Buffer.from(jpeg, 'base64');
  total += out.length;
  await writeFile(to + f.replace(/\.webp$/, '.jpg'), out);
}
await browser.close();
console.log(`${files.length} pictures for link previews, ${Math.round(total / 1024)} kB in all, in api/_og/plants`);
