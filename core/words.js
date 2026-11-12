// An ask in plain words, for the board's details and its own page: where the
// work is, how big the job is, what the asker would like, and who's on it. Each is a short
// line of text, so nothing needs a coloured chip.
import { labelOf, SIZES, HARNESSES, audienceOf, modelName } from './ns.js';
import { describeSubject, kindOf, FORGE_NAMES } from './subjects.js';
import { join, modelsOf, modelMatch } from './rank.js';
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

/** "Opus or Sonnet (you have Sonnet). No new dependencies, please." */
export function wantsText(sq, myProfile){
  const w = sq?.wants || {}, out = [];
  if (w.models?.length) {
    const have = modelsOf(myProfile || {}), hit = w.models.find(m => modelMatch(String(m).toLowerCase(), have));
    const names = w.models.map(modelName);
    out.push(hit && myProfile ? (names.length === 1 ? `${names[0]}, which you have.` : `${join(names, 'or')} (you have ${modelName(hit)}).`) : join(names, 'or') + '.');
  }
  if (w.harnesses?.length) out.push(`Made with ${join(w.harnesses.map(harnessName), 'or')}.`);
  if (w.notes) out.push(String(w.notes).trim().replace(/([^.!?])$/, '$1.'));
  return out.join(' ') || 'Nothing in particular.';
}
/** "wants Opus or Sonnet", for a one-line summary. */
export const wantsShort = sq => sq?.wants?.models?.length ? 'wants ' + join(sq.wants.models.map(modelName), 'or') : '';

/** "Nobody yet", "Kai, with Claude Code", "You". Deliveries are added: "Kai turned it in". */
export function onItText(item, viewer){
  const takes = (item?.takes || []).map(t => (t.repo === viewer ? 'You' : firstName(t.author)) + (t.value?.setup?.harness ? `, with ${harnessName(t.value.setup.harness)}` : ''));
  const turned = (item?.deliveries || []).map(d => d.repo === viewer ? 'you' : firstName(d.author));
  const parts = [];
  if (takes.length) parts.push(takes.join('; '));
  if (turned.length) parts.push(`${join([...new Set(turned)])} turned it in`);
  return parts.join('. ') || 'Nobody yet';
}
/** "Kai’s on it", "You’re on it", "2 helpers on it", or "". */
export function takenShort(item, viewer){
  const t = item?.takes || [];
  if (!t.length) return '';
  if (t.length > 1) return `${t.length} helpers on it`;
  return t[0].repo === viewer ? 'You’re on it' : `${firstName(t[0].author)}’s on it`;
}

/** How the asker relates to you: "mutual", "follows you", "Spine Club", "open to everyone". */
export function relationText(item, viewer){
  if (viewer && item?.repo === viewer) return 'you';
  if (item?.space) return item.group?.name || 'private';
  // A follow on Bluesky or on Tangled counts here (./ties.js); without ties, Bluesky's alone.
  return { ...TIE_SHORT, group: item.group?.name || 'your group' }[tieOf(item?.ties) || item?.closeness]
    || (audienceOf(item?.value) === 'anyone' ? 'open to everyone' : '');
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
