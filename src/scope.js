// rainshare.dev's OAuth scope and client metadata. Plain, with nothing but ../core/ns.js
// (plain data) behind it, because the Vercel function behind /oauth-client-metadata.json imports it too
// (api/oauth-client-metadata.js): a hosted client whose document declares less than the app
// asks for fails every sign-in, so both come from here.
import { GROUPS, FORGE_SCOPES, COLLECTIONS } from '../core/ns.js';

const env = import.meta.env || {};

// The group host, for private seeds in groups: an Open Social host.
export const HOST = env.VITE_GROUP_HOST || 'https://opensocial.fyi';
export const HOST_DID = env.VITE_GROUP_HOST_DID || 'did:web:opensocial.fyi';
export const AUD = HOST_DID + '#opensocial';
export const NS = 'fyi.opensocial';
export const PLC = env.VITE_PLC_URL || 'https://plc.directory';

// Every Rainshare record type: profiles, seeds, takes, deliveries and comments.
export const RAINSHARE = COLLECTIONS;
// The host methods Rainshare calls: your groups, a group's spaces, and adding Rainshare to one.
export const METHODS = ['getActorGroups', 'getGroup', 'createSpace'];

const A = encodeURIComponent(AUD);
const rpc = m => `rpc:${NS}.${m}?aud=${A}`;

// Your own Rainshare records, asked for two ways. Rainshare publishes a permission set that
// grants them (lexicons/dev/rainshare/authFull.json), and a server that can look it up shows
// its title and a sentence on the page it signs you in on, in place of each record type by
// name. A server that can't refuses it (invalid_scope), and is asked for the records by name:
// the same permissions, worded by the server. See `ladder`.
export const PERMISSION_SET = 'dev.rainshare.authFull';
export const OWN = { set: `include:${PERMISSION_SET}`, named: RAINSHARE.map(c => `repo:${c}`).join(' ') };

// With groups off (GROUPS in ../core/ns.js), sign-in asks for nothing but your own Rainshare
// records: your public seeds, takes, deliveries, comments and profile. `own` is one of OWN's two.
//
// Any atproto account: those, and finding your groups.
const basic = own => ['atproto', own, ...(GROUPS ? METHODS.map(rpc) : [])].join(' ');
// An account whose server does spaces: the same, plus reading your groups' spaces and writing
// your own Rainshare records into them. `space:*` because nobody publishes the space type, and a
// consent screen looks up every space type a scope names.
const full = own => !GROUPS ? basic(own) : [
  'atproto',
  `include:${NS}.basePermissions?aud=${A}`,
  `space:*?authority=*&${RAINSHARE.map(c => 'collection=' + c).join('&')}&action=read&action=create&action=update&action=delete`,
  own,
  ...METHODS.map(rpc)
].join(' ');
// Both with your records by name: what's asked of a server that can't look the set up.
export const BASIC_SCOPE = basic(OWN.named);
export const SCOPE = full(OWN.named);

// Posting to a forge for you (an issue, a comment or a pull request on knotless or Tangled,
// and a vouch on Tangled) needs more than Rainshare's own records. Sign-in asks for it all up
// front (./oauth.js); a sign-in that was granted less can add a forge later, which asks again
// with that forge added to whatever it already had. FORGE_SCOPES in ../core/ns.js says what
// each needs.
export const FORGES = Object.keys(FORGE_SCOPES);
const known = forges => FORGES.filter(f => (forges || []).includes(f));
export const withForges = (scope, forges) => [scope, ...known(forges).flatMap(f => FORGE_SCOPES[f])].join(' ');
/** Which forges a granted scope lets Rainshare post to. A server may write a scope its own way, so this looks for what each names. */
export function forgesIn(scope){
  const has = s => String(scope || '').split(/\s+/).some(x => x.split('?')[0] === s.split('?')[0]);
  return FORGES.filter(f => FORGE_SCOPES[f].every(has));
}
// What a sign-in asks for, widest first. Each step down is what's asked of a server that
// refused the one before:
//   everything          private seeds (when groups are on), and posting to the forges
//   any server's seeds  and posting to the forges
//   Rainshare alone     your own records, with the forges left to connect later
// With groups off the first two are the same. Each is asked first with Rainshare's permission
// set, and then with your records by name, so a server that can't look the set up still gets
// the forges. With groups off that's four steps:
//   the set and the forges, the names and the forges, the set alone, the names alone
export const ladder = (forges = FORGES) => [...new Set([[full, forges], [basic, forges], [basic, []]]
  .flatMap(([scope, f]) => [OWN.set, OWN.named].map(own => withForges(scope(own), f))))];

// Everything the app might ever ask for: every part of every step. A hosted client's document
// has to declare it all, whatever a particular sign-in ends up asking for.
export const DECLARED_SCOPE = [...new Set(ladder().flatMap(s => s.split(' ')))].join(' ');

export const REDIRECT_PATH = '/signed-in';

export function clientMetadata(origin){
  return {
    client_id: origin + '/oauth-client-metadata.json',
    client_name: 'Rainshare',
    client_uri: origin,
    logo_uri: origin + '/apple-touch-icon.png',
    redirect_uris: [origin + REDIRECT_PATH],
    scope: DECLARED_SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true
  };
}
