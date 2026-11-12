// /api/og: a link preview's picture for one page, as a PNG. What it shows comes from
// ./_og/describe.js (the same words api/page.js puts in the page's tags) and how it's drawn
// from ./_og/card.js. Anything that goes wrong sends the home page's picture instead: a
// preview is never an error.
import { ImageResponse } from '@vercel/og';
import { readFile } from 'node:fs/promises';
import { describe } from './_og/describe.js';
import { cardFor, WIDTH, HEIGHT } from './_og/card.js';

// What's read from beside this file (fonts, plant pictures). Looked for next to the module,
// and then from the project's root, which is where a deployed function runs.
const beside = rel => [new URL('./_og/' + rel, import.meta.url), new URL('file://' + process.cwd() + '/api/_og/' + rel)];
async function file(rel){
  for (const at of beside(rel)) { try { return await readFile(at); } catch (_) { /* try the next place */ } }
  return null;
}
// The site's typeface, in the weights the card uses. Latin and extended Latin are bundled;
// other scripts and emoji are fetched by the library as a name needs them.
let fontsP;
const fonts = () => fontsP ||= Promise.all([500, 700, 900].flatMap(weight => ['latin', 'latin-ext'].map(async set => {
  const data = await file(`fonts/zen-maru-gothic-${set}-${weight}-normal.woff`);
  return data ? { name: 'Zen Maru Gothic', data, weight, style: 'normal' } : null;
}))).then(list => list.filter(Boolean));
const dataUrl = (buf, type) => buf ? `data:${type};base64,${Buffer.from(buf).toString('base64')}` : null;
const plant = async name => /^[a-z]+(-\d{1,2})?$/.test(String(name || '')) ? dataUrl(await file(`plants/${name}.jpg`), 'image/jpeg') : null;
// Someone's picture, from Bluesky's image host only, as a JPEG small enough for where it's shown.
async function avatar(url, small){
  if (typeof url !== 'string' || !url.startsWith('https://cdn.bsky.app/img/avatar/')) return null;
  const src = (small ? url.replace('/img/avatar/', '/img/avatar_thumbnail/') : url).replace(/@[a-z]+$/, '') + '@jpeg';
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(2000) });
    if (!r.ok || !/^image\/jpeg/.test(r.headers.get('content-type') || '')) return null;
    const buf = await r.arrayBuffer();
    return buf.byteLength && buf.byteLength < 2_000_000 ? dataUrl(buf, 'image/jpeg') : null;
  } catch (_) { return null; }
}

/** The picture for a query ({ kind, who, rkey }), as PNG bytes, or null when the home picture should stand in. */
export async function render(query){
  const page = await describe(query);
  if (!page.card) return null;
  const c = page.card, [plantSrc, avatarSrc, fontList] = await Promise.all([plant(c.plant), avatar(c.person?.avatar, c.type === 'seed'), fonts()]);
  const tree = cardFor(c, { plant: plantSrc, avatar: avatarSrc });
  if (!tree || !fontList.length) return null;
  const image = new ImageResponse(tree, { width: WIDTH, height: HEIGHT, fonts: fontList, emoji: 'twemoji' });
  return Buffer.from(await image.arrayBuffer());
}

export default async function handler(req, res){
  let png = null;
  try { png = await render(req.query || {}); } catch (e) { console.warn('og', e?.message || e); }
  if (!png) { res.statusCode = 302; res.setHeader('location', '/og.jpg'); res.setHeader('cache-control', 'public, max-age=60'); res.end(); return; }
  res.statusCode = 200;
  res.setHeader('content-type', 'image/png');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.end(png);
}
