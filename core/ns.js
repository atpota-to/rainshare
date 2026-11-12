// The record types, and the words people see for their values. Plain data, so the
// browser apps and the CLI and MCP server read the same lists.
export const NS = 'dev.rainshare';
export const PROFILE = NS + '.profile', SEED = NS + '.seed', TAKE = NS + '.take', DELIVERY = NS + '.delivery';
export const COLLECTIONS = [PROFILE, SEED, TAKE, DELIVERY];
// The space type a group's Rainshare lives in (its private seeds, takes, deliveries and profiles).
export const BOARD = NS + '.board';
export const SITE = 'https://rainshare.dev';
// How far along Rainshare itself is: the board note, the ask screen, the CLI and the MCP server
// read it. index.html writes the word out by hand in the badge, the badge's title and the
// landing line, so change those three with it.
export const STAGE = 'alpha';
// Private seeds in a group's space. Spaces are still an alpha on the group host, so for now
// every seed is public: sign-in asks only for Rainshare's own records, and the app shows
// groups as coming. Turning this on brings back everything private (src/scope.js, the
// "Private, in a group" choice, "only my groups" on a profile, and groups in the example).
export const GROUPS = false;
// Set aside for now, to keep Rainshare simple while it's early. Each is still in the records
// (old records keep theirs, and nothing is deleted), and turning one on brings it all back:
//   audience     the "Who's it for?" step when asking, and that line on an ask's page. New asks
//                are open to everyone; an ask's audience is still honoured (./circle.js).
//   seedValues   what an ask stands for: asked when asking, and shown on its page
//   priorities   who you'd like to help first: on profiles, and its say in a board's order (./rank.js)
//   forecast     how much rain you have to spare: on profiles, the board, and the CLI's `forecast`
export const FEATURES = { audience: false, seedValues: false, priorities: false, forecast: false };

export const HARNESSES = [
  ['claude-code', 'Claude Code'], ['codex', 'Codex'], ['cursor', 'Cursor'], ['gemini-cli', 'Gemini CLI'],
  ['copilot', 'Copilot'], ['opencode', 'opencode'], ['aider', 'Aider'], ['amp', 'Amp'], ['goose', 'Goose'],
  ['windsurf', 'Windsurf'], ['other', 'Something else']
];
// Suggestions only: anything a harness accepts is fine.
export const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'gpt-5', 'gpt-5-codex', 'gemini-3-pro', 'qwen3-coder', 'local'];
// What people call them.
export const MODEL_NAMES = {
  'claude-opus-5-5': 'Opus', 'claude-sonnet-5-5': 'Sonnet', 'claude-haiku-5-5': 'Haiku', 'claude-fable-5-1': 'Fable',
  'gpt-5': 'GPT-5', 'gpt-5-codex': 'GPT-5 Codex', 'gemini-3-pro': 'Gemini 3 Pro', 'qwen3-coder': 'Qwen3 Coder', local: 'a local model',
  opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable'
};
export const modelName = m => MODEL_NAMES[String(m).toLowerCase()] || String(m);
// The ones offered as buttons when posting.
export const MODEL_PICKS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'gpt-5-codex', 'gemini-3-pro'];
export const RUNS_ON = [['cloud', 'In the cloud'], ['local', 'On my machine'], ['self-hosted', 'My own server'], ['hybrid', 'A bit of both']];

export const BUDGETS = [
  ['none', 'No paid AI', 'Nothing paid'],
  ['free', 'Free tiers', 'Free tiers only'],
  ['low', 'Under $25', 'Under $25 a month'],
  ['medium', '$25–99', '$25 to $99 a month'],
  ['high', '$100+', '$100 or more a month'],
  ['sponsored', 'Paid for', 'An employer, school or grant pays']
];
export const LOW_BUDGET = ['none', 'free', 'low'];
// AI plans: what someone pays for to code with AI, or that they don't. It's the first thing
// said about a person, on their profile and beside their asks. It takes over from `budget` and
// a setup's typed `plan`, which older profiles still have and are read when there's no plan.
// [value, what people read]
export const PLANS = [
  ['claude-pro', 'Claude Pro'], ['claude-max', 'Claude Max'], ['chatgpt-plus', 'ChatGPT Plus'], ['chatgpt-pro', 'ChatGPT Pro'],
  ['copilot', 'GitHub Copilot'], ['cursor', 'Cursor'], ['gemini', 'Gemini'], ['api', 'Pay as I go (API)'],
  ['work', 'Paid by work or school'], ['free', 'Free tiers only'], ['none', 'No AI plan']
];
export const UNPAID = ['free', 'none'];
/** Someone's plans, as their record has them: strings only, at most 12. */
export const plansIn = p => (Array.isArray(p?.plans) ? p.plans : []).filter(x => typeof x === 'string' && x).slice(0, 12);
/**
 * Whether someone is without a paid plan: 'none', 'free', 'low' (an older profile's "under $25"
 * budget), or null when they pay for one or haven't said. Plans decide it when there are any.
 */
export function lowBudgetOf(p){
  const plans = plansIn(p);
  if (plans.length) return plans.some(x => !UNPAID.includes(x)) ? null : plans.includes('free') ? 'free' : 'none';
  return LOW_BUDGET.includes(p?.budget) ? p.budget : null;
}

export const FORECAST = [
  ['dry', 'Dry', 'Nothing to spare right now'],
  ['drizzle', 'Drizzle', 'A small task or two'],
  ['showers', 'Showers', 'A few sessions'],
  ['downpour', 'Downpour', 'Lots, and it resets soon']
];

export const CIRCUMSTANCES = [
  ['student', 'Student'], ['learning', 'Learning to code'], ['low-income', 'Low income'], ['between-jobs', 'Between jobs'],
  ['oss-maintainer', 'Open source maintainer'], ['nonprofit', 'Nonprofit or community project'], ['educator', 'Educator'], ['caregiver', 'Caregiver']
];
export const PRIORITIES = [
  ['low-budget', 'People without big AI plans'], ['students', 'Students'], ['low-income', 'People on low incomes'],
  ['newcomers', 'People learning to code'], ['values-aligned', 'Projects that share my values'],
  ['nonprofits', 'Nonprofits and community projects'], ['maintainers', 'Open source maintainers'], ['friends-first', 'Close friends first']
];
export const VALUES = ['accessibility', 'climate', 'privacy', 'local-first', 'open-source', 'education', 'mutual-aid', 'queer', 'art', 'science', 'civic', 'small-web'];

export const AUDIENCES = [
  ['mutuals', 'Mutuals', 'People you follow who follow you back'],
  ['following', 'People I follow', 'Anyone you follow on Bluesky'],
  ['followers', 'My followers', 'Anyone who follows you (anyone can follow you)'],
  ['list', 'A list', 'People on one of your Bluesky lists'],
  ['anyone', 'Everyone', 'Anyone who comes across it']
];
export const TESTS = [['required', 'Tests required'], ['welcome', 'Tests welcome'], ['none', 'No tests needed']];
export const SIZES = [['tiny', 'Tiny'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
// What's being asked about, by how far along it is: an idea (no repo), or a project that
// exists. The keys are the records' own words (a seed, then a plant's stages), and are drawn
// as one, but what people read is plain. [value, name, what it means]
export const STAGES = [
  ['seed', 'Idea', 'Nothing’s been built yet.'],
  ['seedling', 'Just started', 'There’s a repo and a first sketch.'],
  ['young', 'Taking shape', 'It works, and it’s still changing.'],
  ['established', 'Established', 'People use it and rely on it.']
];
// An idea with no repo yet: who keeps what gets built.
export const OWNERS = [['helper', 'Whoever builds it keeps it'], ['requester', 'Started for the person who asked']];

export const labelOf = (list, v) => (list.find(x => x[0] === v) || [, v])[1];
export const audienceOf = record => String(record?.audience?.$type || '').split('#')[1] || 'anyone';

// What a sign-in has to allow before Rainshare can post to a forge for you. Sign-in asks for
// all of it up front (../src/oauth.js), so nobody is sent back to their server halfway through
// something. A sign-in that was granted less can add a forge later (see ./forgewrite.js).
//   knotless  an issue, a comment or a pull request is a record in your own account
//   Tangled   they're kept with the repo, on its host. Your server gives Rainshare a token,
//             good for a minute, that says a call is yours: one for writing a record there
//             (an issue, a comment, a pull request), one for a pull request's changes, and
//             one for taking a pull request back if its changes are refused. A record in
//             your own account says each post was yours. A vouch for someone is a record in
//             your own account too (./vouch.js).
export const FORGE_SCOPES = {
  knotless: ['repo:dev.knotless.issue?action=create', 'repo:dev.knotless.comment?action=create', 'repo:dev.knotless.pull?action=create'],
  tangled: [
    'rpc:com.atproto.repo.createRecord?aud=*', 'rpc:org.tangled.review.submitPatch?aud=*', 'rpc:com.atproto.repo.deleteRecord?aud=*',
    'repo:org.tangled.graph.attestation?action=create', 'repo:org.tangled.graph.vouch'
  ]
};
