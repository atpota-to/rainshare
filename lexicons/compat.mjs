// Checks on the dev.rainshare.* lexicons that need no network: that each file is well formed,
// and whether a change to one would break what's already published.
//
// atproto's rule for changing a published lexicon is that records written under the old schema
// stay valid under the new one, and records written under the new one stay valid under the old:
// new fields are optional, nothing is removed or renamed, and types and limits stay as they were.
// Anything bigger needs a new NSID. (https://atproto.com/specs/lexicon#lexicon-evolution)

export const AUTHORITY = 'rainshare.dev';
export const PREFIX = 'dev.rainshare.';

// What may not change on a field once it's published. Descriptions and knownValues may.
const FIXED = ['format', 'minLength', 'maxLength', 'minGraphemes', 'maxGraphemes', 'minimum', 'maximum',
  'enum', 'const', 'default', 'accept', 'maxSize', 'closed', 'key'];

const canon = v => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
/** The same JSON, whatever order the keys are in. */
export const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const show = v => v === undefined ? 'unset' : JSON.stringify(v);
const full = (id, ref) => String(ref).startsWith('#') ? id + ref : String(ref);
const undescribed = v => Array.isArray(v) ? v.map(undescribed)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'description').map(([k, x]) => [k, undescribed(x)])) : v;
const refsIn = v => !v || typeof v !== 'object' ? [] : [
  ...(v.type === 'ref' && typeof v.ref === 'string' ? [v.ref] : []),
  ...(v.type === 'union' && Array.isArray(v.refs) ? v.refs : []),
  ...Object.values(v).flatMap(refsIn),
];

/**
 * What's wrong with the files as they stand: [{ name: 'seed.json', doc }] → a line per problem.
 * Each file is named for its NSID, and every dev.rainshare.* ref points at a def that exists.
 */
export function problems(files){
  const out = [], byId = new Map();
  for (const { name, doc } of files) {
    const want = PREFIX + name.replace(/\.json$/, '');
    if (doc?.lexicon !== 1) out.push(`${name}: "lexicon" should be 1`);
    if (doc?.id !== want) out.push(`${name}: its id should be ${want}, to match the file's name`);
    if (!doc?.defs || typeof doc.defs !== 'object' || !Object.keys(doc.defs).length) out.push(`${name}: it has no defs`);
    else byId.set(doc.id, doc);
  }
  for (const doc of byId.values()) for (const [name, def] of Object.entries(doc.defs)) {
    const at = `${doc.id}#${name}`;
    if (typeof def?.type !== 'string') { out.push(`${at} has no type`); continue; }
    if (def.type === 'record' && name !== 'main') out.push(`${at}: a record has to be the main def`);
    for (const ref of refsIn(def)) {
      const [nsid, frag = 'main'] = full(doc.id, ref).split('#');
      if (nsid.startsWith(PREFIX) && !byId.get(nsid)?.defs?.[frag]) out.push(`${at} points at ${ref}, which isn't defined`);
    }
  }
  return out;
}

/** What in `next` would break records written under `prev`, the published doc: a line each. */
export function breaking(prev, next){
  const out = [];
  for (const [name, def] of Object.entries(prev?.defs || {})) {
    const at = name === 'main' ? prev.id : `${prev.id}#${name}`;
    if (!next?.defs?.[name]) out.push(`${at} is gone`);
    else compare(def, next.defs[name], at, prev.id, out);
  }
  return out;
}

function compare(a, b, at, id, out){
  if (a?.type !== b?.type) return void out.push(`${at}: was ${show(a?.type)}, now ${show(b?.type)}`);
  for (const k of FIXED) if (!same(a[k], b[k])) out.push(`${at}: ${k} was ${show(a[k])}, now ${show(b[k])}`);
  switch (a.type) {
    case 'record':
      return compare(a.record, b.record, at, id, out);
    case 'object': case 'params': {
      const was = new Set(a.required || []), now = new Set(b.required || []);
      for (const r of now) if (!was.has(r)) out.push(`${at}: ${r} is required now`);
      for (const r of was) if (!now.has(r)) out.push(`${at}: ${r} isn't required any more`);
      if (!same([...(a.nullable || [])].sort(), [...(b.nullable || [])].sort())) out.push(`${at}: nullable was ${show(a.nullable)}, now ${show(b.nullable)}`);
      for (const [p, s] of Object.entries(a.properties || {})) {
        if (!b.properties?.[p]) out.push(`${at}.${p} is gone (keep it, and call it deprecated in its description)`);
        else compare(s, b.properties[p], `${at}.${p}`, id, out);
      }
      return;
    }
    case 'array':
      return compare(a.items, b.items, `${at}[]`, id, out);
    case 'ref':
      if (full(id, a.ref) !== full(id, b.ref)) out.push(`${at}: pointed at ${a.ref}, now ${b.ref}`);
      return;
    case 'union': {
      const was = new Set((a.refs || []).map(r => full(id, r))), now = new Set((b.refs || []).map(r => full(id, r)));
      for (const r of was) if (!now.has(r)) out.push(`${at}: ${r} is no longer one of its options`);
      if (a.closed) for (const r of now) if (!was.has(r)) out.push(`${at}: ${r} was added to a closed union`);
      return;
    }
    // Everything that can change on these is in FIXED.
    case 'string': case 'integer': case 'boolean': case 'bytes': case 'cid-link': case 'blob': case 'unknown': case 'token':
      return;
    default:
      // Methods and anything newer: only descriptions may change, since this doesn't know them well enough to say more.
      if (!same(undescribed(a), undescribed(b))) out.push(`${at}: this ${a.type} changed, and only its descriptions may`);
  }
}
