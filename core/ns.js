// The record types, and the words people see for their values. Plain data, so the
// browser apps and the CLI and MCP server read the same lists.
export const NS = 'dev.rainshare';
export const PROFILE = NS + '.profile', SIDEQUEST = NS + '.sidequest', TAKE = NS + '.take', DELIVERY = NS + '.delivery';
export const COLLECTIONS = [PROFILE, SIDEQUEST, TAKE, DELIVERY];
// The space type a group's Rainshare lives in (its private sidequests, takes, deliveries and profiles).
export const BOARD = NS + '.board';
export const SITE = 'https://rainshare.dev';

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

export const labelOf = (list, v) => (list.find(x => x[0] === v) || [, v])[1];
export const audienceOf = record => String(record?.audience?.$type || '').split('#')[1] || 'anyone';
