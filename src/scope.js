// rainshare.dev's OAuth scope and client metadata. Plain, with nothing but ../core/ns.js
// (plain data) behind it, because the Vercel function behind /oauth-client-metadata.json imports it too
// (api/oauth-client-metadata.js): a hosted client whose document declares less than the app
// asks for fails every sign-in, so both come from here.
import { GROUPS, FORGE_SCOPES, COLLECTIONS, MODERATION, MODERATOR, HANDLE, FOLLOW_SCOPE, USERINPUT_SETS, USERINPUT_BASIC, USERINPUT_FULL, BOARD_MODERATORS } from '../core/ns.js';

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
// Posting on Rainshare's feedback board, here rather than on userinput.app: its records are
// userinput.app's (../core/ns.js), so it's userinput.app's own permission sets that are asked for,
// the same two ways. Everyone's sign-in asks for the basic one (posting, replying, voting and
// editing your own). The board's moderators' ask for the full one, which adds running the board.
export const FEEDBACK = { set: `include:${USERINPUT_SETS.basic}`, named: USERINPUT_BASIC.map(c => `repo:${c}`).join(' ') };
export const FEEDBACK_FULL = { set: `include:${USERINPUT_SETS.full}`, named: USERINPUT_FULL.map(c => `repo:${c}`).join(' ') };
// Both kinds of record, one way or the other: the sets together, or the names together.
const own = (how, { boardModerator = false } = {}) => `${OWN[how]} ${(boardModerator ? FEEDBACK_FULL : FEEDBACK)[how]}`;

// With groups off (GROUPS in ../core/ns.js), sign-in asks for your own Rainshare records (your
// public seeds, takes, deliveries, comments, profile and settings), your posts and votes on the
// feedback board, and to follow
// @rainshare.dev for you when you switch its messages on (FOLLOW_SCOPE: create, never delete).
// `own` is one of OWN's two. A set can only grant what's under its own name, so the follow is
// always asked for on its own.
//
// Any atproto account: those, and finding your groups.
const basic = own => ['atproto', own, FOLLOW_SCOPE, ...(GROUPS ? METHODS.map(rpc) : [])].join(' ');
// An account whose server does spaces: the same, plus reading your groups' spaces and writing
// your own Rainshare records into them. `space:*` because nobody publishes the space type, and a
// consent screen looks up every space type a scope names.
const full = own => !GROUPS ? basic(own) : [
  'atproto',
  `include:${NS}.basePermissions?aud=${A}`,
  `space:*?authority=*&${RAINSHARE.map(c => 'collection=' + c).join('&')}&action=read&action=create&action=update&action=delete`,
  own,
  FOLLOW_SCOPE,
  ...METHODS.map(rpc)
].join(' ');
// Both with your records by name: what's asked of a server that can't look the sets up.
export const BASIC_SCOPE = basic(own('named'));
export const SCOPE = full(own('named'));

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
// With groups off the first two are the same. Each is asked first with the permission sets
// (Rainshare's and userinput.app's), and then with your records by name, so a server that can't
// look the sets up still gets the forges. With groups off that's four steps:
//   the sets and the forges, the names and the forges, the sets alone, the names alone
//
// @rainshare.dev's own sign-in asks for one thing more at every step: writing moderation records
// (../core/moderation.js). Nobody else is asked, so nobody else's sign-in page mentions them.
// The feedback board's moderators (`boardModerator`: @rainshare.dev and @dame.is) are asked for
// userinput.app's full set in place of its basic one, at every step.
export const ladder = (forges = FORGES, { moderator = false, boardModerator = false } = {}) => [...new Set([[full, forges], [basic, forges], [basic, []]]
  .flatMap(([scope, f]) => ['set', 'named'].map(how => withForges(scope(own(how, { boardModerator })), f) + (moderator ? ' ' + MODERATE : ''))))];

// Moderating: writing dev.rainshare.moderation records into your own repo. Only the records in
// MODERATOR's repo count, so this is only asked of that account (`moderates`), by its DID or
// its handle, whichever the sign-in was started with.
export const MODERATE = `repo:${MODERATION}`;
const said = who => String(who || '').trim().replace(/^@/, '').toLowerCase();
export const moderates = who => who === MODERATOR || said(who) === HANDLE;
/** Whether `who` (a DID, or the handle a sign-in was started with) runs the feedback board: see BOARD_MODERATORS. */
export const moderatesBoard = who => BOARD_MODERATORS.some(([did, handle]) => who === did || said(who) === handle);
/** Whether a granted scope lets this sign-in write moderation records. */
export const canModerate = scope => String(scope || '').split(/\s+/).some(x => x.split('?')[0] === MODERATE);
/**
 * Whether a granted scope lets this sign-in follow @rainshare.dev for you. A server may write a
 * scope its own way, so it's any grant of follows that allows creating one (or every action).
 */
export const canFollow = scope => String(scope || '').split(/\s+/).some(x => {
  const [what, query = ''] = x.split('?');
  if (what !== FOLLOW_SCOPE.split('?')[0]) return false;
  const actions = new URLSearchParams(query).getAll('action');
  return !actions.length || actions.includes('create');
});

// Everything the app might ever ask for: every part of every step, the moderators' included. A
// hosted client's document has to declare it all, whatever a particular sign-in ends up asking for.
export const DECLARED_SCOPE = [...new Set([...ladder(), ...ladder(FORGES, { moderator: true, boardModerator: true }), ...ladder(FORGES, { boardModerator: true })].flatMap(s => s.split(' ')))].join(' ');

/* ---------- a sign-in from before ---------- */
// What a server grants is fixed when you sign in, and refreshing the sign-in keeps it as it was.
// So a sign-in from before Rainshare asked for something (settings, following @rainshare.dev,
// the feedback board) goes on without it until you sign in again. `missingFrom` says what a
// granted scope is short of, compared with what signing in asks for now. A server may write a
// grant its own way (a set by name, or what the set holds, as `repo:<collection>` or
// `repo?collection=…`), so each is looked for every way.
const ALL = ['create', 'update', 'delete'];
// Whether a granted scope lets this sign-in create, change and delete `collection` in your own
// repo. `sets`: the permission sets that hold it, any of which counts.
function writes(scope, collection, sets = []){
  return String(scope || '').split(/\s+/).some(t => {
    if (t === 'transition:generic') return true;
    const [what, query = ''] = t.split('?');
    if (what.startsWith('include:')) return sets.includes(what.slice(8));
    if (what !== 'repo' && !what.startsWith('repo:')) return false;
    const q = new URLSearchParams(query), cols = what === 'repo' ? q.getAll('collection') : [what.slice(5)], acts = q.getAll('action');
    return (cols.includes(collection) || cols.includes('*')) && (!acts.length || ALL.every(x => acts.includes(x)));
  });
}
// What the board's moderators write (the rest of the full set, apart from what Rainshare never writes).
const RUNS_BOARD = ['space', 'status', 'member', 'pin', 'hide', 'ban', 'lock'].map(n => `app.userinput.${n}`);
const USES = ['discussion', 'reply', 'upvote', 'edit'].map(n => `app.userinput.${n}`);
/**
 * What a granted scope is short of, compared with what signing in asks for now, as a list of:
 *   records     your Rainshare records (a sign-in from before settings, say)
 *   follow      following @rainshare.dev for you, for its messages
 *   feedback    posting, replying, voting and editing on the feedback board
 *   moderation  @rainshare.dev's moderation records (`moderator`)
 *   board       running the feedback board (`boardModerator`)
 * Empty when it has it all, and when the server wouldn't say what it granted ('').
 */
export function missingFrom(scope, { moderator = false, boardModerator = false } = {}){
  if (!String(scope || '').trim()) return [];
  const basic = [USERINPUT_SETS.basic, USERINPUT_SETS.full], full = [USERINPUT_SETS.full];
  return [
    !RAINSHARE.every(c => writes(scope, c, [PERMISSION_SET])) && 'records',
    !canFollow(scope) && 'follow',
    !USES.every(c => writes(scope, c, basic)) && 'feedback',
    moderator && !canModerate(scope) && 'moderation',
    boardModerator && !RUNS_BOARD.every(c => writes(scope, c, full)) && 'board'
  ].filter(Boolean);
}
/** Whether a granted scope lets this sign-in post, reply and vote on the feedback board. (A server that won't say is tried.) */
export const canFeedback = scope => !String(scope || '').trim() || !missingFrom(scope).includes('feedback');
/** Whether a granted scope lets this sign-in run the feedback board: statuses, hiding, bans, pins, locks, moderators. */
export const canRunBoard = scope => !String(scope || '').trim() || !missingFrom(scope, { boardModerator: true }).includes('board');

export const REDIRECT_PATH = '/signed-in';

export function clientMetadata(origin){
  return {
    client_id: origin + '/oauth-client-metadata.json',
    client_name: 'Rainshare',
    client_uri: origin,
    logo_uri: origin + '/apple-touch-icon.png',
    tos_uri: origin + '/terms',
    policy_uri: origin + '/privacy',
    redirect_uris: [origin + REDIRECT_PATH],
    scope: DECLARED_SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true
  };
}
