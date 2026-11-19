// Putting a helper's board in order: who they'd like to help first, what their setup can
// do, and how close they are to whoever asked. Each item says why it's where it is: as
// short reasons (for the CLI), and as a fit level with one plain sentence (for the apps).
import { FEATURES, PLANS, LEVELS, plansIn, planFamilies, familyOf, familyName, levelWord, lowBudgetOf, labelOf, BUDGETS, modelName } from './ns.js';
import { activeTakes } from './takes.js';

const has = (a, v) => Array.isArray(a) && a.includes(v);
const lower = a => (a || []).map(s => String(s).toLowerCase());
const short = m => String(m).replace(/^claude-/, '').replace(/-\d+(-\d+)*$/, '');
/** A value the way people write it: "open source", "mutual aid" (but "local-first"). */
export const pretty = v => String(v) === 'local-first' ? 'local-first' : String(v).replace(/-/g, ' ');
const cap = s => s[0].toUpperCase() + s.slice(1);
/** "a", "a and b", "a, b and c" (or "or"). */
export const join = (parts, word = 'and') => parts.length <= 2 ? parts.join(` ${word} `) : `${parts.slice(0, -1).join(', ')} ${word} ${parts.at(-1)}`;

/** The models a helper can bring: from their setups and their current forecast. */
export function modelsOf(profile){
  return [...new Set(lower([...(profile?.setups || []).flatMap(s => s.models || []), ...(profile?.forecast?.models || [])]))];
}
// A wanted model matches one you have when either names the other ("opus" matches claude-opus-5-5).
export const modelMatch = (want, have) => have.some(h => h === want || h.includes(want) || want.includes(h));
/**
 * What an ask would like, model-wise: { families, level, models }. An ask says families
 * ('claude', 'gpt'…) and a level ('frontier', 'mid', 'small', or null for any). An older one named models
 * (`models`), and their families count as its families.
 */
export function wantedOf(sq){
  const w = sq?.wants || {}, models = words(w.models, 64);
  return { families: [...new Set([...words(w.families, 32), ...models.map(familyOf).filter(Boolean)])], level: LEVELS.some(l => l[0] === w.level) ? w.level : null, models };
}
// What someone else's record lists, as it's safe to show and to put in a brief: strings only, each
// on one line and clipped, lower case. (A record can say anything: a string, numbers, line breaks.)
const words = (a, max) => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x === 'string').map(x => x.replace(/\s+/g, ' ').trim().slice(0, max).toLowerCase()).filter(Boolean))].slice(0, 8);
/** That in words, or '' for any model at all: "a frontier Claude model", "Claude or GPT", "Opus or Sonnet", "a small model". */
export function wantPhrase(sq){
  const { families, level, models } = wantedOf(sq);
  if (models.length) return join(models.map(modelName), 'or');
  if (!families.length) return level ? `a ${levelWord(level)} model` : '';
  const names = join(families.map(familyName), 'or');
  return level ? `a ${levelWord(level)} ${names} model` : names;
}
/** A plan as it's said after "your": "Claude plan", "Z.ai GLM plan". */
const yourPlan = n => /\bplan\b/i.test(n) ? n : n + ' plan';
/**
 * What someone brings to what an ask would like (wantedOf):
 *   run    a model they run that fits: the very one an older ask named, or one of a family it
 *          would like ("Sonnet"), or null. How capable it is is theirs to judge.
 *   exact  whether `run` is the very model asked for
 *   plan   else, a plan of theirs that reaches one of the families: { name, families: ['Claude'] }, or null
 *   said   whether their profile says enough to tell: models they run, or a plan that reaches a family
 */
export function modelReach(want, profile){
  const have = modelsOf(profile), plans = plansIn(profile);
  const exact = want.models.find(w => modelMatch(w, have)) || null;
  const fits = exact ? null : have.find(h => want.families.includes(familyOf(h))) || null;
  const by = exact || fits ? null : plans.find(p => planFamilies(p).some(f => want.families.includes(f)));
  return {
    run: exact || fits ? modelName(exact || fits) : null, exact: !!exact,
    plan: by ? { name: yourPlan(labelOf(PLANS, by)), families: want.families.filter(f => planFamilies(by).includes(f)).map(familyName) } : null,
    said: have.length > 0 || plans.some(p => planFamilies(p).length)
  };
}

/**
 * Score one item for a helper. `item` carries the seed (`value`), its author's profile
 * (`profile`, the fullest copy the helper can read), how close they are (`closeness`), and
 * its takes. Returns { score, reasons: [{ text, say, tone, about }] }: `text` is a short
 * label, tone is 'up', 'match' or 'down', and `say` is how fit() words it: about 'them' (the
 * asker) finishes a sentence that starts with their name; about 'job' is a sentence itself.
 * Who the helper would like to help first, what they care about, and the asker's situation
 * count only while those are on (FEATURES in ./ns.js), or when `priorities`, `values` or
 * `circumstances` says so.
 */
export function score(item, me, { priorities = FEATURES.priorities, values = FEATURES.values, circumstances = FEATURES.circumstances } = {}){
  const sq = item.value || {}, them = item.profile || {}, mine = me?.profile || {};
  const pr = priorities ? mine.priorities || [] : [], reasons = [];
  const add = (text, say, tone, about = 'them') => reasons.push({ text, say, tone, about });
  let s = { self: 0, group: 3, mutual: 3, 'follows-you': 2, 'you-follow': 1 }[item.closeness] ?? 0;
  if (has(pr, 'friends-first') && (item.closeness === 'mutual' || item.closeness === 'group')) { s += 2; add('Close friend', 'is a close friend', 'up'); }

  const low = lowBudgetOf(them);
  if (low) {
    s += has(pr, 'low-budget') ? 4 : 1;
    const [text, say] = { none: ['No AI plan', 'has no AI plan'], free: ['Free tiers only', 'is on free tiers'], low: ['Small AI budget', 'is on a small AI budget'] }[low];
    add(text, say, has(pr, 'low-budget') ? 'up' : 'match');
  }
  const c = circumstances && Array.isArray(them.circumstances) ? them.circumstances : [];
  if (has(c, 'student')) { s += has(pr, 'students') ? 4 : 1; add('Student', 'is a student', has(pr, 'students') ? 'up' : 'match'); }
  if (has(c, 'low-income') || has(c, 'between-jobs')) {
    s += has(pr, 'low-income') ? 4 : 1;
    add(has(c, 'between-jobs') ? 'Between jobs' : 'Low income', has(c, 'between-jobs') ? 'is between jobs' : 'is on a low income', has(pr, 'low-income') ? 'up' : 'match');
  }
  if (has(c, 'learning')) { s += has(pr, 'newcomers') ? 3 : 0; add('Learning to code', 'is learning to code', has(pr, 'newcomers') ? 'up' : 'match'); }
  if (has(c, 'nonprofit')) { s += has(pr, 'nonprofits') ? 3 : 0; add('Community project', 'runs a community project', has(pr, 'nonprofits') ? 'up' : 'match'); }
  if (has(c, 'oss-maintainer')) { s += has(pr, 'maintainers') ? 2 : 0; if (has(pr, 'maintainers')) add('Maintainer', 'maintains open source', 'up'); }

  const shared = !values ? [] : [...new Set([...lower(them.values), ...lower(sq.values)])].filter(v => lower(mine.values).includes(v));
  if (shared.length) {
    s += Math.min(shared.length, 3) * (has(pr, 'values-aligned') ? 2 : 1);
    add('Shares ' + shared.slice(0, 3).join(', '), `cares about ${join(shared.slice(0, 3).map(pretty))} too`, has(pr, 'values-aligned') ? 'up' : 'match');
  }

  // The models it'd like (families, or an older ask's models), against what you run and your plans.
  const want = wantedOf(sq), phrase = wantPhrase(sq), reach = want.families.length ? modelReach(want, mine) : null;
  if (reach?.run) { s += 2; add(`Wants ${phrase}: you run ${reach.run}`, reach.exact ? `They’d like ${phrase}, which you have` : `They’d like ${phrase}, and you run ${reach.run}`, 'match', 'job'); }
  else if (reach?.plan) { s += 1; add(`Wants ${phrase}: your ${reach.plan.name} has ${join(reach.plan.families)} models`, `They’d like ${phrase}, and your ${reach.plan.name} has ${join(reach.plan.families)} models`, 'match', 'job'); }
  else if (reach?.said) { s -= 2; add(`Wants ${phrase}`, `they’d like ${phrase}, which isn’t in your plan or setup`, 'down', 'job'); }
  const skills = lower(mine.offering), fits = lower(sq.tags).filter(t => skills.includes(t));
  if (fits.length) { s += Math.min(fits.length, 2); add('Your kind of work: ' + fits.slice(0, 2).join(', '), `It’s ${join(fits.slice(0, 2))}, your kind of work`, 'match', 'job'); }

  const taken = activeTakes(item).filter(t => t.repo !== me?.did);
  if (taken.length && !sq.parallel) { s -= 3; add('Someone’s on it', 'someone’s already on it', 'down', 'job'); }
  const days = (Date.now() - Date.parse(sq.createdAt || 0)) / 864e5;
  if (days >= 0 && days < 3) s += 1;
  return { score: s, reasons };
}

export const FIT = { 3: 'Strong fit', 2: 'Good fit', 1: 'Some fit' };
/**
 * How well a seed suits a helper: a level from 1 to 3, its label, and a few short
 * sentences that say why ("Priya has no AI plan and is between jobs. They’d like Sonnet,
 * which you have. Heads up: someone’s already on it.").
 */
export function fit(item, me, opts){
  const { score: s, reasons } = score(item, me, opts);
  const level = s >= 12 ? 3 : s >= 6 ? 2 : 1;
  const name = String(item.author?.displayName || '').trim().split(/\s+/)[0] || (item.author?.handle ? '@' + item.author.handle : 'They');
  const ups = reasons.filter(r => r.tone !== 'down');
  const them = ups.filter(r => r.about === 'them').map(r => r.say), job = ups.filter(r => r.about === 'job').map(r => r.say);
  const downs = reasons.filter(r => r.tone === 'down').map(r => r.say);
  if (!them.length) { const c = { mutual: 'is a mutual', group: 'is in your group', 'follows-you': 'follows you' }[item.closeness]; if (c) them.push(c); }
  const out = [them.length ? `${name} ${join(them)}.` : '', ...job.map(j => j + '.')].filter(Boolean);
  if (!out.length) out.push(item.closeness ? 'It’s from your circle.' : 'It’s open to everyone.');
  if (downs.length) out.push(`Heads up: ${downs[0]}.`, ...downs.slice(1).map(d => cap(d) + '.'));
  return { level, label: FIT[level], why: out.join(' '), score: s, reasons };
}

/** The board in order for this helper, best first, each with its fit. */
export function rank(items, me, opts){
  return items.map(it => ({ ...it, ...score(it, me, opts), fit: fit(it, me, opts) })).sort((a, b) => b.score - a.score || String(b.value?.createdAt).localeCompare(String(a.value?.createdAt)));
}

/**
 * The ways the board can be put in order, each with a few words for when you rest on it. The
 * first two need someone signed in and fit switched on (FEATURES.fit in ./ns.js), since they
 * lean on what suits you.
 *   suggested  newest first, but what suits you less comes after the rest (lesser)
 *   fit        best for you first (rank)
 *   new        newest first, and nothing else
 *   old        what's been waiting longest first
 */
export const SORTS = [
  ['suggested', 'Suggested', 'Newest first, with the ones that suit you less further down: someone’s already on it, something’s been turned in, or it would like a model you don’t have.', true],
  ['fit', 'Best for you', 'How well each one suits you, best first: who asked, what they’d like, and what you run.', true],
  ['new', 'Newest', 'Newest first, and nothing else.', false],
  ['old', 'Waiting longest', 'The ones that have been open longest first.', false]
];
/** The sorts there are for someone signed in or not, and the one used until they pick another. */
export const sortsFor = (signedIn, fit = FEATURES.fit) => SORTS.filter(s => !s[3] || (signedIn && fit));
export const defaultSort = (signedIn, fit = FEATURES.fit) => signedIn && fit ? 'suggested' : 'new';
const byNewest = (a, b) => String(b.value?.createdAt).localeCompare(String(a.value?.createdAt));
/**
 * Whether an ask suits a helper less than the rest, for the suggested order: its fit says to
 * mind something (someone's on it, or it'd like a model they don't have), or something's been
 * turned in for it already and it doesn't want more than one helper. `item` is one from rank().
 */
export const lesser = item => (item.reasons || []).some(r => r.tone === 'down') || (!item.value?.parallel && (item.deliveries || []).length > 0);
/**
 * The open board in order. Signed in (`me.did`), what someone else asked for comes first (with
 * its fit, while fit is on) and your own asks after it, in the same order, since the board is for
 * helping someone else. Then, unless it's sorted by what's waiting longest, whatever `isNew`
 * says is new (what's come in since you last looked) is moved to the top, in the same order
 * among itself. Returns { items, fresh, sort }, where `fresh` is how many at the top are new
 * and `sort` the order used (an unknown or unavailable one falls back to the usual one).
 */
export function boardOrder(open, me, { sort, isNew = () => false, fit = FEATURES.fit } = {}){
  const signedIn = !!me?.did, how = sortsFor(signedIn, fit).some(s => s[0] === sort) ? sort : defaultSort(signedIn, fit);
  const byDate = list => how === 'old' ? [...list].sort(byNewest).reverse() : [...list].sort(byNewest);
  let items;
  if (!signedIn) items = byDate(open);
  else {
    const others = open.filter(it => it.repo !== me.did), mine = byDate(open.filter(it => it.repo === me.did));
    const ranked = fit ? rank(others, me) : others;
    items = how === 'fit' ? [...ranked, ...mine]
      : how === 'suggested' ? [...byDate(ranked.filter(it => !lesser(it))), ...byDate(ranked.filter(lesser)), ...mine]
        : [...byDate(ranked), ...mine];
  }
  const fresh = how === 'old' ? [] : items.filter(it => it.repo !== me?.did && isNew(it));
  if (!fresh.length) return { items, fresh: 0, sort: how };
  return { items: [...fresh, ...items.filter(it => !fresh.includes(it))], fresh: fresh.length, sort: how };
}

export const budgetLabel = b => labelOf(BUDGETS, b);
