// The landing's garden: what's planted in it comes from the example circle, and is drawn there
// as the plant it is here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PLOTS, FRIEND } from '../src/landing/plots.js';
import { createDemoSource } from '../core/demo.js';
import { stageOf, pictureOf, nounOf } from '../core/words.js';
import { plantKind, firstName } from '../ui/bits.js';

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
});

// The garden is the page's backdrop, and is fitted into the part of it the page keeps clear.
test('the garden is drawn as big as fits its frame, and no bigger', async () => {
  const { fit, FRAME, EYE, UNDER, OVER, BASE, TOP } = await import('../src/landing/fit.js');
  // beside the pitch on a laptop, a wide desktop, a short window, and under the pitch on a phone
  const frames = [{ x: 595, y: 92, w: 795, h: 618 }, { x: 835, y: 92, w: 987, h: 776 }, { x: 526, y: 92, w: 730, h: 418 }, { x: 0, y: 640, w: 390, h: 360, close: true }];
  for (const f of frames) {
    const { reach, aim } = FRAME[f.close ? 'close' : 'wide'], at = fit(f);
    const left = at.midX - reach * at.unit, right = at.midX + reach * at.unit, top = at.midY - (OVER - aim) * at.unit - TOP, foot = at.midY + (aim + UNDER) * at.unit + BASE;
    assert.ok(left >= f.x - .01 && right <= f.x + f.w + .01, 'the row is inside the frame from side to side');
    assert.ok(top >= f.y - .01, 'what’s written over your cloud is under the frame’s top');
    assert.ok(Math.abs(foot - (f.y + f.h)) < .01, 'the plots’ labels sit along its lower edge');
    assert.ok(right - left > f.w - .01 || top < f.y + .01, 'it touches the frame’s sides, or its top');
    // the horizon is level with the eye: over what the camera looks at when the eye is higher than that
    assert.equal(Math.sign(at.midY - at.horizon), Math.sign(EYE[1] - aim));
    assert.equal(at.lens, at.unit * EYE[2]);
  }
});

test('a canvas the garden has to itself is framed as the scene was in its box', async () => {
  const { fit, alone, FRAME } = await import('../src/landing/fit.js');
  // the link preview's canvas, and the box the scene had beside the pitch
  for (const [w, h] of [[860, 720], [793, 666], [358, 322]]) {
    const at = fit(alone(w, h));
    assert.ok(Math.abs(at.unit - w / (2 * FRAME.wide.reach)) < 1e-9, 'the row runs from one side to the other');
    assert.ok(Math.abs(at.midX - w / 2) < 1e-9 && Math.abs(at.midY - h / 2) < 1e-9, 'what the camera looks at is in the middle');
  }
});

// Until the scene is drawn, and in its place where it can't be, the landing shows a still of
// it (scripts/still.mjs), scaled and moved to where the scene would draw the garden.
test('the garden\'s stills have a label for each plot, and reach past every window\'s edges', async () => {
  const { STILLS } = await import('../src/landing/still/still.js');
  // The furthest a window reaches from the point the camera looks at, in units of the scene,
  // for each framing, measured on the page from 320 by 568 to 3840 by 2160 (and 1200 by 1600).
  const most = { wide: { left: 22.3, right: 9.7, top: 21.3, bottom: 12.8 }, close: { left: 5.35, right: 5.35, top: 24.1, bottom: 13.7 } };
  assert.deepEqual(Object.keys(STILLS).sort(), Object.keys(most).sort());
  for (const [name, s] of Object.entries(STILLS)) {
    assert.equal(s.plots.length, PLOTS.length * 2, `${name}: a label under each plot (npm run still, after changing them)`);
    const m = most[name];
    assert.ok(s.midX / s.unit >= m.left && (s.w - s.midX) / s.unit >= m.right, `${name}: from side to side`);
    assert.ok(s.midY / s.unit >= m.top && (s.h - s.midY) / s.unit >= m.bottom, `${name}: from top to bottom`);
    for (const mode of ['day', 'night']) assert.ok(existsSync(new URL(`../src/landing/still/${name}-${mode}.webp`, import.meta.url)), `${name}-${mode}.webp`);
  }
});

// Under the sign-in, the way down to the real board says how many asks are open, and whose.
test('the way down to the board says what’s open in a few words', async () => {
  const { peekWords } = await import('../src/landing/peek.js');
  const { parseSubject } = await import('../core/subjects.js');
  const idea = { title: 'An idea' }, project = { title: 'A project', subject: parseSubject('https://github.com/a/b') };
  assert.equal(peekWords([]), '', 'nothing open: nothing to say, and the link stays out of sight');
  assert.equal(peekWords(null), '');
  assert.equal(peekWords([idea]), '1 idea to help with');
  assert.equal(peekWords([idea, idea, idea]), '3 ideas to help with');
  assert.equal(peekWords([project]), '1 project to help with');
  assert.equal(peekWords([project, project]), '2 projects to help with');
  assert.equal(peekWords([idea, project, idea]), '3 ideas and projects to help with');
});

test('the way down to the board shows each person asking once, the first few of them', async () => {
  const { peekPeople } = await import('../src/landing/peek.js');
  const ask = (repo, name) => ({ repo, author: name ? { did: repo, displayName: name } : undefined });
  const people = peekPeople([ask('did:a', 'Ana'), ask('did:b', 'Ben'), ask('did:a', 'Ana'), ask('did:c'), ask('did:d', 'Dee')]);
  assert.deepEqual(people.map(p => p.did), ['did:a', 'did:b', 'did:c']);
  assert.equal(people[2].displayName, undefined, 'someone whose profile isn’t known yet still has a face (their initial)');
  assert.deepEqual(peekPeople(undefined), []);
});
