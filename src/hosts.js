// Making an account, for someone who hasn't got one. An atproto account lives with a host (its
// server), works in every Atmosphere app whichever host that is, and can move to another host
// later. Each host here lets anyone make one, with no invite. The account is made on the host's
// own site: signing in with the host's address in place of a handle (./oauth.js) sends you
// there, to its sign-up form, and back here signed in.
//
// Plain, so the tests can read it. `hue` colours the host's initial where it's offered, so no
// two hosts that start with the same letter look alike.

export const HOSTS = [
  { id: 'bluesky', name: 'Bluesky', url: 'https://bsky.social', region: 'United States', hue: 212, usual: true },
  { id: 'blacksky', name: 'Blacksky', url: 'https://blacksky.app', region: 'United States', hue: 268 },
  { id: 'eurosky', name: 'Eurosky', url: 'https://eurosky.social', region: 'Germany', hue: 46 },
  { id: 'selfhosted', name: 'selfhosted.social', url: 'https://selfhosted.social', region: 'United States', hue: 150 },
  { id: 'npmx', name: 'npmx', url: 'https://npmx.social', region: 'Germany', hue: 0 }
];

export const hostById = id => HOSTS.find(h => h.id === id) || null;
export const domainOf = h => new URL(h.url).host;

/**
 * Whether a server's sign-in can open on its sign-up form (OAuth's prompt=create), from its
 * authorization server metadata. One that can't opens on its sign-in page, which has its own
 * way to make an account.
 */
export const signsUp = metadata => Array.isArray(metadata?.prompt_values_supported) && metadata.prompt_values_supported.includes('create');
