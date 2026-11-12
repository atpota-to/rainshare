// The logo: the drawing in src/logo/drop.js, how it moves, and the pictures taken of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawLogo, poseAt, LOOKS, FRAMES, LOOP } from '../src/logo/drop.js';
import { STILLS, renderStill, encodePng, decodePng } from '../scripts/render-logo.mjs';
import { clientMetadata } from '../src/scope.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const draw = (size, o) => drawLogo(new Uint8ClampedArray(size * size * 4), size, o);
// The most any one number differs by, between two pictures of the same size.
const apart = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
const at = (px, size, x, y) => { const o = (Math.round(y * size) * size + Math.round(x * size)) * 4; return [px[o], px[o + 1], px[o + 2], px[o + 3]]; };

test('the logo is a blue drop with a gold spark, and clear around them', () => {
  for (const [name, look] of Object.entries(LOOKS)) for (const [where, F] of Object.entries(FRAMES)) {
    const n = 64, px = draw(n, { look, frame: F });
    const [r, g, b, a] = at(px, n, F.x, F.y), [sr, , sb, sa] = at(px, n, F.x + F.scale, F.y - 1.35 * F.scale);
    assert.equal(a, 255, `${name} ${where}: the drop is solid`);
    assert.ok(b > r && b > g, `${name} ${where}: the drop is blue`);
    assert.equal(sa, 255, `${name} ${where}: the spark is solid`);
    assert.ok(sr > sb + 40, `${name} ${where}: the spark is gold`);
    assert.equal(at(px, n, .02, .02)[3], 0, `${name} ${where}: the corner is clear`);
  }
});

test('it stays inside its square: at rest in every frame, and in the bar at every moment, however it\'s nudged', () => {
  const n = 56;
  const edge = px => { let most = 0; for (let i = 0; i < n; i++) most = Math.max(most, px[i * 4 + 3], px[((n - 1) * n + i) * 4 + 3], px[i * n * 4 + 3], px[(i * n + n - 1) * 4 + 3]); return most; };
  for (const [where, F] of Object.entries(FRAMES)) assert.equal(edge(draw(n, { frame: F })), 0, `${where}, at rest`);
  for (const look of Object.values(LOOKS)) {
    for (let t = 0; t < LOOP; t += .1) assert.equal(edge(draw(n, { t, look })), 0, `at ${t.toFixed(1)}s`);
    for (let since = 0; since < 2.4; since += .04) assert.equal(edge(draw(n, { t: 2, look, nudge: since })), 0, `${since.toFixed(2)}s after a nudge`);
  }
});

test('its loop closes, starts from the still pose, and a nudge wears off', () => {
  const n = 48, still = draw(n);
  assert.ok(apart(still, draw(n, { t: LOOP })) <= 1);
  assert.ok(apart(draw(n, { t: 1.3 }), draw(n, { t: 1.3 + 3 * LOOP })) <= 1);
  assert.ok(apart(still, draw(n, { t: 1.1 })) > 20, 'the glint shows');
  const rest = poseAt(0);
  assert.equal(rest.bob, 0); assert.equal(rest.glintAmt, 0); assert.equal(rest.swell, 0); assert.equal(rest.spin, 0);
  assert.notDeepEqual(poseAt(3, .2), poseAt(3));
  assert.deepEqual(poseAt(3, 5), poseAt(3));
  // drawn twice, it's the same picture: nothing in it is left to chance
  assert.equal(apart(draw(n, { t: 2.2, nudge: .3 }), draw(n, { t: 2.2, nudge: .3 })), 0);
});

test('a picture written as a PNG reads back the same', () => {
  const n = 40, px = draw(n, { t: 2 }), back = decodePng(encodePng(px, n, n));
  assert.equal(back.width, n); assert.equal(back.height, n);
  assert.equal(apart(px, back.rgba), 0);
});

test('every picture of the logo is there, and is the one the drawing makes now', () => {
  for (const s of STILLS) {
    const file = here(`../public/${s.file}`);
    assert.ok(existsSync(file), `${s.file} is missing: run npm run logo`);
    const { width, height, rgba } = decodePng(readFileSync(file));
    assert.equal(width, s.size); assert.equal(height, s.size);
    // a shade or two of leeway, for a machine whose arithmetic rounds another way
    assert.ok(apart(rgba, renderStill(s)) <= 3, `${s.file} is out of date: run npm run logo`);
  }
});

test('the page and the sign-in ask for pictures that are there', () => {
  const html = readFileSync(here('../index.html'), 'utf8'), taken = new Set(STILLS.map(s => '/' + s.file));
  const asked = [...html.matchAll(/(?:href|src|srcset)="(\/[^"]+\.png)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(asked)].sort(), [...taken].sort());
  assert.ok(taken.has(new URL(clientMetadata('https://rainshare.dev').logo_uri).pathname));
});
