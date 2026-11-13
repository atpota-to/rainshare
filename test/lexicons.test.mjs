// The lexicons as files, and what counts as a breaking change to a published one (lexicons/compat.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { problems, breaking, same, OWNER } from '../lexicons/compat.mjs';

const dir = new URL('../lexicons/dev/rainshare/', import.meta.url);
const files = await Promise.all((await readdir(dir)).filter(f => f.endsWith('.json')).sort()
  .map(async name => ({ name, doc: JSON.parse(await readFile(new URL(name, dir), 'utf8')) })));
const copy = v => JSON.parse(JSON.stringify(v));
const take = () => copy(files.find(f => f.name === 'take.json').doc);
const seed = () => copy(files.find(f => f.name === 'seed.json').doc);

test('the lexicons as they stand have no problems, none breaks itself, and their owner is named by a DID', () => {
  assert.deepEqual(problems(files), []);
  assert.match(OWNER, /^did:plc:[a-z2-7]{24}$/);
  for (const { doc } of files) assert.deepEqual(breaking(doc, copy(doc)), [], doc.id);
});

test('a file named for another NSID, or a ref to a def that isn\'t there, is a problem', () => {
  const named = take(); named.id = 'dev.rainshare.taken';
  assert.match(problems([{ name: 'take.json', doc: named }]).join('\n'), /should be dev\.rainshare\.take/);
  const dangling = take(); dangling.defs.main.record.properties.setup.ref = 'dev.rainshare.defs#nope';
  assert.match(problems([...files.filter(f => f.name !== 'take.json'), { name: 'take.json', doc: dangling }]).join('\n'), /points at dev\.rainshare\.defs#nope/);
  assert.match(problems([{ name: 'take.json', doc: { lexicon: 2, id: 'dev.rainshare.take', defs: {} } }]).join('\n'), /"lexicon" should be 1[\s\S]*no defs/);
});

test('same ignores the order of keys', () => {
  assert.ok(same({ a: 1, b: { c: [1, 2], d: 2 } }, { b: { d: 2, c: [1, 2] }, a: 1 }));
  assert.ok(!same({ a: [1, 2] }, { a: [2, 1] }));
});

test('what may change: descriptions, knownValues, a new optional field, a new def, a new option in an open union', () => {
  const next = seed(), main = next.defs.main.record;
  next.defs.main.description = 'Said differently.';
  main.properties.state.knownValues.push('resting');
  main.properties.mood = { type: 'string', maxLength: 64 };
  next.defs.gitlabIssue = { type: 'object', properties: { url: { type: 'string', format: 'uri' } } };
  main.properties.subject.refs.push('#gitlabIssue');
  assert.deepEqual(breaking(seed(), next), []);
  // A local ref written out in full is the same ref.
  const t = take(); t.defs.main.record.properties.setup.ref = 'dev.rainshare.defs#setup';
  assert.deepEqual(breaking(take(), t), []);
});

test('what may not change, once published', () => {
  const cases = [
    ['a field removed', d => { delete d.defs.main.record.properties.note; }, /dev\.rainshare\.take\.note is gone/],
    ['a type changed', d => { d.defs.main.record.properties.note = { type: 'integer' }; }, /\.note: was "string", now "integer"/],
    ['a new required field', d => { d.defs.main.record.properties.why = { type: 'string' }; d.defs.main.record.required.push('why'); }, /why is required now/],
    ['a required field made optional', d => { d.defs.main.record.required = ['seed']; }, /createdAt isn't required any more/],
    ['a limit raised', d => { d.defs.main.record.properties.note.maxLength = 6000; }, /\.note: maxLength was 3000, now 6000/],
    ['a format changed', d => { d.defs.main.record.properties.createdAt.format = 'uri'; }, /format was "datetime", now "uri"/],
    ['a ref pointed elsewhere', d => { d.defs.main.record.properties.setup.ref = 'dev.rainshare.defs#forecast'; }, /\.setup: pointed at dev\.rainshare\.defs#setup/],
    ['the record key changed', d => { d.defs.main.key = 'any'; }, /key was "tid", now "any"/],
    ['the main def removed', d => { delete d.defs.main; }, /^dev\.rainshare\.take is gone$/],
  ];
  for (const [what, change, says] of cases) {
    const next = take(); change(next);
    assert.match(breaking(take(), next).join('\n'), says, what);
  }
  const s = seed(); s.defs.main.record.properties.subject.refs = s.defs.main.record.properties.subject.refs.filter(r => r !== '#repo');
  assert.match(breaking(seed(), s).join('\n'), /#repo is no longer one of its options/);
  const gone = seed(); delete gone.defs.wants;
  assert.match(breaking(seed(), gone).join('\n'), /dev\.rainshare\.seed#wants is gone/);
  const arr = seed(); arr.defs.main.record.properties.sproutedWith.maxLength = 16;
  assert.match(breaking(seed(), arr).join('\n'), /sproutedWith: maxLength was 8, now 16/);
});

test('a closed union takes no new options', () => {
  const closed = take(); closed.defs.main.record.properties.kind = { type: 'union', closed: true, refs: ['#a'] };
  const next = copy(closed); next.defs.main.record.properties.kind.refs.push('#b');
  assert.match(breaking(closed, next).join('\n'), /#b was added to a closed union/);
});

test('a kind of def the check doesn\'t know well may change only in its descriptions', () => {
  const q = { lexicon: 1, id: 'dev.rainshare.find', defs: { main: { type: 'query', description: 'a', parameters: { type: 'params', properties: { q: { type: 'string' } } } } } };
  const described = copy(q); described.defs.main.description = 'b';
  assert.deepEqual(breaking(q, described), []);
  const changed = copy(q); changed.defs.main.output = { encoding: 'application/json' };
  assert.match(breaking(q, changed).join('\n'), /this query changed/);
});
