// The plants: which kind each seed or plant grows, the pictures of every kind, and the models
// they're taken from. The models need three.js (npm install); without it those tests are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLANT_KINDS, plantKind, plantFile, plantPic } from '../ui/bits.js';

const STAGES = ['seed', 'seedling', 'young', 'established'];
const uri = n => `at://did:plc:planter/dev.rainshare.seed/3m${n.toString(32).padStart(11, '2')}`;

test('each seed or plant grows its own kind, the same every time', () => {
  assert.equal(plantKind(''), 0); assert.equal(plantKind(undefined), 0);
  const counts = Array(PLANT_KINDS).fill(0);
  for (let n = 0; n < 1200; n++) {
    const k = plantKind(uri(n));
    assert.ok(Number.isInteger(k) && k >= 0 && k < PLANT_KINDS);
    assert.equal(plantKind(uri(n)), k);
    counts[k]++;
  }
  // Records one after another (keys that differ only at the end) still spread over every kind.
  const fair = 1200 / PLANT_KINDS;
  assert.ok(counts.every(c => c > fair * .6 && c < fair * 1.4), `uneven: ${counts}`);
});

test('a plant\'s picture and its turning model are of the same kind', () => {
  const key = [...Array(50).keys()].map(uri).find(u => plantKind(u) !== 0), k = plantKind(key);
  const html = plantPic('young', 128, { live: true, key });
  assert.match(html, new RegExp(`src="/plants/young-${k}\\.webp"`));
  assert.match(html, new RegExp(`data-rs-plant="young" data-rs-kind="${k}"`));
  // With nothing to go by (the stage tiles, the preview of one not yet posted) it's the first kind.
  assert.match(plantPic('seed', 40), /src="\/plants\/seed\.webp"/);
  assert.match(plantPic('seed', 40, { live: true }), /data-rs-kind="0"/);
});

test('there\'s a picture of every stage of every kind', () => {
  const missing = [];
  for (let k = 0; k < PLANT_KINDS; k++) for (const s of STAGES) {
    const f = fileURLToPath(new URL(`../public/plants/${plantFile(s, k)}`, import.meta.url));
    if (!existsSync(f)) missing.push(plantFile(s, k));
  }
  assert.deepEqual(missing, [], 'run npm run plants');
});

const three = await import('three').catch(() => null);
const models = three && await import('../src/plants/models.js');
const skip = !three && 'three.js isn\'t installed';

// How far a plant reaches from its middle and how high it stands, over every point of it.
function extent(g){
  g.updateMatrixWorld(true);
  const v = new three.Vector3(); let reach = 0, top = 0, points = 0;
  g.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position; points += p.count;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      assert.ok(Number.isFinite(v.x + v.y + v.z));
      reach = Math.max(reach, Math.hypot(v.x, v.z)); top = Math.max(top, v.y);
    }
  });
  return { reach, top, points };
}

test('every stage of every kind grows, and stands inside the frame', { skip }, () => {
  const tallest = Object.fromEntries(STAGES.map(s => [s, 0]));
  for (let k = 0; k < PLANT_KINDS + 4; k++) for (const s of STAGES) {
    const g = models.buildPlant(s, k), e = extent(g);
    assert.ok(e.reach <= 1.3 + 1e-6, `${s} ${k} reaches ${e.reach}`);
    assert.ok(e.top <= 2.2 + 1e-6, `${s} ${k} stands ${e.top} high`);
    tallest[s] = Math.max(tallest[s], e.top);
    models.disposePlant(g);
  }
  // However a kind grows, each stage still stands taller than the one before it.
  for (let k = 0; k < PLANT_KINDS; k++) {
    const tops = STAGES.map(s => extent(models.buildPlant(s, k)).top);
    assert.ok(tops.every((t, i) => !i || t > tops[i - 1]), `kind ${k}: ${tops.map(t => t.toFixed(2))}`);
  }
});

test('a kind is the same plant every time, and kinds differ', { skip }, () => {
  const a = extent(models.buildPlant('established', 7)), b = extent(models.buildPlant('established', 7));
  assert.deepEqual(a, b);
  assert.deepEqual(models.traitsOf(7), models.traitsOf(7));
  // The first kind is the plant as first drawn.
  const first = models.traitsOf(0);
  assert.deepEqual([first.leaf, first.set, first.bloom.name, first.seed, first.petals, first.stems], ['oval', 'spiral', 'sky blue', 'almond', 5, 4]);
  // The kinds the pictures cover don't repeat in the things you notice first.
  const looks = new Set([...Array(PLANT_KINDS).keys()].map(k => { const T = models.traitsOf(k); return `${T.leaf} ${T.set} ${T.bloom.name}`; }));
  assert.equal(looks.size, PLANT_KINDS);
  // Odd values are still a kind.
  assert.equal(models.traitsOf(-3).kind, 3); assert.equal(models.traitsOf('5').kind, 5); assert.equal(models.traitsOf(NaN).kind, 0);
  assert.equal(models.buildPlant('nonsense', 2).name, 'young-2');
});
