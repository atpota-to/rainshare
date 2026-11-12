// Takes the logo's pictures: the 3D drop and spark in src/logo/drop.js, drawn once each for
// the places that can't draw it themselves, and saved to public/:
//
//   favicon-32.png, favicon.png   the tab's icon, small and large
//   apple-touch-icon.png          the home-screen icon: the logo on a tile of the landing's sky
//   logo.png, logo-night.png      what the header shows until the moving one has started
//
// Run it after changing the drawing:  npm run logo
//
// Nothing here needs a browser: the logo is drawn in plain JavaScript, and a PNG is written
// with what Node has. `npm test` checks the pictures are the ones this would take now.
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { drawLogo, LOOKS, FRAMES } from '../src/logo/drop.js';

export const STILLS = [
  { file: 'favicon-32.png', size: 32, frame: 'icon' },
  { file: 'favicon.png', size: 96, frame: 'icon' },
  { file: 'apple-touch-icon.png', size: 180, frame: 'tile', sky: ['#D6E4FF', '#F1F5FF'] },
  { file: 'logo.png', size: 96, frame: 'mark' },
  { file: 'logo-night.png', size: 96, frame: 'mark', look: 'night' }
];

/** One of the pictures, as RGBA. It's drawn four times as big and brought down, so its edges are smooth. */
export function renderStill({ size, frame = 'mark', look = 'day', sky = null }, fine = 4){
  const n = size * fine, big = drawLogo(new Uint8ClampedArray(n * n * 4), n, { look: LOOKS[look], frame: FRAMES[frame] });
  const out = new Uint8ClampedArray(size * size * 4), top = sky && rgb(sky[0]), low = sky && rgb(sky[1]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < fine; j++) for (let i = 0; i < fine; i++) {
      const k = ((y * fine + j) * n + x * fine + i) * 4, w = big[k + 3] / 255;
      r += big[k] * w; g += big[k + 1] * w; b += big[k + 2] * w; a += w;
    }
    const o = (y * size + x) * 4, cover = a / (fine * fine);
    if (a > 0) { r /= a; g /= a; b /= a; }
    if (sky) {
      // the tile: the page's own sky, a little lighter toward the ground
      const t = y / (size - 1);
      out[o] = lerp(lerp(top[0], low[0], t), r, cover); out[o + 1] = lerp(lerp(top[1], low[1], t), g, cover); out[o + 2] = lerp(lerp(top[2], low[2], t), b, cover); out[o + 3] = 255;
    } else { out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = cover * 255; }
  }
  return out;
}
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/* ---------- PNG, the little of it that's needed ---------- */
const CRC = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc = bytes => { let c = ~0; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
const SIGN = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data){
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4);
  return out;
}
// Each row is stored as its difference from the pixels before it, in whichever of PNG's five
// ways leaves the least to store: a shaded picture packs about half as small that way.
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
const guess = (how, left, up, upLeft) => how === 1 ? left : how === 2 ? up : how === 3 ? (left + up) >> 1 : how === 4 ? paeth(left, up, upLeft) : 0;
/** RGBA pixels as a PNG file. */
export function encodePng(rgba, width, height){
  const head = Buffer.alloc(13), row = width * 4, raw = Buffer.alloc((row + 1) * height), tries = Array.from({ length: 5 }, () => Buffer.alloc(row));
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 6;      // 8 bits a channel, RGBA
  for (let y = 0; y < height; y++) {
    let best = 0, least = Infinity;
    for (let how = 0; how < 5; how++) {
      let sum = 0;
      for (let i = 0; i < row; i++) {
        const at = y * row + i, left = i >= 4 ? rgba[at - 4] : 0, up = y ? rgba[at - row] : 0, upLeft = i >= 4 && y ? rgba[at - row - 4] : 0;
        const d = (rgba[at] - guess(how, left, up, upLeft)) & 255;
        tries[how][i] = d; sum += d < 128 ? d : 256 - d;
      }
      if (sum < least) { least = sum; best = how; }
    }
    raw[y * (row + 1)] = best; tries[best].copy(raw, y * (row + 1) + 1);
  }
  return Buffer.concat([SIGN, chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/** The pixels of a PNG written by encodePng: 8 bits a channel, RGBA, not interlaced. */
export function decodePng(file){
  if (!file.subarray(0, 8).equals(SIGN)) throw new Error('not a PNG');
  let at = 8, width = 0, height = 0; const data = [];
  while (at < file.length) {
    const len = file.readUInt32BE(at), type = file.toString('latin1', at + 4, at + 8), body = file.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('not one of the logo\'s pictures'); }
    if (type === 'IDAT') data.push(body);
    at += len + 12;
  }
  const raw = inflateSync(Buffer.concat(data)), row = width * 4, rgba = new Uint8ClampedArray(row * height);
  for (let y = 0; y < height; y++) {
    const how = raw[y * (row + 1)];
    for (let i = 0; i < row; i++) {
      const o = y * row + i, left = i >= 4 ? rgba[o - 4] : 0, up = y ? rgba[o - row] : 0, upLeft = i >= 4 && y ? rgba[o - row - 4] : 0;
      rgba[o] = (raw[y * (row + 1) + 1 + i] + guess(how, left, up, upLeft)) & 255;
    }
  }
  return { width, height, rgba };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../public/', import.meta.url));
  await mkdir(dir, { recursive: true });
  for (const s of STILLS) {
    const bytes = encodePng(renderStill(s), s.size, s.size);
    await writeFile(dir + s.file, bytes);
    console.log(`public/${s.file}  ${s.size}px  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
}
