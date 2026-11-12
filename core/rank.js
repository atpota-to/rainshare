// Putting a helper's board in order: who they'd like to help first, what their setup can
// do, and how close they are to whoever asked. Each item says why it's where it is: as
// short reasons (for the CLI), and as a fit level with one plain sentence (for the apps).
import { FEATURES, lowBudgetOf, labelOf, BUDGETS, modelName } from './ns.js';

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
 * Score one item for a helper. `item` carries the seed (`value`), its author's profile
 * (`profile`, the fullest copy the helper can read), how close they are (`closeness`), and
 * its takes. Returns { score, reasons: [{ text, say, tone, about }] }: `text` is a short
 * label, tone is 'up', 'match' or 'down', and `say` is how fit() words it: about 'them' (the
 * asker) finishes a sentence that starts with their name; about 'job' is a sentence itself.
 * Who the helper would like to help first counts only while that's on (FEATURES in ./ns.js),
 * or when `priorities` says so.
 */
export function score(item, me, { priorities = FEATURES.priorities } = {}){
  const sq = item.value || {}, them = item.profile || {}, mine = me?.profile || {};
  const pr = priorities ? mine.priorities || [] : [], reasons = [];
  const add = (text, say, tone, about = 'them') => reasons.push({ text, say, tone, about });
  let s = { self: 0, group: 3, mutual: 3, 'follows-you': 2, 'you-follow': 1 }[item.closeness] ?? 0;
  if (has(pr, 'friends-first') && (item.closeness === 'mutual' || item.closeness === 'group')) { s += 2; add('Close friend', 'is a close friend', 'up'); }

  const low = lowBudgetOf(them);
  if (low) {
    s += has(pr, 'low-budget') ? 4 : 1;
    const [text, say] = { none: ['No paid AI', 'has no paid AI'], free: ['Free tiers only', 'is on free tiers'], low: ['Small AI budget', 'is on a small AI budget'] }[low];
    add(text, say, has(pr, 'low-budget') ? 'up' : 'match');
  }
  const c = them.circumstances || [];
  if (has(c, 'student')) { s += has(pr, 'students') ? 4 : 1; add('Student', 'is a student', has(pr, 'students') ? 'up' : 'match'); }
  if (has(c, 'low-income') || has(c, 'between-jobs')) {
    s += has(pr, 'low-income') ? 4 : 1;
    add(has(c, 'between-jobs') ? 'Between jobs' : 'Low income', has(c, 'between-jobs') ? 'is between jobs' : 'is on a low income', has(pr, 'low-income') ? 'up' : 'match');
  }
  if (has(c, 'learning')) { s += has(pr, 'newcomers') ? 3 : 0; add('Learning to code', 'is learning to code', has(pr, 'newcomers') ? 'up' : 'match'); }
  if (has(c, 'nonprofit')) { s += has(pr, 'nonprofits') ? 3 : 0; add('Community project', 'runs a community project', has(pr, 'nonprofits') ? 'up' : 'match'); }
  if (has(c, 'oss-maintainer')) { s += has(pr, 'maintainers') ? 2 : 0; if (has(pr, 'maintainers')) add('Maintainer', 'maintains open source', 'up'); }

  const shared = [...new Set([...lower(them.values), ...lower(sq.values)])].filter(v => lower(mine.values).includes(v));
  if (shared.length) {
    s += Math.min(shared.length, 3) * (has(pr, 'values-aligned') ? 2 : 1);
    add('Shares ' + shared.slice(0, 3).join(', '), `cares about ${join(shared.slice(0, 3).map(pretty))} too`, has(pr, 'values-aligned') ? 'up' : 'match');
  }

  const want = lower(sq.wants?.models), have = modelsOf(mine);
  if (want.length && have.length) {
    const hit = want.find(w => modelMatch(w, have));
    if (hit) { s += 2; add(`Wants ${short(hit)}: you have it`, `It’d like ${modelName(hit)}, which you have`, 'match', 'job'); }
    else { s -= 2; add(`Wants ${want.map(short).join(' or ')}`, `they’d like ${join(want.map(modelName), 'or')}, which isn’t in your setup`, 'down', 'job'); }
  }
  const skills = lower(mine.offering), fits = lower(sq.tags).filter(t => skills.includes(t));
  if (fits.length) { s += Math.min(fits.length, 2); add('Your kind of work: ' + fits.slice(0, 2).join(', '), `It’s ${join(fits.slice(0, 2))}, your kind of work`, 'match', 'job'); }

  const taken = (item.takes || []).filter(t => t.repo !== me?.did);
  if (taken.length && !sq.parallel) { s -= 3; add('Someone’s on it', 'someone’s already on it', 'down', 'job'); }
  const days = (Date.now() - Date.parse(sq.createdAt || 0)) / 864e5;
  if (days >= 0 && days < 3) s += 1;
  return { score: s, reasons };
}

export const FIT = { 3: 'Strong fit', 2: 'Good fit', 1: 'Some fit' };
/**
 * How well a seed suits a helper: a level from 1 to 3, its label, and a few short
 * sentences that say why ("Priya has no paid AI and is between jobs. It’d like Sonnet,
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

export const budgetLabel = b => labelOf(BUDGETS, b);
