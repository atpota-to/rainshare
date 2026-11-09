// rainshare.dev's OAuth scope and client metadata. Plain and dependency-free, because the
// Vercel function behind /oauth-client-metadata.json imports it too
// (api/oauth-client-metadata.js): a hosted client whose document declares less than the app
// asks for fails every sign-in, so both come from here.
const env = import.meta.env || {};

// The group host, for private sidequests in groups: an Open Social host.
export const HOST = env.VITE_GROUP_HOST || 'https://opensocial.fyi';
export const HOST_DID = env.VITE_GROUP_HOST_DID || 'did:web:opensocial.fyi';
export const AUD = HOST_DID + '#opensocial';
export const NS = 'fyi.opensocial';
export const PLC = env.VITE_PLC_URL || 'https://plc.directory';

export const RAINSHARE = ['dev.rainshare.profile', 'dev.rainshare.sidequest', 'dev.rainshare.take', 'dev.rainshare.delivery'];
// The host methods Rainshare calls: your groups, a group's spaces, and adding Rainshare to one.
export const METHODS = ['getActorGroups', 'getGroup', 'createSpace'];

const A = encodeURIComponent(AUD);
const rpc = m => `rpc:${NS}.${m}?aud=${A}`;
const repo = RAINSHARE.map(c => `repo:${c}`);

// Any atproto account: your public sidequests, takes, deliveries and profile, and finding your groups.
export const BASIC_SCOPE = ['atproto', ...repo, ...METHODS.map(rpc)].join(' ');
// An account whose server does spaces: the same, plus reading your groups' spaces and writing
// your own Rainshare records into them. `space:*` because nobody publishes the space type, and a
// consent screen looks up every space type a scope names.
export const SCOPE = [
  'atproto',
  `include:${NS}.basePermissions?aud=${A}`,
  `space:*?authority=*&${RAINSHARE.map(c => 'collection=' + c).join('&')}&action=read&action=create&action=update&action=delete`,
  ...repo,
  ...METHODS.map(rpc)
].join(' ');

export const REDIRECT_PATH = '/signed-in';

export function clientMetadata(origin){
  return {
    client_id: origin + '/oauth-client-metadata.json',
    client_name: 'Rainshare',
    client_uri: origin,
    logo_uri: origin + '/favicon.svg',
    redirect_uris: [origin + REDIRECT_PATH],
    scope: SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true
  };
}
