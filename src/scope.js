// rainshare.dev's OAuth scope and client metadata. Plain, with nothing but ../core/ns.js
// (plain data) behind it, because the Vercel function behind /oauth-client-metadata.json imports it too
// (api/oauth-client-metadata.js): a hosted client whose document declares less than the app
// asks for fails every sign-in, so both come from here.
import { GROUPS, FORGE_SCOPES } from '../core/ns.js';

const env = import.meta.env || {};

// The group host, for private seeds in groups: an Open Social host.
export const HOST = env.VITE_GROUP_HOST || 'https://opensocial.fyi';
export const HOST_DID = env.VITE_GROUP_HOST_DID || 'did:web:opensocial.fyi';
export const AUD = HOST_DID + '#opensocial';
export const NS = 'fyi.opensocial';
export const PLC = env.VITE_PLC_URL || 'https://plc.directory';

export const RAINSHARE = ['dev.rainshare.profile', 'dev.rainshare.seed', 'dev.rainshare.take', 'dev.rainshare.delivery'];
// The host methods Rainshare calls: your groups, a group's spaces, and adding Rainshare to one.
export const METHODS = ['getActorGroups', 'getGroup', 'createSpace'];

const A = encodeURIComponent(AUD);
const rpc = m => `rpc:${NS}.${m}?aud=${A}`;
const repo = RAINSHARE.map(c => `repo:${c}`);

// With groups off (GROUPS in ../core/ns.js), sign-in asks for nothing but your own Rainshare
// records: your public seeds, takes, deliveries and profile.
//
// Any atproto account: those, and finding your groups.
export const BASIC_SCOPE = ['atproto', ...repo, ...(GROUPS ? METHODS.map(rpc) : [])].join(' ');
// An account whose server does spaces: the same, plus reading your groups' spaces and writing
// your own Rainshare records into them. `space:*` because nobody publishes the space type, and a
// consent screen looks up every space type a scope names.
export const SCOPE = !GROUPS ? BASIC_SCOPE : [
  'atproto',
  `include:${NS}.basePermissions?aud=${A}`,
  `space:*?authority=*&${RAINSHARE.map(c => 'collection=' + c).join('&')}&action=read&action=create&action=update&action=delete`,
  ...repo,
  ...METHODS.map(rpc)
].join(' ');

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
// With groups off the first two are the same, so there are two steps.
export const ladder = (forges = FORGES) => [...new Set([withForges(SCOPE, forges), withForges(BASIC_SCOPE, forges), BASIC_SCOPE])];

// Everything the app might ever ask for. A hosted client's document has to declare it all,
// whatever a particular sign-in ends up asking for.
export const DECLARED_SCOPE = withForges(SCOPE, FORGES);

export const REDIRECT_PATH = '/signed-in';

export function clientMetadata(origin){
  return {
    client_id: origin + '/oauth-client-metadata.json',
    client_name: 'Rainshare',
    client_uri: origin,
    logo_uri: origin + '/favicon.svg',
    redirect_uris: [origin + REDIRECT_PATH],
    scope: DECLARED_SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true
  };
}
