// An example circle: pretend friends, their profiles and seeds, for trying Rainshare
// without signing in (the Example tab on rainshare.dev).
// It answers the same calls as the real source (source.js); what you do is kept in this
// browser through `store`, and nothing is written anywhere.
import { wateredBy } from './garden.js';
import { PROFILE, SEED, TAKE, DELIVERY } from './ns.js';
import * as R from './records.js';
import { closeness } from './circle.js';

const ME = 'did:example:you';
const day = 864e5, ago = n => new Date(Date.now() - n).toISOString();
const sq = kind => `${SEED}#${kind}`;
const GROUP = { did: 'did:example:spineclub', handle: 'spineclub.example', name: 'Spine Club', memberCount: 14, space: 'at://did:example:spineclub/space/dev.rainshare.board/rainshare' };
// A second group of yours that has no Rainshare space yet, so "Add it" has something to do.
const HACKERS = { did: 'did:example:hackers', handle: 'hackers.example', name: 'Weekend Hackers', memberCount: 38, space: 'at://did:example:hackers/space/dev.rainshare.board/rainshare' };
const GROUPS = { [GROUP.did]: GROUP, [HACKERS.did]: HACKERS };

const PEOPLE = {
  'did:example:juniper': { handle: 'juniper.example', displayName: 'Juniper Hale', color: '#FFB495', rel: 'mutual',
    profile: { bio: 'Second-year CS student. Building study tools for people who learn differently.', budget: 'none', circumstances: ['student'], values: ['accessibility', 'education'], setups: [{ harness: 'other', models: ['local'], plan: 'Whatever runs on my laptop', runsOn: 'local' }] } },
  'did:example:tomas': { handle: 'tomas.example', displayName: 'Tomás Rivera', color: '#86DFC4', rel: 'follows-you',
    profile: { bio: 'I maintain tidepool, a tiny sync tool for local-first apps.', budget: 'low', circumstances: ['oss-maintainer'], values: ['local-first', 'open-source'], setups: [{ harness: 'aider', models: ['claude-haiku-5-5'], plan: 'API, pay as I go', runsOn: 'local' }] } },
  'did:example:amara': { handle: 'amara.example', displayName: 'Amara Okafor', color: '#FFD978', rel: null,
    profile: { bio: 'I keep the Eastside Food Share’s volunteer site running in my evenings.', budget: 'free', circumstances: ['nonprofit'], values: ['mutual-aid', 'civic'] } },
  'did:example:kai': { handle: 'kai.example', displayName: 'Kai Nakamura', color: '#8E9BFF', rel: 'mutual',
    profile: { bio: 'Staff engineer. My plan resets on Mondays and I hate wasting it.', budget: 'high', values: ['open-source', 'climate'], priorities: ['low-budget', 'students'], offering: ['go', 'rust', 'testing'],
      setups: [{ harness: 'claude-code', models: ['claude-opus-5-5'], plan: 'Claude Max 20x', runsOn: 'cloud' }], forecast: { level: 'downpour', models: ['claude-opus-5-5'], until: new Date(Date.now() + 3 * day).toISOString(), note: 'Send me your gnarly ones' } } },
  'did:example:priya': { handle: 'priya.example', displayName: 'Priya Shah', color: '#F5B3D6', rel: 'mutual',
    profile: { bio: 'Climate data nerd, between jobs and building in public.', budget: 'none', circumstances: ['between-jobs'], values: ['climate', 'open-source'] } },
  'did:example:mo': { handle: 'mo.example', displayName: 'Mo Adeyemi', color: '#C3B8FF', rel: 'group',
    profile: { bio: 'Spine Club’s unofficial web person. Learning as I go!', budget: 'free', circumstances: ['learning'], values: ['education'] } },
  'did:example:sam': { handle: 'sam.example', displayName: 'Sam Lindqvist', color: '#5ED6B2', rel: 'you-follow',
    profile: { bio: 'I teach intro programming and make little tools for my class.', budget: 'sponsored', circumstances: ['educator'], values: ['education', 'accessibility'],
      setups: [{ harness: 'codex', models: ['gpt-5-codex'], plan: 'School pays', runsOn: 'cloud' }], forecast: { level: 'drizzle' } } }
};

const SEEDS = [
  { id: '3sq-juniper', by: 'did:example:juniper', at: 2 * 3600e3, value: {
    title: 'Keyboard navigation for the flashcard grid', stage: 'seedling',
    subject: { $type: sq('githubIssue'), url: 'https://github.com/example/flashdeck/issues/14', repo: 'example/flashdeck', number: 14 },
    spec: 'Right now the card grid only works with a mouse, so a couple of my classmates can’t use it.\n\n**Done looks like**\n- Arrow keys move between cards, Enter flips one\n- Focus is visible (the outline is currently removed in `grid.css`)\n- Screen readers announce “card 3 of 20, front”\n\nPlease don’t pull in a component library: it’s plain JS on purpose.',
    wants: { tests: 'welcome', maxDiffLines: 250, notes: 'I’d love to learn from it, so small commits with clear messages please.' },
    tags: ['javascript', 'accessibility', 'css'], values: ['accessibility'], size: 'small', audience: { $type: sq('mutuals') } } },
  { id: '3sq-tomas', by: 'did:example:tomas', at: 26 * 3600e3, value: {
    title: 'Add a --json flag to tidepool status', stage: 'established',
    subject: { $type: sq('tangledIssue'), url: 'https://tangled.org/tomas.example/tidepool/issues/31', repoUrl: 'https://tangled.org/tomas.example/tidepool' },
    spec: 'Scripts keep scraping the human output. A `--json` flag should print one object per peer: `{ "peer", "lastSync", "pending" }`.\n\nKeep the human output byte-for-byte identical.',
    wants: { models: ['claude-opus-5-5', 'claude-sonnet-5-5'], tests: 'required', maxDiffLines: 200 },
    tags: ['rust', 'cli'], values: ['local-first'], size: 'small', audience: { $type: sq('following') } } },
  { id: '3sq-amara', by: 'did:example:amara', at: 3 * day, value: {
    title: 'Export volunteer shifts to a calendar file', stage: 'young',
    subject: { $type: sq('githubIssue'), url: 'https://github.com/example/foodshare-volunteers/issues/7', repo: 'example/foodshare-volunteers', number: 7 },
    spec: 'Volunteers want their shifts in their own calendars. A “Add to calendar” link per person that serves an `.ics` with their upcoming shifts would be perfect.\n\nIt’s a small Django app. Please keep it boring and well commented: I’m the only maintainer.',
    wants: { tests: 'welcome', notes: 'No new paid services.' },
    tags: ['python', 'django'], values: ['mutual-aid', 'civic'], size: 'medium', audience: { $type: sq('anyone') } } },
  { id: '3sq-kai', by: 'did:example:kai', at: 5 * day, value: {
    title: 'Fix the flaky timezone test', stage: 'established',
    subject: { $type: sq('knotlessIssue'), url: 'https://knotless.dev/kai.example/almanac/issue/did:example:kai/3mzissue88', repoUrl: 'https://knotless.dev/kai.example/almanac', uri: 'at://did:example:kai/dev.knotless.issue/3mzissue88' },
    spec: '`TestNextOccurrence` fails about one run in twenty around midnight UTC. I suspect it reads the wall clock somewhere.',
    wants: { tests: 'required' }, tags: ['go', 'testing'], size: 'tiny', parallel: true, audience: { $type: sq('mutuals') } } },
  { id: '3sq-priya', by: 'did:example:priya', at: 9 * 3600e3, value: {
    title: 'Dark mode for the carbon calculator', stage: 'young',
    subject: { $type: sq('repo'), url: 'https://github.com/example/footprint', forge: 'github', name: 'example/footprint' },
    spec: 'The calculator is unreadable at night. Respect `prefers-color-scheme`, and add a toggle that remembers the choice.\n\nThe charts use hard-coded colours in `charts.js`: those need tokens too.',
    wants: { models: ['claude-sonnet-5-5'], tests: 'none', maxDiffLines: 400 },
    tags: ['css', 'javascript'], values: ['climate'], size: 'small', audience: { $type: sq('mutuals') } } },
  { id: '3sq-mo', by: 'did:example:mo', at: 30 * 3600e3, private: true, value: {
    title: 'Import our reading list from a Goodreads export', stage: 'seedling',
    subject: { $type: sq('repo'), url: 'https://github.com/example/spine-club-site', forge: 'github', name: 'example/spine-club-site' },
    spec: 'We keep our shelf in a Google Sheet and it’s a mess. Goodreads exports a CSV: a page where I upload it and it fills `books.json` would save me hours.\n\nI’m still learning, so please explain what you did in the PR.',
    wants: { tests: 'welcome' }, tags: ['javascript'], values: ['education'], size: 'small', audience: { $type: sq('group'), group: GROUP.did } } },
  { id: '3sq-sam', by: 'did:example:sam', at: 8 * day, state: 'sprouted', forge: { issue: { title: 'Show the hint we already have', state: 'closed' } }, value: {
    title: 'Give the quiz app a “show me a hint” button', stage: 'young',
    subject: { $type: sq('githubIssue'), url: 'https://github.com/example/quizbowl/issues/3', repo: 'example/quizbowl', number: 3 },
    spec: 'Each question has a `hint` field we never show. A button that reveals it (and marks the answer as hinted) would help my students.',
    wants: { tests: 'welcome' }, tags: ['javascript', 'education'], values: ['education'], size: 'tiny', audience: { $type: sq('anyone') } } },
  // An idea from someone who won't build it: there's no repo, and whoever runs with it keeps it.
  { id: '3sq-mo-idea', by: 'did:example:mo', at: 14 * 3600e3, value: {
    title: 'Bookmarks we can print from our reading list',
    spec: 'I’m not going to build this, but our book club would use it every month.\n\nPaste in a list of titles and authors, and get a page of bookmarks to print and cut out, one per book. Six to a page would be perfect.\n\nIt doesn’t need accounts or anything clever. A single web page is plenty.',
    owner: 'helper', parallel: true, tags: ['printing', 'books'], values: ['education'], size: 'small', audience: { $type: sq('anyone') } } },
  // Two you helped finish a while back: they're what's in the garden you've watered.
  { id: '3sq-priya-done', by: 'did:example:priya', at: 21 * day, state: 'sprouted', value: {
    title: 'A carbon label for recipes',
    spec: 'Paste in a recipe and get a rough footprint per serving, with the biggest ingredient called out. I’d use it on my blog.',
    owner: 'helper', parallel: true, tags: ['climate'], values: ['climate'], size: 'small', audience: { $type: sq('mutuals') } } },
  { id: '3sq-tomas-done', by: 'did:example:tomas', at: 30 * day, state: 'sprouted', forge: { issue: { title: 'Sync gives up on the first dropped connection', state: 'closed' } }, value: {
    title: 'Retry sync when the network drops', stage: 'established',
    subject: { $type: sq('tangledIssue'), url: 'https://tangled.org/tomas.example/tidepool/issues/27', repoUrl: 'https://tangled.org/tomas.example/tidepool' },
    spec: 'A dropped connection ends the whole sync. Three tries with a short wait between them would cover almost every case.',
    wants: { tests: 'required' }, tags: ['rust'], values: ['local-first'], size: 'small', audience: { $type: sq('following') } } },
  // One of your own, most of the way round: a friend's pull request has been merged, and it's
  // waiting for you to mark it sprouted.
  { id: '3sq-you', by: ME, at: 6 * day, forge: { issue: { title: 'README screenshots are out of date', state: 'open' } }, value: {
    title: 'Fresh screenshots for the README, light and dark', stage: 'seedling',
    subject: { $type: sq('githubIssue'), url: 'https://github.com/example/pocket-almanac/issues/12', repo: 'example/pocket-almanac', number: 12 },
    spec: 'The README still shows the old look. Two new screenshots of the main screen, one in each theme, at the same window size.',
    wants: { tests: 'none' }, tags: ['docs'], size: 'tiny', audience: { $type: sq('mutuals') } } }
];
const TAKES = [
  { id: '3tk-kai-amara', by: 'did:example:kai', on: '3sq-amara', at: 2 * day, value: { setup: { harness: 'claude-code', models: ['claude-opus-5-5'] }, note: 'On it this weekend' } },
  { id: '3tk-kai-sam', by: 'did:example:kai', on: '3sq-sam', at: 7 * day, value: { setup: { harness: 'claude-code', models: ['claude-opus-5-5'] } } },
  { id: '3tk-juniper-you', by: 'did:example:juniper', on: '3sq-you', at: 5 * day, value: { setup: { harness: 'claude-code', models: ['claude-sonnet-5-5'] } } }
];
const DELIVERIES = [
  { id: '3dl-kai-sam', by: 'did:example:kai', on: '3sq-sam', at: 6 * day, state: 'merged', value: { url: 'https://github.com/example/quizbowl/pull/4', setup: { harness: 'claude-code', models: ['claude-opus-5-5'] }, note: 'Hint button plus a little “hinted” badge on the score screen.' } },
  { id: '3dl-juniper-you', by: 'did:example:juniper', on: '3sq-you', at: 4 * day, state: 'merged', value: { url: 'https://github.com/example/pocket-almanac/pull/13', setup: { harness: 'claude-code', models: ['claude-sonnet-5-5'] }, note: 'Both themes, taken at the same window size.' } },
  { id: '3dl-you-priya', by: ME, on: '3sq-priya-done', at: 18 * day, value: { url: 'https://github.com/you-example/recipe-footprint', setup: { harness: 'claude-code', models: ['claude-sonnet-5-5'] }, note: 'One page, no accounts. The numbers are rough and say so.' } },
  { id: '3dl-you-tomas', by: ME, on: '3sq-tomas-done', at: 27 * day, state: 'merged', value: { url: 'https://tangled.org/tomas.example/tidepool/pulls/29', setup: { harness: 'claude-code', models: ['claude-sonnet-5-5'] } } }
];
const MY_PROFILE = {
  bio: 'Here to put my leftover usage to good use.', budget: 'medium', values: ['accessibility', 'open-source', 'climate'], priorities: ['low-budget', 'students', 'values-aligned'], offering: ['javascript', 'css', 'python'],
  setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'], plan: 'Claude Pro', runsOn: 'local' }], forecast: { level: 'showers', models: ['claude-sonnet-5-5'] }
};

// `groups`: whether private seeds in groups are part of it (GROUPS in ns.js). Without them
// the example has no group seed, no groups to share a profile with, and nothing kept back.
export function createDemoSource({ store = null, me: meOverride = null, groups = true } = {}){
  const saved = store?.get('rainshare') || {};
  const state = { profile: saved.profile || MY_PROFILE, hidden: groups ? saved.hidden || ['budget'] : [], share: groups ? saved.share ?? [GROUP.did] : [], mine: saved.mine || [], takes: saved.takes || [], deliveries: saved.deliveries || [], removed: saved.removed || [], edits: saved.edits || {}, added: saved.added || [] };
  const save = () => store?.set('rainshare', state);
  const me = { did: ME, handle: meOverride?.handle || 'you.example', displayName: meOverride?.displayName || 'You', avatar: meOverride?.avatar || null };

  const person = did => did === ME ? me : { did, handle: PEOPLE[did]?.handle, displayName: PEOPLE[did]?.displayName, avatar: null, color: PEOPLE[did]?.color };
  const groupOf = x => x.private ? GROUPS[x.group] || GROUP : null;
  const uriOf = (by, coll, id, g) => g ? `${g.space}/${by}/${coll}/${id}` : `at://${by}/${coll}/${id}`;
  const cidOf = id => 'bafyexample' + id.replace(/[^a-z0-9]/g, '');
  const rec = (x, coll) => ({ uri: uriOf(x.by, coll, x.id, groupOf(x)), cid: cidOf(x.id), repo: x.by, rkey: x.id, value: { $type: coll, createdAt: ago(x.at), ...x.value }, author: person(x.by) });

  function items(){
    const all = [...SEEDS.map(x => ({ ...x, value: { ...x.value, ...(x.state ? { state: x.state } : {}) } })), ...state.mine]
      .filter(x => !state.removed.includes(x.id) && (groups || !x.private))
      .map(x => ({ ...x, value: { ...x.value, ...(state.edits[x.id] || {}) } }));
    // The example takes and deliveries point at their seed the way real ones do: a strong ref.
    const on = x => { const s = SEEDS.find(q => q.id === x.on); return { ...x, value: { ...x.value, seed: { uri: uriOf(s.by, SEED, s.id, groupOf(s)), cid: cidOf(s.id) } } }; };
    const takes = [...TAKES.map(t => rec(on(t), TAKE)), ...state.takes.map(t => ({ ...t, author: me }))];
    // What the forge would say is part of the pretence (`state` on a delivery, `forge` on a
    // seed): for real seeds it's asked of GitHub or Tangled, in status.js.
    const dels = [...DELIVERIES.map(d => ({ ...rec(on(d), DELIVERY), ...(d.state ? { state: d.state } : {}) })), ...state.deliveries.map(d => ({ ...d, author: me }))];
    return all.map(x => {
      const r = rec(x, SEED);
      const mine = x.by === ME, priv = !!x.private, g = groupOf(x);
      if (x.value.createdAt) r.value = x.value;
      const sqUri = r.uri;
      return {
        ...r, example: true, space: g?.space || null, group: g, ...(x.forge || {}),
        closeness: mine ? 'self' : priv ? 'group' : closeness({ viewer: ME, author: x.by, rel: relOf(x.by) }),
        profile: mine ? state.profile : PEOPLE[x.by]?.profile || null,
        takes: takes.filter(t => t.value.seed?.uri === sqUri),
        deliveries: dels.filter(d => d.value.seed?.uri === sqUri)
      };
    }).map(it => {
      // One that sprouted before you arrived names the work that did it, as a real one would.
      if (it.value.state === 'sprouted' && !it.value.sproutedWith && it.deliveries.length) it.value = { ...it.value, sproutedWith: it.deliveries.map(d => ({ uri: d.uri, cid: d.cid })) };
      return it;
    }).sort((a, b) => String(b.value.createdAt).localeCompare(String(a.value.createdAt)));
  }
  const relOf = did => ({ mutual: { following: true, followedBy: true }, 'follows-you': { followedBy: true }, 'you-follow': { following: true } })[PEOPLE[did]?.rel] || null;
  const find = uri => items().find(i => i.uri === uri) || null;
  const pause = v => new Promise(r => setTimeout(() => r(v), 180));
  let n = 0;
  const tid = p => `3${p}-${Date.now().toString(36)}${(n++).toString(36)}`;

  return {
    viewer: ME, signedIn: true, canPrivate: groups, demo: true, me,
    board: () => pause({ items: items(), notes: [] }),
    seed: uri => pause(find(uri)),
    async profileOf(did){
      if (did === ME) return { person: me, public: R.publicProfile(state.profile, state.hidden), merged: state.profile, hidden: state.hidden, groups: state.share.includes(GROUP.did) ? [GROUP] : [] };
      const p = PEOPLE[did];
      return p ? { person: person(did), public: p.profile, merged: p.profile, hidden: [], groups: [] } : { person: { did }, public: null, merged: null, hidden: [], groups: [] };
    },
    async saveProfile(input, { hidden = [], share = [] } = {}){
      state.profile = R.profile(input, state.profile); state.hidden = groups ? hidden : []; state.share = groups ? share : []; save();
      return pause(state.profile);
    },
    async plant(input, { group } = {}){
      const g = group ? GROUPS[group?.did || group] || GROUP : null;
      const value = R.seed({ ...input, group: g?.did });
      const x = { id: tid('sq'), by: ME, at: 0, private: !!g, group: g?.did, value };
      state.mine.unshift(x); save();
      return pause({ uri: uriOf(ME, SEED, x.id, g), cid: cidOf(x.id), space: g?.space || null });
    },
    async update(item, input){
      const record = R.seed({ ...item.value, ...input, group: item.group?.did }, item.value);
      if (input.state === 'open') delete record.state;
      const own = state.mine.find(x => x.id === item.rkey);
      if (own) own.value = record; else state.edits[item.rkey] = record;
      save(); return pause(record);
    },
    async remove(item){ state.mine = state.mine.filter(x => x.id !== item.rkey); state.removed.push(item.rkey); save(); return pause(); },
    async take(item, { setup, note } = {}){
      const value = R.take({ seed: item, setup, note });
      const id = tid('tk');
      const t = { uri: uriOf(ME, TAKE, id, item.group), cid: cidOf(id), repo: ME, rkey: id, value };
      state.takes.push(t); save(); return pause(t);
    },
    async drop(item){ state.takes = state.takes.filter(t => t.value.seed?.uri !== item.uri); save(); return pause(); },
    async turnIn(item, input){
      const value = R.delivery({ ...input, seed: item, take: state.takes.find(t => t.value.seed?.uri === item.uri) });
      const id = tid('dl');
      const d = { uri: uriOf(ME, DELIVERY, id, item.group), cid: cidOf(id), repo: ME, rkey: id, value };
      state.deliveries.push(d); save(); return pause(d);
    },
    forget(){},
    reset(){ store?.set('rainshare', null); Object.assign(state, { profile: MY_PROFILE, hidden: groups ? ['budget'] : [], share: groups ? [GROUP.did] : [], mine: [], takes: [], deliveries: [], removed: [], edits: {}, added: [] }); },
    groups: () => Promise.resolve(!groups ? [] : [GROUP, { ...HACKERS, space: state.added.includes(HACKERS.did) ? HACKERS.space : null, canAdd: true }]),
    reach: () => Promise.resolve({ following: 312, followers: 1204, mutuals: 84 }),
    addToGroup: async did => { if (!state.added.includes(did)) state.added.push(did); save(); return pause(GROUPS[did]?.space || `at://${did}/space/dev.rainshare.board/rainshare`); },
    lists: () => Promise.resolve([{ uri: 'at://did:example:you/app.bsky.graph.list/trusted', name: 'People whose agents I trust', count: 12 }]),
    tangledRepos: () => Promise.resolve([{ uri: 'at://did:example:garden/org.tangled.repo.manifest/self', name: 'garden', repoDid: 'did:example:garden', url: 'https://tangled.org/you.example/garden', description: 'My little static site generator' }]),
    tangledIssues: () => Promise.resolve([
      { uri: 'at://did:example:garden/org.tangled.track.ticket/3iss1', cid: 'bafyexampleiss1', title: 'RSS feed skips drafts incorrectly', body: '' },
      { uri: 'at://did:example:garden/org.tangled.track.ticket/3iss2', cid: 'bafyexampleiss2', title: 'Add a sitemap.xml', body: '' }
    ]),
    gardenOf: did => pause(wateredBy(did, items())),
    knotlessRepos: () => Promise.resolve([{ uri: 'at://did:example:you/dev.knotless.repo/tally', name: 'tally', url: 'https://knotless.dev/you.example/tally', description: 'Adds up receipts' }]),
    knotlessIssues: () => Promise.resolve([
      { uri: 'at://did:example:you/dev.knotless.issue/3iss3', title: 'Dates in ISO 8601 are read as text', body: '' },
      { uri: 'at://did:example:you/dev.knotless.issue/3iss4', title: 'Totals round each line, not the sum', body: '' }
    ])
  };
}
