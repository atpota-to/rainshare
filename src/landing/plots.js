// What's planted in the landing's garden (./garden.js): four asks from the example circle
// (../../core/demo.js), so each has a page of its own to go and look at, and is drawn as the
// same kind of plant there as here. test/landing.test.mjs checks they still match.
//
// The first is the one a friend's cloud is already raining on; it's done in the example, by
// that friend. The other three stand in the row for your cloud: an idea, a project that's
// just started, and one that's taking shape.
import { SEED } from '../../core/ns.js';
import { plantKind } from '../../ui/bits.js';

/** The friend whose cloud is out already. */
export const FRIEND = { name: 'Kai', color: '#8E9BFF' };

// The stage a plot is drawn at once the work on it is done: one on from where it was.
const NEXT = { seed: 'seedling', seedling: 'young', young: 'established' };
export const PLOTS = [
  { name: 'Sam', color: '#5ED6B2', did: 'did:example:sam', rkey: '3sq-sam', title: 'Give the quiz app a “show me a hint” button', stage: 'young', theirs: true },
  { name: 'Mo', color: '#C3B8FF', did: 'did:example:mo', rkey: '3sq-mo-idea', title: 'Bookmarks we can print from our reading list', stage: 'seed' },
  { name: 'Juniper', color: '#FFB495', did: 'did:example:juniper', rkey: '3sq-juniper', title: 'Keyboard navigation for the flashcard grid', stage: 'seedling' },
  { name: 'Priya', color: '#F5B3D6', did: 'did:example:priya', rkey: '3sq-priya', title: 'Dark mode for the carbon calculator', stage: 'young' }
].map(p => {
  const uri = `at://${p.did}/${SEED}/${p.rkey}`;
  return { ...p, uri, noun: p.stage === 'seed' ? 'idea' : 'project', next: NEXT[p.stage], kind: plantKind(uri), path: `/example/seed/${p.did}/${p.rkey}` };
});
/** Where what you've helped with shows, in the example circle. */
export const GARDEN_PATH = '/example/u/did:example:you';
