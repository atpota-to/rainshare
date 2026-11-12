// Building the four records from what people type, so every app writes the same shapes.
// Each builder trims, clips to the lexicon's limits and leaves out what's empty.
import { PROFILE, SEED, TAKE, DELIVERY, BUDGETS, FORECAST, CIRCUMSTANCES, PRIORITIES, PLANS, UNPAID, HARNESSES, RUNS_ON, AUDIENCES, TESTS, SIZES, OWNERS, STAGES, audienceOf } from './ns.js';
import { parseUri } from './net.js';
import { kindOf } from './subjects.js';

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

/** AI plans, known ones only. A paid plan means "none" and "free tiers only" no longer apply. */
export function plans(input){
  const k = [...new Set((Array.isArray(input) ? input : []).filter(p => known(PLANS, p)))], paid = k.filter(p => !UNPAID.includes(p));
  return paid.length ? paid : k.includes('free') ? ['free'] : k.includes('none') ? ['none'] : [];
}

/** A Rainshare profile. `prev` keeps its createdAt. */
export function profile(input = {}, prev){
  const f = input.forecast;
  return prune({
    $type: PROFILE,
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
    wants: prune({ models: strings(w.models, 6, 64), harnesses: strings(w.harnesses, 6, 64), tests: known(TESTS, w.tests), maxDiffLines: max > 0 ? max : undefined, notes: clip(w.notes || '', 1000) }),
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

export function take({ seed: sq, setup: s, note }){
  if (!sq?.uri || !sq?.cid) throw new Error('That seed can’t be found.');
  return prune({ $type: TAKE, seed: strongRef(sq), setup: setup(s), note: clip(note || '', 300), createdAt: now() });
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

export const HARNESS_NAMES = Object.fromEntries(HARNESSES);
