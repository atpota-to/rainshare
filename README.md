# Rainshare

*Mutual aid using your AI agents.*

**Got rain to spare or need a hand?** Your AI plan resets whether you use it all or not, so use
your agent to help someone else. You're not sharing your plan or your account, just what your
agent makes as a PR.

> **Early alpha.** It works end to end, but the screens, the CLI and the record format may still
> change. Anything you post is saved in your own atproto account.

Rainshare is a board of ideas and projects people would like help with. Anyone can ask, and
anyone with usage to spare can direct their own coding agent at an ask, signed in as themselves,
on their own plan. We call that help rain. Nobody pays, nothing is proxied, and what changes
hands is a pull request.

It runs on atproto. Every ask is a record in the account of whoever posted it, so there's no
Rainshare database of asks or people. It works with Bluesky, Tangled, knotless and GitHub.

- The site: [rainshare.dev](https://rainshare.dev)
- On Bluesky: [@rainshare.dev](https://bsky.app/profile/rainshare.dev)
- Bugs and ideas: [rainshare.dev/feedback](https://rainshare.dev/feedback)

## How it works

1. **Ask for help.** Post an idea or a project. A project is a repo or issue on Tangled,
   knotless, GitHub or any git host. An idea doesn't need a repo, or even a developer: say
   whether whoever builds it keeps it, or should start a repo for you.
2. **Direct your agent.** Pick an ask and press "Direct my agent". Your agent gets the ask in
   the asker's own words, with safety rules from Rainshare around it. Read it before you start.
   You can tell the asker you're on it, for a day or longer.
3. **Turn it in.** Your agent opens a pull request. Paste its link back, or pick it from the pull
   requests Rainshare found that mention the ask. If nothing's turned in by the day you gave,
   the ask shows as free again.
4. **Grow a garden.** If the work does the job, the asker accepts it and can say thanks. It grows
   as a plant in your garden, on your profile.

Under the open asks, the board shows what's been done: asks where someone turned in the work and
whoever asked accepted it, with the thanks they said, if any. Picking one shows how it went, with
no way to direct an agent at it.

Between the two, under "Probably done", are asks that are still open but look finished: a pull
request for one was merged (turned in here or not), or its issue was closed. Only whoever asked
can mark an ask done, so it waits there for them, out of the way of what needs an agent, and their
own board tells them it may be done. "Direct my agent anyway" is still there for anyone who
disagrees.

The board is open to read on the home page without signing in. To ask or help, sign in with a
Bluesky or other Atmosphere handle. If you haven't got one, the sign-in helps you make one on
Bluesky, Blacksky, Eurosky, selfhosted.social or npmx.

Every ask has comments. When it's on a Tangled or knotless issue, its comments are the issue's
own, so the conversation stays in one place.

Next to every asker and helper, Rainshare shows how you know them: whether you follow each other
on Bluesky or Tangled, who you follow that follows them, and whether anyone in your Tangled
[vouch](https://tangled.org/docs/guides/vouching/) circle vouches for them. None of it gates
anything, but you can filter the board by it.

Signed in, the **bell** in the bar counts what's happened on your asks and your work, and what's
new on Rainshare. You can also ask for **direct messages** from @rainshare.dev in Settings: news
on your asks and your work, and how many new asks there are each day. Switching them on follows
@rainshare.dev for you, since Bluesky only lets accounts you follow message you. Reply STOP to any
message to stop them.

### From a phone

For an ask on GitHub, "Direct my agent" can open it in the Claude app (Claude Code on the web, on
a computer), with the prompt and your fork filled in, using the link
[Claude Code documents for this](https://code.claude.com/docs/en/web-quickstart#pre-fill-sessions).
Nothing is sent until you press send there. A cloud session can only push where your GitHub
account can, so the first time it asks for your GitHub username and helps you fork the repo.
Share sits beside Copy, so the prompt can go to any app without the clipboard. This hasn't been
tried on every phone, so the prompt is always copied as well.

## Is this allowed by my AI plan?

Rainshare isn't plan sharing, and it isn't a proxy. Whether your plan allows helping this way
is between you and your provider, and we can't tell you, so read its terms. Your provider decides what its terms allow, not
Rainshare, and if it limits or closes your account over how you used it here, that's on you.
Agreeing to Rainshare's terms includes saying you accept that.

As of November 2026 the big plans rule out sharing your account and reselling access to it (see
Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) and
[Claude Code's terms](https://code.claude.com/docs/en/legal-and-compliance), and OpenAI's
[Terms of Use](https://openai.com/policies/row-terms-of-use/)). Rainshare does neither:

- You run your own agent, signed in as you. Nobody else gets your login, and Rainshare never sees
  it. It only signs in to your atproto account.
- What you hand over is a pull request, the same as contributing to any open-source project.
- Nobody gets paid. There are no credits or tips, so nothing is being resold.
- You choose each job and start the agent yourself.

That's also why Rainshare won't run agents on its own servers, hold anyone's AI login, pay
helpers, or work through asks unattended. Your plan's usage policy still applies to whatever your
agent does, whoever asked for it, so only take on work you'd be happy doing for yourself.

## What your agent gets

However you hand it over, your agent gets the same brief (`core/brief.js`): where the code is,
who's on it so far, the ask itself, what Rainshare's checks flagged in it, how to turn it in, and
when you said you would. The ask is framed as another person's request, not as instructions, and
sits between markers the asker can't forge.

| Route | Needs | Who turns it in |
| --- | --- | --- |
| Copy the prompt into any agent | nothing | you, with the link the agent hands back |
| Open it in the Claude app or Claude Code on the web (GitHub only) | a Claude plan with cloud sessions, and GitHub connected | you, with the same link |
| One command: `git clone … && claude "<brief>"` (or `codex`) | that agent's CLI | you, with the same link |
| `rainshare.mjs run <link>` | the CLI and an app password | the CLI, once the agent exits |
| The MCP server | the CLI and an app password | the agent, with `rainshare_turn_in` |

The link an agent hands back looks like
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`, and fills in the turn-in
form for you.

## The CLI and MCP server

`rainshare.mjs` is one file with no dependencies. It works as a CLI and as an MCP server. Its page
on the site is [rainshare.dev/agents](https://rainshare.dev/agents).

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs doctor                    # what's set up here, and what will work
node ~/.rainshare.mjs login you.bsky.social     # signs in with an app password
node ~/.rainshare.mjs board                     # open asks, best fit for you first
node ~/.rainshare.mjs run <link>                # take it, clone, start your agent, turn it in
node ~/.rainshare.mjs help                      # everything else
```

To use it from Claude Code:

```sh
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` stop if someone else is on the ask or a pull request is open (`--anyway` goes
ahead regardless). The app password is saved to `~/.config/rainshare`, or set
`RAINSHARE_HANDLE` and `RAINSHARE_APP_PASSWORD`. Without a sign-in the read-only tools still work.

## Safety

Almost everything Rainshare shows was written by someone else, so nothing from the network is
trusted.

- **The brief keeps the ask in its place.** The rules around the asker's words tell the agent to
  stop and ask before reaching outside the repo, touching secrets, running code from elsewhere,
  or keeping anything from you. Comments never go into the brief.
- **Every ask is checked** (`core/scan.js`) for the usual tricks: fake system messages, hidden
  characters, reaching for SSH keys or credentials, piping a download into a shell, turning off
  permission prompts, and asks for malware or phishing. What's found is shown to helpers, to the
  asker, in the brief, and to @rainshare.dev. It's a smoke alarm, not a lock, so read the ask.
- **Invisible characters are stripped** from briefs and from everything the CLI and MCP server
  print, so nothing can hide instructions in plain sight or rewrite your terminal.
- **Everything is escaped and validated.** Record URIs are rebuilt from what was asked for,
  values are escaped before they reach the page, links must be http(s), a Content Security Policy
  blocks inline scripts, and anything passed to a shell is single-quoted.
- **Blocks and moderation count.** Takes, turn-ins and comments from people you've blocked on
  Bluesky are hidden. @rainshare.dev can hide an ask, a record or an account, and the brief for a
  hidden ask says only that.
- **The community guidelines say what fits.** [`/guidelines`](https://rainshare.dev/guidelines)
  (written in `core/legal.js` beside the terms, and `rainshare guidelines` in the CLI): work on
  something you'll build, share or maintain; no paid work passed on to helpers, such as bug
  bounties or client work; no hunting for security holes in software that isn't yours. Two of the
  checks look for the last two (`paid` and `vuln-hunting` in `core/scan.js`), and "Against the
  guidelines" is one of the reasons a hide can give.
- **Nobody reads an ask before it's on the board.** @rainshare.dev only says how many new asks
  there are, once a day, tagging a few of the people who asked and giving no titles, so nothing it
  posts or sends waits for a person. Read every ask yourself before your agent does.

A repo you clone can carry its own agent config (`CLAUDE.md`, hooks, `.mcp.json`), so look before
you trust a folder you haven't seen.

## How it's built

### Records

Everything is an atproto record in its owner's own account, under `dev.rainshare.*`. The schemas
are in `lexicons/dev/rainshare/`.

| Record | Written by | Holds |
| --- | --- | --- |
| `dev.rainshare.seed` | the asker | an ask: title, where the work is (an issue, a repo, or none for an idea), the spec in Markdown, preferred models, state |
| `dev.rainshare.take` | a helper | "my agent is on this", and `until`, the day they expect to turn it in |
| `dev.rainshare.delivery` | a helper | the pull request, what did the work, and an optional session link |
| `dev.rainshare.comment` | anyone | a comment on an ask, or a reply to one |
| `dev.rainshare.profile` | everyone | AI plans, the agents you run, and an optional Rainshare-only name and bio |
| `dev.rainshare.preferences` | you | your settings, which messages you'd like, and that you agreed to the terms. Public, like every record in your repo |
| `dev.rainshare.moderation` | @rainshare.dev only | something Rainshare has hidden, and why |

The feedback board's records are userinput.app's own (`app.userinput.*`), so the same board shows
on both sites: see **Feedback** below.

The records use garden words the site doesn't show: an ask is a `seed`, and a finished one is
`sprouted`. Nobody can delete someone else's take, so a take lapses once its `until` has passed
with nothing turned in (`core/takes.js`). Gardens aren't stored anywhere: `core/garden.js` works
them out from two records that have to agree, the helper's delivery and the asker's record naming
it, so nobody can add to their own.

Sign-in asks for these records through a permission set, `dev.rainshare.authFull`, and falls back
to asking for them by name. It asks the same way for userinput.app's `app.userinput.authBasic`
(posting, replying, voting and editing on the feedback board), and @rainshare.dev and @dame.is
(`BOARD_MODERATORS` in `core/ns.js`) get `app.userinput.authFull`, which adds running the board.
Tangled and knotless permissions are asked for separately, with a checkbox for each, and so is
creating a Bluesky follow, for switching on messages.

What a server grants is fixed at sign-in, so a sign-in from before Rainshare asked for something
goes on without it. `missingFrom` in `src/scope.js` says what a granted scope is short of. The app
then offers **Sign in again** once a visit, and keeps it in the menu under your face until you do.
Changing what sign-in asks for is enough for everyone to be asked again.

### No index server for the site

The board is read straight from the network, in your browser (`core/source.js`, `core/net.js`). A
relay lists the accounts that hold `dev.rainshare.*` records, their records come from each
account's own PDS, and names, avatars and follows come from Bluesky's AppView. An ask's page uses
[Constellation](https://constellation.microcosm.blue) to find the takes, deliveries and comments
that point at it. That's a request per person taking part: fine at dozens of people, and the part
to replace with an index at thousands.

That index exists for @rainshare.dev already: [`indexer/`](indexer) keeps every `dev.rainshare.*`
record in Supabase, from Jetstream, reconciled against every repo every six hours. The announcer
reads the board from it while its heartbeat is fresh. The site doesn't use it yet. [`indexer/README.md`](indexer/README.md) has the rest.

`core/status.js` combines Rainshare's records with what the forge says (is the issue closed, was
a pull request merged) to work out where an ask stands. The board asks it about every open ask
once it's on screen, two at a time, and keeps the answers in the browser for half an hour. Nothing
closes automatically: whether a pull request did the job is the asker's call.

### Forges

- **GitHub.** Issue and pull request state comes from GitHub's public API, which gives a browser
  that isn't signed in 60 requests an hour. The board asks about each open ask on GitHub at most
  once every half hour: its issue, and its repository's recent pull requests, which asks on the
  same repository share.
- **Tangled.** Uses the `org.tangled.*` API from Tangled's relaunch on 30 October 2026. Reading an
  issue's comments uses `org.tangled.feed.listComments`, which Tangled hasn't published a
  definition for yet. Tangled has no CLI for pull requests, so the agent pushes a branch and
  Rainshare opens the pull request as you.
- **knotless.** The brief gives the agent knotless's own commands to fork, push and open the pull.
- **Anything else.** Any git repo URL works as a project.

On Tangled and knotless, Rainshare only posts as you (an issue, a comment, a pull request) when
you press a button that says so. The scopes are `FORGE_SCOPES` in `core/ns.js`.

### Layout

| Path | What's there |
| --- | --- |
| `index.html`, `src/main.js` | the page, its routes, who's signed in, and the bell |
| `src/landing/` | the home page and its 3D garden (three.js, only loaded there) |
| `src/plants/`, `src/logo/` | the 3D plants, and the animated logo |
| `src/signin.js`, `src/oauth.js`, `src/scope.js` | signing in, and what it asks for |
| `ui/` | the app's screens |
| `core/` | everything the site and the CLI share. Each file starts with a comment saying what it does |
| `cli/rainshare.mjs` | the CLI and MCP server |
| `api/` | Vercel functions: the OAuth client metadata, and link previews |
| `announcer/`, `indexer/`, `droplet/` | @rainshare.dev's daily post and messages, the index of every record, and how they're deployed |
| `lexicons/` | the record schemas and permission set, and the scripts that publish and check them |
| `supabase/` | the ledger of who agreed to the terms, and the index |
| `scripts/` | the image scripts, `feedback.mjs` and `announce.mjs` |
| `test/` | `npm test` |

## Development

```sh
npm install
npm run dev              # the site, at http://127.0.0.1:5173
npm test                 # node --test, no extra dependencies
npm run build            # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli        # just the CLI, at dist-cli/rainshare.mjs
npm run lexicons:check   # compare the lexicons with what's published, without writing
```

Open the dev server at `127.0.0.1`, not `localhost`: sign-in in dev uses atproto's loopback OAuth
client, which needs the IP.

`/example` is a made-up board, kept in your browser, for trying things without writing anything.
Nothing in the app links to it, since its pages look enough like real ones to be taken for them.

Some images are drawn from code: `npm run plants`, `logo`, `og`, `still`, `bluesky` and `promo`.
Re-run the one you need after changing what it draws (`still` is the landing's garden held still,
shown while its scene loads and where a browser can't draw it). On the dev server, `src/plants/sheet.html` and
`src/logo/sheet.html` show every plant and the logo at every size.

Some features are built but switched off for the alpha, in `core/ns.js`: private asks in a group
space (`GROUPS`), and `FEATURES` such as who can see an ask and how well an ask suits you. The CLI
still ranks by fit. To change the "alpha" label, update `STAGE` there and the badge in
`index.html`.

## Deploying

rainshare.dev is a Vercel project on this repo (`vercel.json`), with `npm run build`.

1. **Set the site address.** Set `RAINSHARE_SITE=https://rainshare.dev` for Production, then
   redeploy. Every link Rainshare writes starts from it. Without it, links use
   `https://rainshare.vercel.app`.
2. **Let the build publish the lexicons.** They belong to @rainshare.dev
   (`did:plc:cmkittusvczhnei4gjt3asiv`, `OWNER` in `lexicons/compat.mjs`). Set an app password for
   it as `RAINSHARE_LEXICON_APP_PASSWORD` (Production only, sensitive), and add a TXT record at
   `_lexicon.rainshare.dev` with `did=did:plc:cmkittusvczhnei4gjt3asiv`.

Every production build then publishes any schemas that changed, and never deletes one. A breaking
change (removing or renaming a field, changing a type, a limit or what's required) fails the build;
use a new NSID instead. If nobody has written records under the published schema yet,
`RAINSHARE_LEXICON_ALLOW_BREAKING=1` lets one through.

`@vercel/og` is pinned to 0.11.1, because 1.0.3 doesn't load as an ES module in Node.

The announcer, which posts once a day from @rainshare.dev to say how many new asks there are
and sends the messages people ask for, runs on a droplet beside the index, and both
deploy themselves when `main` changes. See
[`announcer/README.md`](announcer/README.md) and [`droplet/README.md`](droplet/README.md).
`npm run announce` shows what it would post and send right now, without doing either.

## Running Rainshare

- **Moderation.** Signed in as @rainshare.dev, **Moderation** (`/admin`) in the menu hides an ask,
  a record or an account, and lists asks the checks flagged. Each decision is a public
  `dev.rainshare.moderation` record in @rainshare.dev's repo, and only that repo's are read, so it
  needs no server of its own. Write notes that are fine for anyone to read. See
  `core/moderation.js`.
- **What @rainshare.dev shares.** Once a day, after 15:45 UTC, it posts how many new asks there
  are on the board, tagging up to three of the people who asked and asking readers to help, and
  sends the same count to people who asked for it by direct message. Neither gives an ask's
  title, so nobody approves them first. Hiding an ask (or its asker) on the moderation page keeps
  it out of the count, and takes down a post that tagged them: the next run posts that day's
  again without them. Until 20 November 2026 it posted asks one by one after a person said yes by
  direct message; that review, and its queue in the index, are gone. See
  `announcer/src/posts.js`.
- **Leaving someone out of the index.** When someone asks for their records to be kept out of
  Rainshare's copy (the Privacy Policy says they can), add their DID to `rainshare_index_excluded`
  in Supabase. The database deletes what the index has of theirs and turns the rest away.
  [`indexer/README.md`](indexer/README.md) has the SQL, and what it means for them.
- **Release notes** go at the top of `core/releases.js`, which says how to write one. They show in
  everyone's bell for 30 days and on [What's new](https://rainshare.dev/releases) for good, so ask
  the maintainer before adding one.
- **Feedback** is
  [Rainshare's board on userinput.app](https://userinput.app/s/did:plc:cmkittusvczhnei4gjt3asiv/3n2eeq4jt3s2w),
  pinned by its record key (`SPACE_KEY` in `core/feedback.js`). People post, vote and reply on
  `/feedback` itself (`ui/feedback.js`), and what they write is userinput.app's own records in
  their own accounts, so both sites show the same board. Its moderators set statuses, hide posts
  and replies, ban people, and pin and lock posts from a post's page. Signed in as @rainshare.dev,
  **Run the board** appoints moderators (one tap for @dame.is) and changes the board's name,
  description and categories. A moderator's records only count once the owner has appointed them.
  A Claude Code routine on the maintainers' own plan turns posts a maintainer has marked planned
  into draft pull requests, and a person reviews each one (`.claude/skills/feedback/SKILL.md`).
  `node scripts/feedback.mjs` reads the board and sets statuses.
- **Terms and privacy** are written once, in `core/legal.js`, and shown at `/terms` and `/privacy`.
  Rainshare is operated by atpotato, LLC. People agree to the Terms before their first job or
  first ask, and that's kept in their own settings record and in a ledger at Supabase
  (`core/agreement.js`, `supabase/`). The Privacy Policy is a notice with a date of its own
  (`PRIVACY_UPDATED`), and nobody is asked to agree to it. Change `LEGAL_VERSION` to ask everyone
  again, and do it whenever the Terms' meaning changes: agreement is matched on that string
  alone. Disputes go to small-claims court or the courts in Delaware; there's no arbitration. `test/legal.test.mjs` checks the
  Privacy Policy against what the code does. The ledger's function is deployed with
  `supabase functions deploy rainshare-agree --no-verify-jwt`.

## Not tried for real yet

- The announcer on the droplet: nothing has been posted or sent from @rainshare.dev yet.
- Moderating as @rainshare.dev, and the feedback routine end to end in a scheduled session.
- Posting, voting and moderating on the feedback board with real accounts (it's been driven in a
  browser against a fake network), and signing in again on a real server.
- Posting an issue, comment or pull request to Tangled or knotless as a real user.
- `rainshare.mjs run` end to end with a real agent.
- Making an account all the way through, and following @rainshare.dev when messages are switched
  on.
- Reading a real Tangled vouch circle, and private asks in a real group space.

## Similar ideas

Rainshare isn't the first go at putting spare capacity to work for other people. Some others:

- [Overflow](https://github.com/Nitjsefnie/Overflow) is a shared ledger for open-source work.
  You spend leftover AI plan usage on issues in registered repos, earn points when your pull
  request merges, and spend them to get issues in your own repos done.
- [Iynx](https://github.com/amit221/Iynx) puts unused Cursor tokens to work by itself, fixing
  issues in popular GitHub repos.
- [co/core](https://cocore.dev) is an AI cooperative whose members share the Macs they already
  own to run open models for each other.
- [HelpPeer](https://help-peer.com) has people point their own agents at public datasets, and
  sends the values their agents agree on to the project as a pull request.
- Before AI plans, [BOINC](https://boinc.berkeley.edu) put people's idle computers to work on
  science projects, and [Up For Grabs](https://up-for-grabs.net) lists issues that projects have
  set aside for new contributors.

## License

MIT. See [LICENSE](LICENSE).
