// Day and night: which one the site is in, the toggle's rule, and the turn between them
// (core/mode.js), and that the page, its styles and its scenes all go by it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KEY, TURN, CHROME, MODES, modeOf, other, keep, blend, dusk } from '../core/mode.js';
import { drawLogo, LOOKS } from '../src/logo/drop.js';
import { SKY } from '../src/landing/sky.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const read = p => readFileSync(here(p), 'utf8');

test('the site follows the system until someone picks the other', () => {
  assert.equal(modeOf(null, false), 'day');
  assert.equal(modeOf(null, true), 'night');
  assert.equal(modeOf('night', false), 'night');
  assert.equal(modeOf('day', true), 'day');
  // anything else that's ended up in storage is ignored
  for (const junk of ['', 'dark', '"night"', 'NIGHT', undefined]) assert.equal(modeOf(junk, true), 'night');
  assert.equal(other('day'), 'night'); assert.equal(other('night'), 'day');
});

test('a choice is kept only while it differs from the system, so toggling back follows it again', () => {
  assert.equal(keep('night', false), 'night');
  assert.equal(keep('day', true), 'day');
  assert.equal(keep('day', false), null);
  assert.equal(keep('night', true), null);
  // There and back from either setting leaves nothing saved.
  for (const dark of [false, true]) {
    const first = other(modeOf(null, dark)), saved = keep(first, dark);
    assert.equal(modeOf(saved, dark), first);
    assert.equal(keep(other(first), dark), null);
  }
});

test('the script that runs before the page is drawn agrees with the rule', () => {
  const src = read('../public/mode.js');
  assert.ok(src.includes(`'${KEY}'`), 'it reads the same key');
  const run = (saved, dark, broken = false) => {
    const attrs = {};
    vm.runInNewContext(src, {
      localStorage: { getItem: k => { if (broken) throw new Error('no storage'); return k === KEY ? saved : null; } },
      matchMedia: q => ({ matches: /dark/.test(q) && dark }),
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } }
    });
    return attrs['data-mode'];
  };
  for (const saved of [null, 'day', 'night', 'junk']) for (const dark of [false, true]) assert.equal(run(saved, dark), modeOf(saved, dark));
  assert.equal(run('night', false, true), 'day', 'with storage blocked, the system\'s');
});

test('a blend is day at one end, night at the other, and in between in between', () => {
  assert.equal(blend('#000000', '#ffffff', .5), '#808080');
  assert.equal(blend('#FF0000', '#0000FF', .25), '#bf0040');
  assert.equal(blend(2, 4, .25), 2.5);
  assert.deepEqual(blend([0, 1], [1, 0], .5), [.5, .5]);
  assert.deepEqual(blend({ a: '#000000', n: 0, on: 'x' }, { a: '#ffffff', n: 10, on: 'y' }, .6), { a: '#999999', n: 6, on: 'y' });
  const day = { sky: '#A7C4F2', stars: 0 }, night = { sky: '#0C1030', stars: 1 };
  assert.equal(blend(day, night, 0), day);
  assert.equal(blend(day, night, 1), night);
  assert.equal(blend(day, night, -1), day);
});

test('the sky and the logo have the same things to colour by day and by night', () => {
  for (const looks of [SKY, LOOKS]) {
    assert.deepEqual(Object.keys(looks.day).sort(), Object.keys(looks.night).sort());
    const mid = blend(looks.day, looks.night, .5);
    for (const [k, v] of Object.entries(mid)) {
      assert.equal(typeof v, typeof looks.day[k], k);
      if (typeof v === 'string') assert.match(v, /^#[0-9a-f]{6}$/, `${k} is a colour that can be mixed`);
    }
  }
});

test('the logo can be drawn part of the way between day and night', () => {
  const draw = look => { const px = new Uint8ClampedArray(32 * 32 * 4); drawLogo(px, 32, { t: 0, look }); return px; };
  const day = draw(LOOKS.day), night = draw(LOOKS.night), mid = draw(blend(LOOKS.day, LOOKS.night, .5));
  const apart = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
  assert.ok(apart(day, night) > 0);
  assert.ok(apart(mid, day) > 0 && apart(mid, night) > 0);
  assert.ok(apart(mid, day) < apart(day, night) && apart(mid, night) < apart(day, night), 'nearer each than they are to each other');
});

test('dusk falls over TURN seconds, eases at both ends, and can turn back half way', () => {
  const d = dusk(false);
  assert.equal(d.at, 0); assert.equal(d.moving, false); assert.equal(d.step(1), false);
  d.set(true);
  assert.equal(d.moving, true); assert.equal(d.night, true);
  let frames = 0, before = 0;
  while (d.step(1 / 60)) { frames++; assert.ok(d.mix >= before); before = d.mix; assert.ok(frames < 1000); }
  assert.equal(d.at, 1); assert.equal(d.mix, 1);
  assert.ok(Math.abs(frames / 60 - TURN) < .05, `${frames} frames`);
  // back towards day, then night again before it gets there
  d.set(false); d.step(TURN / 2);
  assert.ok(Math.abs(d.at - .5) < 1e-9); assert.equal(d.mix, .5);
  d.set(true); d.step(TURN / 4);
  assert.ok(Math.abs(d.at - .75) < 1e-9);
  // at once: for a scene that's holding still, or anyone who's asked for less motion
  d.set(false, true); assert.equal(d.at, 0); assert.equal(d.moving, false);
  d.set(true); assert.equal(d.step(Infinity), true); assert.equal(d.at, 1);
  assert.equal(d.step(0), false);
  // eased: slow to start and to finish
  const e = dusk(false); e.set(true); e.step(TURN * .1);
  assert.ok(e.mix < .1 * .5);
});

test('the page has the toggle, and decides day or night before it loads anything else', () => {
  const html = read('../index.html');
  const button = html.match(/<button[^>]*id="rdMode"[^>]*>/)?.[0];
  assert.ok(button, 'the toggle is in the bar');
  assert.match(button, /type="button"/); assert.match(button, /aria-label="[^"]+"/);
  const first = html.indexOf('<script src="/mode.js"></script>');
  assert.ok(first > 0 && first < html.indexOf('</head>'), 'in the head');
  assert.ok(first < html.indexOf('type="module"'));
  // The site's Content-Security-Policy runs only its own scripts, so none can be written into the page.
  assert.equal([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].length, 0);
  assert.match(JSON.parse(read('../vercel.json')).headers[0].headers[0].value, /script-src 'self';/);
  // the still logo's night picture is one the toggle can switch
  assert.match(html, /<source srcset="\/logo-night\.png"[^>]*data-night/);
  assert.deepEqual(MODES.map(m => html.includes(`content="${CHROME[m]}"`)), [true, true], 'the browser\'s colour, each way');
});

test('nothing but the mode itself reads the system\'s light or dark setting', () => {
  const files = [];
  const walk = dir => { for (const e of readdirSync(here(dir), { withFileTypes: true })) e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(js|css)$/.test(e.name) && files.push(`${dir}/${e.name}`); };
  walk('../src'); walk('../ui');
  const reads = files.filter(f => /prefers-color-scheme/.test(read(f)));
  assert.deepEqual(reads, ['../src/mode.js'], 'styles go by [data-mode=night], and scripts by src/mode.js, so the toggle reaches them');
  assert.match(read('../src/theme.css'), /:root\[data-mode=night\]\{color-scheme:dark;/);
});

test('the page\'s colours fade for as long as the scenes take to turn', () => {
  const css = read('../src/theme.css');
  const fade = css.match(/:root\.rd-turning\{transition:([\d.]+)s [^;]*;transition-property:([^}]+)\}/);
  assert.ok(fade);
  assert.equal(Number(fade[1]), TURN);
  // each colour that fades is registered as one, or the browser would swap it instead
  for (const name of fade[2].split(',')) assert.match(css, new RegExp(`@property ${name}\\{syntax:'<color>'`), name);
  assert.match(css, /prefers-reduced-motion:reduce\)\{:root\.rd-turning\{transition:none\}/);
});
