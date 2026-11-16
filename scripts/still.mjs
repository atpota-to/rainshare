// Takes the landing's stills: the garden as it is on arriving, by day and by night, in each of
// the two ways the landing frames it. They're what the landing shows while its scene is on the
// way, and in its place where the browser can't draw it (src/landing/garden.js). Run it after
// changing the scene, the plots, or how the garden is fitted into the page:
//
//   npm run still
//   npm run still -- close      (only the one framing, so the other's pictures stay as they are)
//
// It writes src/landing/still/<framing>-<day|night>.webp and src/landing/still/still.js, which
// says how each was framed and where the labels go on it.
//
// Each still is a canvas bigger than any window, with the garden drawn at a set size around
// a known point. The scene's camera stays where it is whatever the window: only how big it
// draws, and where the middle of the picture goes, change with the frame (src/landing/fit.js).
// So a window's own picture is this one scaled about that point and moved to where the frame
// puts it, and the page does that with the still.
//
// It needs Playwright (not one of this project's dependencies), as render-plants.mjs does.
// In a browser with no GPU it draws with a software renderer.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), out = root + 'src/landing/still/';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (_) { console.error('This needs Playwright: npm i -D playwright'); process.exit(1); }

// The two framings (`close` is under the pitch, at 880px wide and narrower), in units of the
// scene from the point the camera looks at: how far each still reaches left, right, up and
// down. The page's windows, from 320 by 568 to 3840 by 2160, all fall inside: the furthest
// left is a 4K window's, about 22 units; the most sky a small phone's, about 24 (and a tall
// tablet's, beside the pitch, about 22); the most meadow under the garden about 13 beside the
// pitch, and 22 under it on a small phone, where the still's notes are stacked three deep
// (test/landing.test.mjs has these, and how they were measured). `unit` is how many
// pixels a unit is drawn with: a 1920-wide window draws the garden at about 80, a phone at
// 30 to 40.
// `sky` is the window the sun and the sky are laid out for (in units, from the same point):
// a 1440 by 900 window's, and a 390 by 844 phone's.
const FRAMINGS = {
  wide: { unit: 72, left: 23, right: 11, top: 24, bottom: 14, sky: { w: 22.6, midX: 15.6, midY: 7.7 } },
  close: { unit: 96, left: 5.6, right: 5.6, top: 26, bottom: 23.5, sky: { w: 10.7, midX: 5.35, midY: 19 } }
};
const QUALITY = .8;

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer.address();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const only = process.argv.slice(2).filter(n => Object.hasOwn(FRAMINGS, n));
// (what was made before, for a framing that isn't being made again)
const made = only.length ? { ...(await import(pathToFileURL(out + 'still.js').href)).STILLS } : {};
try {
  await mkdir(out, { recursive: true });
  for (const [name, f] of Object.entries(FRAMINGS)) {
    if (only.length && !only.includes(name)) continue;
    const w = Math.round((f.left + f.right) * f.unit), h = Math.round((f.top + f.bottom) * f.unit);
    const midX = f.left * f.unit, midY = f.top * f.unit;
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const still = { unit: f.unit, w, h, midX, midY, close: name === 'close', dark, sky: f.sky };
      await page.goto(`http://127.0.0.1:${port}/src/landing/still.html?still=${encodeURIComponent(JSON.stringify(still))}`);
      const at = await (await page.waitForFunction(() => window.stillReady, null, { timeout: 120000 })).jsonValue();
      const png = await page.screenshot({ type: 'png' });
      // The browser makes the WebP: it's the same encoder the page's readers have.
      const webp = await page.evaluate(async ([b64, quality]) => {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality })).arrayBuffer());
        let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      }, [png.toString('base64'), QUALITY]);
      const file = `${name}-${dark ? 'night' : 'day'}.webp`, buf = Buffer.from(webp, 'base64');
      await writeFile(out + file, buf);
      console.log(`src/landing/still/${file}  ${w}×${h}  ${(buf.length / 1024).toFixed(1)} KB`);
      const r = n => Math.round(n * 10) / 10;
      made[name] = { w, h, unit: f.unit, midX: r(midX), midY: r(midY), plots: at.plots.map(r), cloud: at.cloud.map(r), friend: at.friend.slice(0, 2).map(r), left: r(at.left * 100) / 100 };
      await page.close();
    }
  }
  await writeFile(out + 'still.js', `// Made by scripts/still.mjs (npm run still): how each of the landing's stills was framed,
// in its own pixels. \`unit\` is how many a unit of the scene covers, \`midX\` and \`midY\` where
// the point the camera looks at is, and the rest where the labels go, as the scene's
// onFrame gives them (src/landing/garden-scene.js): under each plot, your cloud (its middle,
// width and height), over the friend's cloud, and how much of the time to the reset is left.
export const STILLS = ${JSON.stringify(made, null, 2).replace(/\n {6,}/g, ' ').replace(/\n {4}\]/g, ' ]')};
`);
  console.log('src/landing/still/still.js');
} finally { await browser.close(); await server.close(); }
