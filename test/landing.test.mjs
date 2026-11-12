// The landing's garden: what's planted in it comes from the example circle, so every plot has
// a page to go and look at, and is drawn there as the plant it is here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLOTS, FRIEND, GARDEN_PATH } from '../src/landing/plots.js';
import { createDemoSource } from '../core/demo.js';
import { stageOf, pictureOf, nounOf } from '../core/words.js';
import { plantKind, pathOf, firstName } from '../ui/bits.js';

test('every plot in the landing\'s garden is an ask in the example circle', async () => {
  const { items } = await createDemoSource().board();
  for (const p of PLOTS) {
    const it = items.find(i => i.uri === p.uri);
    assert.ok(it, `${p.name}'s isn't in the example circle: ${p.uri}`);
    assert.equal(it.value.title, p.title);
    assert.equal(firstName(it.author), p.name);
    assert.equal(it.author.color, p.color);
    assert.equal(stageOf(it.value), p.stage);
    assert.equal(nounOf(it.value), p.noun);
    assert.equal(p.kind, plantKind(it.uri), 'the same kind of plant as on its own page');
    assert.equal(p.path, '/example/' + pathOf(it), 'its page in the example circle');
  }
});

test('the garden has one plot a friend is on, and three in a row for your cloud', async () => {
  const { items } = await createDemoSource().board();
  assert.deepEqual(PLOTS.map(p => !!p.theirs), [true, false, false, false]);
  // The friend's: done in the example, by that friend, and drawn a stage on once it is.
  const theirs = PLOTS[0], it = items.find(i => i.uri === theirs.uri);
  assert.equal(it.value.state, 'sprouted');
  assert.ok(it.deliveries.some(d => firstName(d.author) === FRIEND.name));
  assert.equal(theirs.next, pictureOf(it.value));
  // Yours: an idea, then a project that's just started, then one that's taking shape. Each is
  // still open, and has a stage on to grow to.
  assert.deepEqual(PLOTS.slice(1).map(p => p.stage), ['seed', 'seedling', 'young']);
  for (const p of PLOTS.slice(1)) {
    const mine = items.find(i => i.uri === p.uri);
    assert.notEqual(mine.value.state, 'sprouted');
    assert.equal(p.next, pictureOf({ ...mine.value, state: 'sprouted' }));
  }
  assert.equal(GARDEN_PATH, '/example/u/' + createDemoSource().viewer);
});
