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
//   values       what you care about: on profiles, and its say in a board's order (./rank.js).
//                Rainshare sticks to the facts of a job for now: where, how big, which models.
//   circumstances  "About them" (a student, between jobs, a maintainer…): on profiles, and its
//                say in a board's order
export const FEATURES = { audience: false, seedValues: false, priorities: false, forecast: false, values: false, circumstances: false };

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
// AI plans: what someone pays for to code with AI, or that they don't. It's the first thing
// said about a person, on their profile and beside their asks. It takes over from `budget` and
// a setup's typed `plan`, which older profiles still have and are read when there's no plan.
// [value, what people read]
// By provider, not by tier: whether it's Pro or Max, Plus or Pro, isn't asked.
export const PLANS = [
  ['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['copilot', 'GitHub Copilot'], ['cursor', 'Cursor'], ['gemini', 'Gemini'], ['zai', 'Z.ai GLM'],
  ['free', 'Free tiers only'], ['none', 'No AI plan']
];
// Plans were by tier for a while: a record that says one counts as its provider's.
const PLAN_ALIASES = { 'claude-pro': 'claude', 'claude-max': 'claude', 'chatgpt-plus': 'chatgpt', 'chatgpt-pro': 'chatgpt' };
/** A plan as it's kept now: a tier from an older record becomes its provider ("claude-max" is "claude"). */
export const planKey = x => PLAN_ALIASES[x] || x;
export const UNPAID = ['free', 'none'];
// Which model families an ask can prefer, and how capable a model: families and a level rather
// than model names, since names change every few months and a helper knows which of theirs fit.
// Any other can be typed in ("Or another"), and a model someone runs from it still matches.
export const FAMILIES = [['claude', 'Claude'], ['gpt', 'GPT'], ['gemini', 'Gemini'], ['deepseek', 'DeepSeek'], ['qwen', 'Qwen'], ['glm', 'GLM'], ['kimi', 'Kimi'], ['mistral', 'Mistral']];
// How capable a model, without naming one. Left out, any level does. [value, name, what it means]
export const LEVELS = [
  ['frontier', 'Frontier', 'the most capable model a family has'],
  ['mid', 'Mid-tier', 'a step below the frontier, capable and lighter on a plan'],
  ['small', 'Small', 'quick and light, for simple jobs']
];
/** A level as it goes before a family: "frontier", "mid-tier", "small". */
export const levelWord = l => String(labelOf(LEVELS, l)).toLowerCase();
/** A family's name: "Claude", or one nobody knows as it was written. */
export const familyName = f => labelOf(FAMILIES, f);
/** A model's family, from its name ("claude-opus-5-5", "gpt-5-codex"), or null. */
export const familyOf = m => {
  const s = String(m || '').toLowerCase();
  return /claude|opus|sonnet|haiku|fable/.test(s) ? 'claude' : /gpt|codex|^o\d/.test(s) ? 'gpt' : /gemini/.test(s) ? 'gemini' : /grok/.test(s) ? 'grok'
    : /deepseek/.test(s) ? 'deepseek' : /qwen/.test(s) ? 'qwen' : /glm|zhipu/.test(s) ? 'glm' : /kimi|moonshot/.test(s) ? 'kimi' : /mistral|devstral|codestral/.test(s) ? 'mistral' : null;
};
// Which families a plan reaches, for matching against the families an ask would like. What each
// plan includes keeps changing, so a match says "Claude models", never which ones or how capable.
export const PLAN_FAMILIES = {
  claude: ['claude'], chatgpt: ['gpt'], gemini: ['gemini'], zai: ['glm'],
  copilot: ['claude', 'gpt', 'gemini'], cursor: ['claude', 'gpt', 'gemini']
};
// Rainshare is about coding subscriptions and the usage they come with, so pay as you go and
// paid by work or school, which were offered for a while, are left out when a record has them.
const RETIRED_PLANS = ['api', 'work'];
/** Someone's plans, as their record has them: strings only, at most 12. */
export const plansIn = p => [...new Set((Array.isArray(p?.plans) ? p.plans : []).filter(x => typeof x === 'string' && x && !RETIRED_PLANS.includes(x)).map(planKey))].slice(0, 12);
/**
 * Whether someone is without a coding subscription: 'none', 'free', or null when they have one
 * or haven't said. Plans decide it; an older profile's budget only when it said none or free.
 */
export function lowBudgetOf(p){
  const plans = plansIn(p);
  if (plans.length) return plans.some(x => !UNPAID.includes(x)) ? null : plans.includes('free') ? 'free' : 'none';
  return UNPAID.includes(p?.budget) ? p.budget : null;
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
