// An ask in plain words, for the board's details and its own page: where the
// work is, how big the job is, what the asker would like, and who's on it. Each is a short
// line of text. Where it stands (progressOf) is also a single word, which the screens colour,
// so whether anyone's on it, or it's done, can be told at a glance.
import { labelOf, SIZES, HARNESSES, PLANS, UNPAID, plansIn, audienceOf, modelName } from './ns.js';
import { describeSubject, kindOf, FORGE_NAMES, pullPageOf, pullNumber } from './subjects.js';
import { join, modelReach, wantedOf, wantPhrase } from './rank.js';
import { tieOf, TIE_SHORT } from './ties.js';

const firstName = p => String(p?.displayName || '').trim().split(/\s+/)[0] || (p?.handle ? '@' + p.handle : 'Someone');
const harnessName = h => labelOf(HARNESSES, h);

/** Which of the four it is: 'seed' (an idea, no repo), 'seedling', 'young' or 'established'. One with a repo that doesn't say is drawn as a young plant. */
export const stageOf = sq => !describeSubject(sq?.subject) ? 'seed' : ['seedling', 'young', 'established'].includes(sq?.stage) ? sq.stage : 'young';
/** What to call it: an "idea" (no repo yet) or a "project". The plant it's drawn as says how far along. */
export const nounOf = sq => !describeSubject(sq?.subject) ? 'idea' : 'project';
/** What it is, for the line under its title: { name: 'Idea' | 'Project', note }. */
export function whatItIs(sq){
  const st = stageOf(sq);
  return st === 'seed' ? { name: 'Idea', note: 'Nothing’s been built yet.' } : {
    name: 'Project',
    note: { seedling: 'Just started: there’s a repo and a first sketch.', young: 'It works, and it’s still taking shape.', established: 'Established: people use it and rely on it.' }[st]
  };
}
/** Which plant to draw for it: its own stage, or the next one on once it has sprouted (a seed that sprouted is a seedling now). */
export const pictureOf = sq => { const st = stageOf(sq); return sq?.state === 'sprouted' ? { seed: 'seedling', seedling: 'young', young: 'established' }[st] || st : st; };
/** The same with its article: "an idea", "a project". */
export const aNoun = sq => { const n = nounOf(sq); return (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n; };

/** "GitHub issue #14, example/flashdeck", "Tangled, kai.example/almanac", or for an idea "No repo yet". */
export function whereText(sq){
  const s = sq?.subject, d = describeSubject(s);
  if (!d) return sq?.owner === 'helper' ? 'No repo: an idea to run with' : 'No repo yet';
  const forge = FORGE_NAMES[d.forge] || 'Git';
  if (kindOf(s) === 'githubIssue') return `${forge} issue #${parseInt(s.number, 10) || ''}${d.repo ? ', ' + d.repo : ''}`;
  if (kindOf(s) === 'knotlessIssue') return `${forge} issue${d.repo ? ', ' + d.repo : ''}`;
  if (kindOf(s) === 'tangledIssue') {
    const n = (String(s.url || '').match(/\/issues\/(\d+)(?:[/?#]|$)/) || [])[1];
    return `${forge} issue${n ? ' #' + n : ''}${d.repo ? ', ' + d.repo : ''}`;
  }
  return `${forge}, ${d.label}`;
}
/** The short form, for a line on a card: "GitHub #14", "Tangled", "Codeberg". */
export function shortWhere(sq){
  const s = sq?.subject, d = describeSubject(s);
  if (!d) return sq?.owner === 'helper' ? 'An idea to run with' : 'An idea';
  const forge = FORGE_NAMES[d.forge] || 'Git';
  const n = kindOf(s) === 'githubIssue' ? parseInt(s.number, 10) : (String(s.url || '').match(/\/issues\/(\d+)(?:[/?#]|$)/) || [])[1];
  return n ? `${forge} #${n}` : forge;
}

/** "Small. Tests required. Under about 200 lines." */
export function jobText(sq){
  const w = sq?.wants || {}, out = [];
  if (sq?.size) out.push(labelOf(SIZES, sq.size) + '.');
  if (w.tests) out.push({ required: 'Tests required.', welcome: 'Tests welcome.', none: 'No tests needed.' }[w.tests] || '');
  if (w.maxDiffLines) out.push(`Under about ${w.maxDiffLines} lines.`);
  if (sq?.parallel) out.push('More than one helper can try.');
  return out.filter(Boolean).join(' ') || 'Not said.';
}
/** "small job, tests required", for a one-line summary. */
export function jobShort(sq){
  const w = sq?.wants || {};
  return [sq?.size ? `${sq.size} job` : '', { required: 'tests required', welcome: 'tests welcome', none: 'no tests needed' }[w.tests] || ''].filter(Boolean).join(', ');
}

/**
 * The models an ask would like, and how they fit yours (`myProfile`, left out for the asker):
 * "A frontier Claude model. You run Sonnet." "Claude or GPT. Your Claude plan has Claude
 * models." "GLM. Not in your plan or setup." "Any model."
 */
export function modelsText(sq, myProfile){
  const want = wantedOf(sq), phrase = wantPhrase(sq);
  if (!phrase) return 'Any model.';
  const lead = phrase[0].toUpperCase() + phrase.slice(1) + '.', r = want.families.length && myProfile ? modelReach(want, myProfile) : null;
  if (r?.run) return `${lead} You run ${r.run}.`;
  if (r?.plan) return `${lead} Your ${r.plan.name} has ${join(r.plan.families)} models.`;
  return r?.said ? `${lead} Not in your plan or setup.` : lead;
}
/** Anything else they asked for, in their words: "Made with Claude Code. No new dependencies." */
export function notesText(sq){
  const w = sq?.wants || {}, out = [];
  if (w.harnesses?.length) out.push(`Made with ${join(w.harnesses.map(harnessName), 'or')}.`);
  if (w.notes) out.push(String(w.notes).trim().replace(/([^.!?])$/, '$1.'));
  return out.join(' ');
}
/** The job, then their notes: "Small. Tests required. No new dependencies." */
export const jobAndNotes = sq => { const j = jobText(sq), n = notesText(sq); return n ? (j === 'Not said.' ? n : `${j} ${n}`) : j; };
/** "wants a frontier Claude model", for a one-line summary. */
export const wantsShort = sq => { const p = wantPhrase(sq); return p ? 'wants ' + p : ''; };

/**
 * Where an ask is, in a word, and who's helping with it, so it can be told at a glance:
 *
 *   key      'open' (nobody's on it), 'on-it', 'turned-in', 'done' or 'closed'
 *   label    "Open", "In progress", "Turned in", "Done", "Closed"
 *   idea     whether it's an idea with no repo yet (what's turned in is where it lives, not a pull request)
 *   helpers  everyone who said they're on it or turned something in, once each:
 *            [{ did, author, mine, took, turnedIn, didIt, setup, note, pulls }]
 *            (`took` and `turnedIn` are when, or null; `didIt`: the asker marked it done with their work)
 *            Whoever did it comes first, then whoever turned something in, then the rest, earliest first.
 *   pulls    what's been turned in, newest first: [{ uri, link, number, state, didIt, did }]
 *            (`link` is a page to open, or null; `state` is what the forge said, once it's been asked:
 *            'open', 'merged', 'closed', or null)
 */
export const PROGRESS = { open: 'Open', 'on-it': 'In progress', 'turned-in': 'Turned in', done: 'Done', closed: 'Closed' };
export function progressOf(item, viewer){
  const sq = item?.value || {}, takes = item?.takes || [], deliveries = item?.deliveries || [];
  const key = sq.state === 'closed' ? 'closed' : sq.state === 'sprouted' ? 'done' : deliveries.length ? 'turned-in' : takes.length ? 'on-it' : 'open';
  const accepted = new Set((sq.sproutedWith || []).map(r => r.uri)), by = new Map();
  const of = r => {
    if (!by.has(r.repo)) by.set(r.repo, { did: r.repo, author: r.author || { did: r.repo }, mine: !!viewer && r.repo === viewer, took: null, turnedIn: null, didIt: false, setup: null, note: '', pulls: [] });
    return by.get(r.repo);
  };
  const earliest = (a, b) => !a ? b : !b ? a : String(a) < String(b) ? a : b;
  const latest = (a, b) => !a ? b : !b ? a : String(a) > String(b) ? a : b;
  for (const t of takes) { const h = of(t); h.took = earliest(h.took, t.value?.createdAt || null); h.setup ||= t.value?.setup || null; h.note ||= t.value?.note || ''; }
  const pulls = [];
  // (Oldest first, so the setup said with the latest turn-in is the one shown: it's what did the work.)
  for (const d of [...deliveries].sort((a, b) => String(a.value?.createdAt || '').localeCompare(String(b.value?.createdAt || '')))) {
    const h = of(d), link = pullPageOf(d.value, sq.subject) || null;
    const pull = { uri: d.uri, link, number: pullNumber(link), state: d.state || null, didIt: accepted.has(d.uri), did: d.repo };
    h.turnedIn = latest(h.turnedIn, d.value?.createdAt || null); h.setup = d.value?.setup || h.setup; h.didIt ||= pull.didIt;
    h.pulls.unshift(pull); pulls.unshift(pull);
  }
  const rank = h => h.didIt ? 0 : h.turnedIn ? 1 : 2, when = h => String(h.took || h.turnedIn || '');
  const helpers = [...by.values()].sort((a, b) => rank(a) - rank(b) || when(a).localeCompare(when(b)));
  return { key, label: PROGRESS[key], idea: !describeSubject(sq.subject), helpers, pulls };
}
/**
 * The same in a few words, for a card: "Kai’s on it", "You’re on it", "2 helpers on it",
 * "Kai’s pull request", "Your pull request", "2 pull requests" (for an idea, "Kai turned it
 * in", "Turned in by 2"), "Kai did it", or "" when nobody's helped.
 */
export function progressShort(item, viewer){
  const { key, idea, helpers, pulls } = progressOf(item, viewer);
  const one = h => h.mine ? 'You' : firstName(h.author);
  if (key === 'on-it') return helpers.length > 1 ? `${helpers.length} helpers on it` : helpers[0].mine ? 'You’re on it' : `${one(helpers[0])}’s on it`;
  if (key === 'turned-in') {
    const t = helpers.filter(h => h.turnedIn);
    if (idea) return t.length > 1 ? `Turned in by ${t.length}` : `${one(t[0])} turned it in`;
    return pulls.length > 1 ? `${pulls.length} pull requests` : t[0].mine ? 'Your pull request' : `${firstName(t[0].author)}’s pull request`;
  }
  if (key === 'done') { const d = helpers.filter(h => h.didIt); return d.length === 1 ? `${one(d[0])} did it` : d.length > 1 ? `${d.length} helpers did it` : ''; }
  return '';
}

/**
 * Someone's AI plan as one line: "Claude and Copilot", "No AI plan". An older
 * profile without plans says it with the plan typed into its setups, or with its budget when
 * that said none or free (a budget's spending brackets aren't subscriptions). '' when they
 * haven't said. (A plan nobody knows is shown as written, clipped.)
 */
export function planText(p){
  const plans = plansIn(p);
  if (plans.length) return join([...new Set(plans.map(x => String(labelOf(PLANS, x)).slice(0, 40)))]);
  const typed = [...new Set((p?.setups || []).map(x => typeof x?.plan === 'string' ? x.plan.trim().slice(0, 64) : '').filter(Boolean))];
  if (typed.length) return join(typed.slice(0, 3));
  return UNPAID.includes(p?.budget) ? labelOf(PLANS, p.budget) : '';
}

/**
 * How the asker relates to you: "mutual", "follows you", "Spine Club", "open to everyone".
 * With `audience: false`, who it's open to isn't said when there's no tie (a card leaves it out).
 */
export function relationText(item, viewer, { audience = true } = {}){
  if (viewer && item?.repo === viewer) return 'you';
  if (item?.space) return item.group?.name || 'private';
  // A follow on Bluesky or on Tangled counts here (./ties.js); without ties, Bluesky's alone.
  return { ...TIE_SHORT, group: item.group?.name || 'your group' }[tieOf(item?.ties) || item?.closeness]
    || (audience && audienceOf(item?.value) === 'anyone' ? 'open to everyone' : '');
}

/** The spec as a short plain-text excerpt, without its Markdown. Lines and list items become sentences. */
export function askExcerpt(spec, max = 260){
  const lines = String(spec || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\n+/)
    // A heading, or a line that's all bold, introduces what follows it.
    .map(l => /^\s*(#{1,6}\s|\*\*[^*]+\*\*\s*$|__[^_]+__\s*$)/.test(l) && !/[.!?:]\W*$/.test(l) ? l.replace(/\s*$/, ':') : l)
    .map(l => l
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>]/g, '')
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const t = lines.reduce((out, l) => !out ? l : out + (/[.!?:;,…]$/.test(out) ? ' ' : '. ') + l, '');
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// "sprouted" is the record's word for done; people read "Done", beside a sprouted plant.
export const stateText = sq => sq?.state === 'sprouted' ? 'Done' : sq?.state === 'closed' ? 'Closed' : '';
