// What grows in a garden and what's listed as someone's doing: buds, thanks, and activity
// grouped by ask (core/garden.js, core/activity.js), and the example circle's copy of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, TAKE, DELIVERY, COMMENT } from '../core/ns.js';
import { wateredBy, budsOf, onRepo } from '../core/garden.js';
import { activityOf, activityCounts } from '../core/activity.js';
import { parseSubject } from '../core/subjects.js';
import * as R from '../core/records.js';
import { createDemoSource } from '../core/demo.js';

const ME = 'did:plc:me', ASKER = 'did:plc:asker';
const issue = parseSubject('https://github.com/o/r/issues/3');
const at = d => `2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`;
const ask = (rkey, value = {}, extra = {}) => ({ uri: `at://${ASKER}/${SEED}/${rkey}`, cid: 'bafy' + rkey, repo: ASKER, rkey, author: { did: ASKER, displayName: 'Ada Asker' }, value: { title: 'Ask ' + rkey, createdAt: at(1), ...value }, ...extra });
const rec = (by, coll, rkey, seed, value = {}) => ({ uri: `at://${by}/${coll}/${rkey}`, cid: 'bafy' + rkey, repo: by, rkey, value: { seed: { uri: seed.uri, cid: seed.cid }, createdAt: at(2), ...value } });
const ref = r => ({ uri: r.uri, cid: r.cid });

test('a pull request only counts toward a bud on the ask’s own repo', () => {
  assert.ok(onRepo('https://github.com/o/r/pull/9', issue));
  assert.ok(onRepo('https://github.com/O/R/pull/9', issue), 'GitHub names are the same in any case');
  assert.ok(!onRepo('https://github.com/o/r2/pull/9', issue));
  assert.ok(!onRepo('https://github.com/o/r/pull/9', undefined), 'an idea has no repo');
});

test('buds: merged on the forge, still open, not yet accepted, and on the right repo', () => {
  const merged = (rkey, url, state = 'merged') => ({ ...rec(ME, DELIVERY, 'd' + rkey, { uri: `at://${ASKER}/${SEED}/${rkey}`, cid: 'bafy' + rkey }, { url }), state });
  const items = [
    ask('a1', { subject: issue, stage: 'seedling' }, { deliveries: [merged('a1', 'https://github.com/o/r/pull/1')] }),        // a bud
    ask('a2', { subject: issue }, { deliveries: [merged('a2', 'https://github.com/someone/else/pull/1')] }),                   // merged, elsewhere
    ask('a3', { subject: issue }, { deliveries: [merged('a3', 'https://github.com/o/r/pull/3', 'open')] }),                    // not merged
    ask('a4', { subject: issue, state: 'closed' }, { deliveries: [merged('a4', 'https://github.com/o/r/pull/4')] }),          // closed
    ask('a5', {}, { deliveries: [merged('a5', 'https://example.com/thing')] })                                                // an idea
  ];
  const buds = budsOf(ME, items);
  assert.deepEqual(buds.map(b => [b.rkey, b.budding, b.picture, b.link]), [['a1', true, 'seedling', 'https://github.com/o/r/pull/1']]);
  // Once whoever asked accepts it, it's a plant, with what they said, and no longer a bud.
  const done = ask('a1', { subject: issue, stage: 'seedling', state: 'sprouted', sproutedWith: [ref(items[0].deliveries[0])], updatedAt: at(9), thanks: '  Just   right. ' }, { deliveries: items[0].deliveries });
  assert.deepEqual(budsOf(ME, [done]), []);
  const [plant] = wateredBy(ME, [done]);
  assert.deepEqual([plant.picture, plant.thanks, plant.at, plant.link, plant.shared], ['young', 'Just right.', at(9), 'https://github.com/o/r/pull/1', true]);
  assert.equal(wateredBy(ME, [{ ...done, shared: false }])[0].shared, false, 'an ask not meant for whoever’s looking is marked so');
});

test('thanks is kept with the ask, clipped, and taken away when left empty', () => {
  const first = R.seed({ title: 'Fix it', thanks: 'x'.repeat(400) });
  assert.equal([...first.thanks].length, 300);
  const kept = R.seed({ ...first, state: 'sprouted' }, first);
  assert.equal(kept.thanks, first.thanks, 'saving it again keeps what was said');
  assert.equal(R.seed({ ...first, thanks: '' }, first).thanks, undefined);
  assert.equal(R.seed({ title: 'No thanks' }).thanks, undefined);
});

test('activity is told ask by ask: what happened, once each, newest first, and nothing about going quiet', () => {
  const mine = ask('m1', { title: 'Mine', createdAt: at(3), state: 'sprouted', updatedAt: at(8), sproutedWith: [{ uri: `at://did:plc:kai/${DELIVERY}/k1`, cid: 'x' }] });
  mine.repo = ME; mine.uri = `at://${ME}/${SEED}/m1`;
  const helped = ask('h1', { subject: issue, createdAt: at(1) }), talked = ask('t1', { createdAt: at(1) }), gone = ask('g1');
  const t1 = rec(ME, TAKE, 'tk1', helped, { createdAt: at(4), until: at(5) });   // its day passed: it's still "took it on"
  const t2 = rec(ME, TAKE, 'tk2', helped, { createdAt: at(6) });                  // dropped and taken again
  const d1 = rec(ME, DELIVERY, 'dl1', helped, { createdAt: at(7), url: 'https://github.com/o/r/pull/5' });
  helped.value = { ...helped.value, state: 'sprouted', sproutedWith: [ref(d1)], updatedAt: at(10) };
  const comments = [rec(ME, COMMENT, 'c1', talked, { createdAt: at(2) }), rec(ME, COMMENT, 'c2', talked, { createdAt: at(5) }), rec(ME, COMMENT, 'c3', gone, { createdAt: at(11) })];
  const seeds = new Map([mine, helped, talked].map(s => [s.uri, s]));
  const vouches = [{ did: 'did:plc:kai', kind: 'vouch', reason: 'Careful.', at: at(12) }, { did: 'did:plc:eve', kind: 'denounce', reason: 'No.', at: at(13) }];
  const stories = activityOf(ME, { asks: [mine], takes: [t1, t2], deliveries: [d1], comments, vouches, seeds });
  assert.deepEqual(stories.map(s => [s.kind, s.seed?.rkey || s.person.did, s.at]), [
    ['vouched', 'did:plc:kai', at(12)],   // a denouncement isn't listed, and a comment on an ask that's gone isn't either
    ['helped', 'h1', at(10)],
    ['asked', 'm1', at(8)],
    ['talked', 't1', at(5)]
  ]);
  const h = stories.find(s => s.kind === 'helped');
  assert.deepEqual(h.steps.map(x => [x.what, x.at]), [['took', at(4)], ['turned-in', at(7)], ['accepted', at(10)]]);
  assert.deepEqual([h.steps[1].link, h.steps[1].idea, h.steps[2].by], ['https://github.com/o/r/pull/5', false, ASKER]);
  assert.ok(!JSON.stringify(h.steps).includes('lapsed'));
  assert.deepEqual(stories.find(s => s.kind === 'asked').steps.map(x => [x.what, x.with]), [['asked', undefined], ['done', ['did:plc:kai']]]);
  assert.equal(stories.find(s => s.kind === 'talked').comments, 2);
  assert.deepEqual(activityCounts(stories), { all: 4, asks: 1, helping: 1, comments: 1, vouches: 1 });
});

test('in the example circle: activity, a bud, and a bud that grows once you accept it with thanks', async () => {
  const src = createDemoSource({});
  const kai = await src.activityOf('did:example:kai');
  assert.deepEqual(kai.filter(s => s.kind === 'vouched').map(s => s.person.displayName).sort(), ['Juniper Hale', 'Tomás Rivera']);
  assert.deepEqual(kai.find(s => s.kind === 'helped').steps.map(x => x.what), ['took', 'turned-in', 'accepted']);
  // Juniper's pull request on your ask was merged, and you haven't accepted it yet.
  assert.deepEqual((await src.buddingOf('did:example:juniper')).map(b => b.rkey), ['3sq-you']);
  const yours = (await src.board()).items.find(i => i.rkey === '3sq-you'), by = yours.deliveries[0];
  await src.update(yours, { state: 'sprouted', sproutedWith: [{ uri: by.uri, cid: by.cid }], thanks: 'Exactly the size I wanted.' });
  assert.deepEqual(await src.buddingOf('did:example:juniper'), []);
  assert.deepEqual((await src.gardenOf('did:example:juniper')).map(g => [g.rkey, g.thanks]), [['3sq-you', 'Exactly the size I wanted.']]);
  const done = (await src.activityOf(src.viewer)).find(s => s.seed?.rkey === '3sq-you');
  assert.deepEqual(done.steps.at(-1).people.map(p => p.displayName), ['Juniper Hale']);
});
