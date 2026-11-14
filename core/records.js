// Building the records from what people type, so every app writes the same shapes.
// Each builder trims, clips to the lexicon's limits and leaves out what's empty.
import { PROFILE, SEED, TAKE, DELIVERY, COMMENT, PREFERENCES, ROUTES, BUDGETS, FORECAST, CIRCUMSTANCES, PRIORITIES, PLANS, UNPAID, LEVELS, planKey, HARNESSES, RUNS_ON, AUDIENCES, TESTS, SIZES, OWNERS, STAGES, audienceOf } from './ns.js';
import { parseUri } from './net.js';
import { kindOf } from './subjects.js';
import { untilIn, MAX_DAYS } from './takes.js';

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
/** Clip to `max` graphemes (what people count as characters). */
export function clip(s, max){
  const t = String(s ?? '').trim();
  if (!seg) return t.slice(0, max);
  const parts = [...seg.segment(t)];
  return parts.length <= max ? t : parts.slice(0, max).map(p => p.segment).join('').trim();
}
const known = (list, v) => list.some(x => x[0] === v) ? v : undefined;
/** A tag the way it's stored: lower case, words joined by dashes. */
export const tag = s => clip(String(s || '').toLowerCase().replace(/^#/, '').replace(/[^\p{L}\p{N}+.#-]+/gu, '-').replace(/^-+|-+$/g, ''), 32);
const tags = (a, max) => [...new Set((Array.isArray(a) ? a : String(a || '').split(/[,\n]/)).map(tag).filter(Boolean))].slice(0, max);
const strings = (a, max, len) => [...new Set((Array.isArray(a) ? a : String(a || '').split(/[,\n]/)).map(s => clip(s, len)).filter(Boolean))].slice(0, max);
const httpUrl = s => { try { const u = new URL(String(s || '').trim()); return /^https?:$/.test(u.protocol) ? u.href : undefined; } catch (_) { return undefined; } };
const iso = d => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toISOString() : undefined; };
const prune = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)));
const now = () => new Date().toISOString();

export function setup(s){
  if (!s) return undefined;
  const harness = clip(s.harness || '', 64);
  if (!harness) return undefined;
  return prune({ harness, models: strings(s.models, 8, 64), plan: clip(s.plan || '', 64), runsOn: known(RUNS_ON, s.runsOn), note: clip(s.note || '', 300) });
}

/** AI plans, known ones only (a tier from before is kept as its provider). A paid plan means "none" and "free tiers only" no longer apply. */
export function plans(input){
  const k = [...new Set((Array.isArray(input) ? input : []).map(planKey).filter(p => known(PLANS, p)))], paid = k.filter(p => !UNPAID.includes(p));
  return paid.length ? paid : k.includes('free') ? ['free'] : k.includes('none') ? ['none'] : [];
}

/** A Rainshare profile. `prev` keeps its createdAt. */
export function profile(input = {}, prev){
  const f = input.forecast;
  return prune({
    $type: PROFILE,
    // Your name and bio come from your Bluesky profile; these say something else, on Rainshare only.
    displayName: clip(input.displayName || '', 64),
    bio: clip(input.bio || '', 300),
    plans: plans(input.plans),
    setups: (input.setups || []).map(setup).filter(Boolean).slice(0, 6),
    budget: known(BUDGETS, input.budget),
    forecast: f && known(FORECAST, f.level) ? prune({ level: f.level, models: strings(f.models, 8, 64), until: iso(f.until), note: clip(f.note || '', 300) }) : undefined,
    circumstances: (input.circumstances || []).filter(c => known(CIRCUMSTANCES, c)).slice(0, 8),
    values: tags(input.values, 12),
    priorities: (input.priorities || []).filter(p => known(PRIORITIES, p)).slice(0, 8),
    offering: tags(input.offering, 12),
    createdAt: prev?.createdAt || now(),
    updatedAt: now()
  });
}
// The fields someone can keep out of their public profile, sharing them only with their groups.
export const PRIVATE_FIELDS = ['budget', 'circumstances'];
/** The public copy: the profile without the fields marked private. */
export function publicProfile(full, hidden = []){
  const out = { ...full };
  for (const k of hidden) delete out[k];
  return out;
}

/** A seed. Throws with a plain message when something required is missing. */
export function seed(input = {}, prev){
  const title = clip(input.title || '', 120);
  if (!title) throw new Error('Give it a title.');
  // The audience comes as a word from a form or the CLI, or as the record's own audience when
  // a seed is saved again (closed, reopened, sprouted), which it must keep as it was.
  // Left out, it's open to everyone; a word nobody knows keeps it narrow.
  const said = input.audience && typeof input.audience === 'object' ? audienceOf(input) : input.audience;
  const list = input.list ?? input.audience?.list;
  const aud = input.group ? 'group' : said == null ? 'anyone' : known(AUDIENCES, said) || 'mutuals';
  if (aud === 'list' && !parseUri(list)) throw new Error('Pick the list it’s for.');
  const audience = { $type: `${SEED}#${aud}`, ...(aud === 'list' ? { list } : {}), ...(aud === 'group' ? { group: input.group } : {}) };
  const subject = input.subject && kindOf(input.subject) ? prune({ ...input.subject }) : undefined;
  const w = input.wants || {};
  const max = parseInt(w.maxDiffLines, 10);
  return prune({
    $type: SEED,
    title,
    subject,
    spec: clip(input.spec || '', 10000),
    specUrl: httpUrl(input.specUrl),
    // Which models: families and a level now (`models`, specific ones, is what older asks said).
    wants: prune({ families: tags(w.families, 8), level: known(LEVELS, w.level), models: strings(w.models, 6, 64), harnesses: strings(w.harnesses, 6, 64), tests: known(TESTS, w.tests), maxDiffLines: max > 0 ? max : undefined, notes: clip(w.notes || '', 1000) }),
    tags: tags(input.tags, 10),
    values: tags(input.values, 8),
    size: known(SIZES, input.size),
    stage: subject && input.stage !== 'seed' ? known(STAGES, input.stage) : undefined,   // with no repo it's a seed, and needn't say so
    owner: subject ? undefined : known(OWNERS, input.owner),   // only an idea with no repo needs to say whose the result will be
    audience,
    parallel: input.parallel ? true : undefined,
    state: input.state && input.state !== 'open' ? input.state : prev?.state && prev.state !== 'open' ? prev.state : undefined,
    sproutedWith: input.sproutedWith || prev?.sproutedWith,
    createdAt: prev?.createdAt || now(),
    updatedAt: prev ? now() : undefined
  });
}

export const strongRef = item => ({ uri: item.uri, cid: item.cid });

/** A take. `days`: how long the helper gives themselves to turn it in (its `until`; ./takes.js). */
export function take({ seed: sq, setup: s, note, days }){
  if (!sq?.uri || !sq?.cid) throw new Error('That seed can’t be found.');
  return prune({ $type: TAKE, seed: strongRef(sq), setup: setup(s), note: clip(note || '', 300), until: days ? untilIn(days) : undefined, createdAt: now() });
}
/**
 * The same take with more time: `days` past its day, or past now if that's gone by. Never
 * more than 30 days from now, the most a take can hold an ask (./takes.js).
 */
export function moreTime(prev, days){
  const t = Date.now(), from = Math.max(t, Date.parse(prev?.until) || 0);
  const until = new Date(Math.min(Date.parse(untilIn(days, from)), t + MAX_DAYS * 864e5)).toISOString();
  return prune({ ...prev, $type: TAKE, until, updatedAt: now() });
}

/** Your settings. `prev` keeps its createdAt, and anything not being changed. */
export function preferences(input = {}, prev){
  const was = prev?.send || {}, s = { ...was, ...(input.send || {}) };
  const days = Math.round(Number(s.days));
  return prune({
    $type: PREFERENCES,
    send: prune({
      route: known(ROUTES, s.route),
      claim: typeof s.claim === 'boolean' ? s.claim : undefined,
      days: days >= 1 ? Math.min(days, MAX_DAYS) : undefined,
      askEachTime: typeof s.askEachTime === 'boolean' ? s.askEachTime : undefined
    }),
    createdAt: prev?.createdAt || now(),
    updatedAt: prev ? now() : undefined
  });
}

export function delivery({ seed: sq, take: tk, url, pull, setup: s, sessionUrl, note }){
  if (!sq?.uri || !sq?.cid) throw new Error('That seed can’t be found.');
  const link = httpUrl(url), at = parseUri(pull) ? pull : undefined;
  if (!link && !at) throw new Error('Add the link to your pull request.');
  return prune({
    $type: DELIVERY, seed: strongRef(sq), take: tk?.uri && tk?.cid ? strongRef(tk) : undefined,
    url: link, pull: at, setup: setup(s), sessionUrl: httpUrl(sessionUrl), note: clip(note || '', 300), createdAt: now()
  });
}

/**
 * A comment on a seed, or a reply to one of its comments (`parent`). A reply has to be about
 * the same seed as the comment it answers.
 */
export function comment({ seed: sq, parent, text }){
  if (!sq?.uri || !sq?.cid) throw new Error('That seed can’t be found.');
  if (parent && (!parent.uri || !parent.cid || parent.value?.seed?.uri !== sq.uri)) throw new Error('That comment isn’t on this one.');
  const said = clip(text || '', 3000);
  if (!said) throw new Error('Write something first.');
  return prune({ $type: COMMENT, seed: strongRef(sq), parent: parent ? strongRef(parent) : undefined, text: said, createdAt: now() });
}

export const HARNESS_NAMES = Object.fromEntries(HARNESSES);
