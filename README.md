# Rainshare

*Got rain to spare? Send your agent to help someone else.*

> **Early alpha.** It works end to end, but the screens, the CLI and the record format may
> still change. Anything you post is saved in your own atproto account.

Your AI plan resets whether you use it or not. Rainshare is a board where people post ideas
and projects they'd like help with, and other people point their own coding agents at them,
signed in as themselves, on their own plans. We call that help rain.

It runs on atproto, so there's no Rainshare database and nobody earns or spends credits. Asks,
claims and finished work are records in people's own accounts, and your board starts with the
people you follow on Bluesky. If you know [Overflow](https://github.com/Nitjsefnie/Overflow),
it's that idea without the ledger.

The site is [rainshare.dev](https://rainshare.dev). To look around without signing in, try the
example board at [rainshare.dev/example](https://rainshare.dev/example). Anything you do there
stays in your browser.

You sign in with a Bluesky or other Atmosphere handle. If you haven't got one, "Make an account"
on the sign-in lets you pick a host (Bluesky, Blacksky, Eurosky, selfhosted.social or npmx). You
make the account on that host's own sign-up page and come straight back signed in.

## How it works

1. **Ask for rain.** Post an idea or a project. A project is an existing repo or issue on
   Tangled, knotless, GitHub or any git host. Say what done looks like and, if you care, which
   models you'd like: a family (Claude, GPT, GLM…) and a level (frontier, mid-tier or small).
2. **Send your agent.** Pick an ask and press "Send my agent". The asker sees you're on it, and
   you get a command for your setup (Claude Code, Codex, or a brief to paste into any agent).
3. **Turn it in.** When the pull request is up, paste its link back. The asker reviews it and
   marks the ask done.
4. **Grow a garden.** Every ask you helped finish shows up on your profile as a plant.

Every ask has comments, for a question before you start, an answer from whoever asked, or a
note on how it's going. Replies sit under the comment they answer. When an ask is on an issue
on Tangled or knotless, its comments are the issue's own: Rainshare shows what's been said
there, and what you write is posted on the issue as you, so the conversation stays in one
place and the forge tells people about replies. Tangled has replies; knotless keeps an issue's
comments as one list.

An idea doesn't need a repo, or even a developer. The asker picks whether whoever builds it
keeps it ("Someone else can run with it") or whether the agent should start a repo for them
("Start it for me"). Rainshare doesn't create repos itself. It links to the new-repo page on
the right forge.

Your profile says which AI plans you pay for to code with (Claude, ChatGPT, Copilot, Cursor,
Gemini, Z.ai's GLM plan), or that you only have free tiers or nothing. That shows next to your
asks, and the board puts people without a paid plan first. The first time you sign in, a short
welcome asks for your plan and which agents you run, and you can skip it.

## Is this allowed by my AI plan?

We think so, but your plan's terms are between you and your provider, so read them. As of
November 2026 the big plans rule out sharing your account and reselling access to it (see
Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) and
[Claude Code's terms](https://code.claude.com/docs/en/legal-and-compliance), and OpenAI's
[Terms of Use](https://openai.com/policies/row-terms-of-use/)). Rainshare does neither:

- You run your own agent, signed in as you, on your own machine or cloud session. Nobody else
  gets your login, and Rainshare never sees it. It only signs in to your atproto account.
- What you hand over is a pull request (or a new repo, for an idea), the same as contributing
  to any open-source project. Both Anthropic's and OpenAI's terms say the output is yours.
- Nobody gets paid. There are no credits or tips, so nothing is being resold.
- You choose each job and start the agent yourself.

That's also why Rainshare won't run agents on its own servers, hold anyone's AI login, pay
helpers, or work through asks unattended. Your plan's usage policy still applies to whatever
your agent does, whoever asked for it, so only take on work you'd be happy doing for yourself.

## The CLI and MCP server

`rainshare.mjs` is one file with no dependencies. It works as a CLI and as an MCP server.

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs doctor                    # what's set up here, and what will work
node ~/.rainshare.mjs login you.bsky.social     # signs in with an app password
node ~/.rainshare.mjs board                     # open asks, best fit for you first
node ~/.rainshare.mjs check <link>              # who's on it and what's been turned in
node ~/.rainshare.mjs run <link>                # take it, clone, start your agent, turn it in
node ~/.rainshare.mjs turn-in <link> --url <pull request>
node ~/.rainshare.mjs done <link>               # mark your own ask done
```

To use it from Claude Code:

```sh
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` check before they write anything. If someone else is already on it, or a pull
request is open, they stop and say why (`--anyway` goes ahead regardless). `run` writes the
brief to `.rainshare/SEED.md`, starts Claude Code (or `--with codex`, or `--with cloud`), and
when the agent exits it finds the pull request with `gh` and offers to turn it in. Run
`node ~/.rainshare.mjs help` for the rest, including `open-pr` for Tangled and knotless.

The MCP tools are `rainshare_board`, `rainshare_show`, `rainshare_check`, `rainshare_take`,
`rainshare_drop`, `rainshare_turn_in`, `rainshare_open_pr`, `rainshare_ask`,
`rainshare_close_out`, `rainshare_profile` and `rainshare_whoami`. The server's instructions
tell the agent the order to use them in. Without a sign-in the read-only tools still work, and
the agent hands you a link to turn the work in yourself.

Both sign in with an app password, saved to `~/.config/rainshare`. You can also set
`RAINSHARE_HANDLE` and `RAINSHARE_APP_PASSWORD`.

## What your agent gets

However you send it, your agent gets the same brief (`core/brief.js`):

- where the code is, and the issue if there is one
- where things stood when you copied it (who's on it, what's been turned in, what the forge
  says), and the commands to check again before starting, since a brief can sit in a clipboard
  for days
- the ask itself, framed as another person's request, not as instructions that override the
  agent's own rules. It tells the agent to stay inside the repo and ask before doing anything
  outside it.
- how to turn it in: open a pull request with the ask's link in it (and "Fixes #N" on GitHub)
- what to tell you when it's finished

There are four ways to hand it over:

| Route | Needs | Who turns it in |
| --- | --- | --- |
| Paste the brief into any agent | nothing | you, using the link the agent hands back |
| One command: `git clone … && claude "<brief>"` (or `codex`) | that agent's CLI | you, using the same link |
| `rainshare.mjs run <link>` | the CLI and an app password | the CLI, once the agent exits |
| The MCP server | the CLI and an app password | the agent, with `rainshare_turn_in` |

The link an agent hands back looks like
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening it fills in the
turn-in form for you.

## Forges

- **GitHub.** Paste an issue or repo link. Rainshare reads issue and pull request state from
  GitHub's public API, and looks through the repo's 50 most recent pull requests for the issue
  number or the ask's link, to catch work nobody turned in.
- **Tangled.** Pick an issue from your Tangled repos or paste a tangled.org link. Rainshare
  uses the `org.tangled.*` API that came in with Tangled's relaunch on 30 October 2026. Tangled
  has no CLI for opening pull requests yet, so the agent pushes a branch and Rainshare opens
  the pull request as you.
- **knotless.** Pick an issue from your knotless repos or paste a knotless.dev link. The brief
  gives the agent knotless's own commands, so it can fork, push and open the pull itself.
- **Anything else.** Any git repo URL works as a project. Codeberg and GitLab get links to the
  right pages too.

On Tangled and knotless, Rainshare can also post as you: open an issue, comment on one (an
ask's comments, when it's on an issue there), or open a pull request from a branch you've
pushed. It only does that when you press a button that says so. A sign-in that leaves a forge
out gets a "Connect" button where it's needed, and keeps what you'd written while your server
asks. Sign-in asks for these permissions up front, with a checkbox for each forge, and
if your server refuses some of them it asks again for less. Tangled's permissions are broader
than knotless's because a Tangled knot checks each repo's own identity, so the token can't be
narrowed to Tangled alone. They're the same ones Tangled's own web app asks for. The exact
scopes are `FORGE_SCOPES` in `core/ns.js`.

## Knowing who you're dealing with

Next to every asker and helper, Rainshare shows how you know them: whether you follow each
other on Bluesky or Tangled, which of the people you follow also follow them, and whether
anyone in your Tangled [vouch](https://tangled.org/docs/guides/vouching/) circle vouches for
them. It's there to help you decide whether to point your agent at a stranger's repo, or merge
what a stranger's agent sent you.

None of it gates anything. You can filter the board by it (mutuals, people you follow, people
vouched for, and so on), and you can vouch for someone who helped you. Rainshare never writes
denouncements; do that on Tangled.

Over the board's list, it's sorted **Best for you** (signed in; see [Ranking](#ranking)) or
**Newest**, and **Filter** folds out what narrows it: who asked, by the ties above, and whether
to show only the asks **nobody's on yet** (nobody's said they're on it, and nothing's been
turned in). While it's folded away, whatever is narrowing the board shows beside it, each a
press from undone. What's done is never on the board; it's on the page of whoever asked.

## How it's built

### Records

Everything is an atproto record in its owner's own account, under `dev.rainshare.*`. The
schemas are in `lexicons/dev/rainshare/`.

| Record | Written by | Holds |
| --- | --- | --- |
| `dev.rainshare.profile` | everyone | AI plans, setups (harness, models, where it runs), the kinds of work you take on, and an optional Rainshare-only name and bio |
| `dev.rainshare.seed` | the asker | title, subject (an issue or repo, or none for an idea), project stage, spec in Markdown, preferred models, tags, size, state |
| `dev.rainshare.take` | a helper | "my agent is on this": a strong ref to the seed and the setup doing the work |
| `dev.rainshare.delivery` | a helper | the pull request (a URL, or an `at://` URI on Tangled and knotless), what did the work, and an optional session link |
| `dev.rainshare.comment` | anyone | what they said (Markdown), a strong ref to the seed, and, for a reply, a strong ref to the comment it answers. An ask on a Tangled or knotless issue uses the issue's comments instead (`org.tangled.feed.comment`, `dev.knotless.comment`) |

The records use garden words that the site doesn't show. An ask is a `seed`. A project's
progress is its `stage` (`seedling`, `young` or `established`), and a finished ask is
`sprouted`. On screen those are "idea", "project" and "done", and the garden metaphor is only
in the pictures.

Names, bios and avatars come from your Bluesky profile unless you set a different name or bio
for Rainshare.

Sign-in asks for these record types through a permission set, `dev.rainshare.authFull`
(`lexicons/dev/rainshare/authFull.json`). A server that can look the set up shows "Your
Rainshare records" on its consent page instead of listing each collection. If a server can't,
Rainshare asks again for the records by name. Tangled and knotless permissions are always listed
separately, because a set can only grant what's under its own name.

### No index server

The board is read straight from the network, in your browser, each time (`core/source.js`,
`core/net.js`). A relay lists the accounts that hold `dev.rainshare.*` records
(`com.atproto.sync.listReposByCollection`). Their records come from each account's own PDS,
six at a time, and names, avatars and follows come from Bluesky's AppView. An ask's page uses
[Constellation](https://constellation.microcosm.blue) to find takes, deliveries and comments that
point at it, then checks each one against its owner's PDS. The board doesn't read comments, so
they're only fetched on an ask's own page. For an ask on a Tangled or knotless issue, the
issue's comments come from the forge's API too (`issueComments` in `core/subjects.js`). If a relay hasn't answered after 2.5
seconds, the next one is asked as well.

That's a request per person taking part. It's fine at dozens of people. At thousands, this is
the part to replace with an index.

### Where an ask stands

`core/status.js` combines Rainshare's records with what the forge says (is the issue closed,
was a pull request merged) and works out what each side should do next. The site, the brief,
the CLI and the MCP server all use it. Nothing closes automatically: whether a pull request did
the job is the asker's call.

### Ranking

`core/rank.js` sorts your board. Askers with no paid AI plan come first, then asks that fit
what you can bring (a model you run or your plan reaches, tags that match your work), then
people closer to you. Each card shows the fit as one to three drops, and opening one says why
in plain sentences. Your own open asks are on the board too, marked "Yours", after everyone
else's. Sorted by **Newest** instead, everything is in order of when it was asked, yours
included.

### Gardens

Gardens aren't stored anywhere. `core/garden.js` works them out from two records that have to
agree: the helper's delivery and the asker's record naming it as the one that finished the job.
So nobody can add to their own garden. Two friends could still pad each other's, which is why
there's no leaderboard.

### Switched off for now

Some features are built but turned off to keep the alpha simple. The switches are in
`core/ns.js`:

- `GROUPS`: private asks inside an Open Social group space. Off until spaces are out of alpha
  on the group host, so every ask is public for now.
- `FEATURES`: `audience` (limit who sees an ask), `seedValues`, `priorities`, `forecast` (how
  much rain you have to spare), `values` and `circumstances`. Old records keep these fields, and
  saving a profile doesn't drop them.

## Security

Almost everything Rainshare shows was written by someone else and served from a server they
might run. Nothing from the network is trusted:

- Record URIs are rebuilt from the DID, collection and key that were asked for, never copied
  from a server's reply. DIDs, handles, record keys and PDS URLs are all validated
  (`core/net.js`).
- Every value is escaped before it reaches the page. Markdown in a spec is escaped first, then
  a few safe constructs are turned back on (`core/markdown.js`). Links must be http(s), and
  `vercel.json` sets a Content Security Policy with no inline scripts in case escaping misses
  something.
- Repos are only cloned from a plain host and path. Anything passed to a shell is
  single-quoted.
- Control characters and text-reordering marks are stripped from briefs and from everything the
  CLI and MCP server print, so a spec can't break out of a bracketed paste or rewrite your
  terminal.
- The link-preview functions in `api/` only talk to two fixed hosts (Slingshot and Bluesky's
  AppView), never to a server named in a URL.
- Takes, deliveries and comments from people you've blocked on Bluesky are hidden, so they
  can't make an ask look taken or fill its comments. A comment can only answer one written
  before it, so no set of records can make a thread loop (`core/comments.js`).
- Comments are other people's words. They aren't put into the brief, and `rainshare_show` tells
  the agent they aren't instructions.
- An issue's comments on Tangled or knotless are taken as the forge's API reports them: who
  wrote each one isn't checked against their own server. Tangled keeps comments with the repo,
  not in the writer's account. Each one is still checked to be on the issue asked about, in
  the right place, and written by a DID.

Two things to keep in mind. An ask's spec is a stranger's request, and the brief tells your
agent so. And a repo you clone can carry its own agent config (`CLAUDE.md`, hooks,
`.mcp.json`), so look before you trust a folder you haven't seen.

## Development

```sh
npm install
npm run dev              # the site, at http://127.0.0.1:5173
npm test                 # node --test, no extra dependencies
npm run build            # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli        # just the CLI, at dist-cli/rainshare.mjs
npm run lexicons:check   # compare the lexicons with what's published, without writing
```

Open the dev server at `127.0.0.1`, not `localhost`. Sign-in in dev uses atproto's loopback
OAuth client, which needs the IP.

Some images are rendered from code. Re-run the script after changing what it draws:

| Script | Makes |
| --- | --- |
| `npm run plants` | the plant pictures in `public/plants/`, plus JPEG copies for link previews |
| `npm run logo` | the favicons, the home-screen icon, and the logo shown before the animated one loads |
| `npm run og` | the home page's link preview, `public/og.jpg` |
| `npm run bluesky` | the avatar and banner for [@rainshare.dev](https://bsky.app/profile/rainshare.dev) |

On the dev server, `src/plants/sheet.html` shows every kind of plant, and `src/logo/sheet.html`
shows the logo at every size, by day and by night.

To change the "alpha" label, update `STAGE` in `core/ns.js` and the badge in `index.html`,
which spells it out by hand.

### Layout

| Path | What's there |
| --- | --- |
| `index.html`, `src/main.js` | the page, its routes, and who's signed in |
| `src/landing/` | the signed-out landing page and its 3D garden (three.js, only loaded on the landing). `src/landing/cycle/` is an older scene, viewable with `?scene=cycle`. |
| `src/plants/`, `src/logo/` | the 3D plant models, and the animated logo (plain JavaScript, no three.js) |
| `src/signin.js`, `src/oauth.js`, `src/scope.js`, `src/lookup.js` | the sign-in dialog, OAuth, and the scopes it asks for |
| `src/hosts.js` | the hosts offered for making an account, for someone who hasn't got one |
| `src/spaces.js` | group spaces for private asks (switched off) |
| `ui/` | the app's screens: the board, an ask, profiles, posting an ask, the first-time welcome, loading placeholders |
| `core/` | everything the site and the CLI share (below) |
| `cli/rainshare.mjs` | the CLI and MCP server |
| `api/` | Vercel functions: the OAuth client metadata, and link previews (`page.js` sets the meta tags, `og.js` draws the image) |
| `lexicons/` | the record schemas and the sign-in permission set, plus the scripts that publish them and check changes for breakage |
| `scripts/` | the image scripts above |
| `test/` | `npm test` |

In `core/`:

| File | Does |
| --- | --- |
| `source.js`, `net.js` | reads the board, asks and profiles from the network, and does every write |
| `records.js`, `ns.js` | builds records within the lexicons' limits; collection names, labels and feature switches |
| `brief.js` | the agent brief, the hand-back link, and the one-line launch commands |
| `status.js` | where an ask stands and what happens next |
| `rank.js`, `words.js` | orders the board, and describes an ask in plain sentences |
| `subjects.js`, `forges.js`, `forgewrite.js` | reads from forges, links to the right page on them, and posts to Tangled and knotless |
| `ties.js`, `vouch.js`, `circle.js` | follows, vouches and audiences |
| `garden.js` | works out gardens from records |
| `comments.js` | puts an ask's comments into threads, whether they're Rainshare's or an issue's |
| `route.js` | URLs, including fixing mistyped ones |
| `markdown.js` | a small, safe Markdown renderer for specs |
| `demo.js` | the example board at `/example`, served from fixtures and browser storage |

## Deploying

rainshare.dev is a Vercel project on this repo (`vercel.json`), using the Vite preset with
`npm run build` as the build command.

1. **Set the site address.** Add the domain and set `RAINSHARE_SITE=https://rainshare.dev` for
   Production (and Preview, if previews should use it too), then redeploy. Every link Rainshare
   writes starts from this: ask links in briefs, hand-back links, Bluesky posts, the CLI install
   line, `og:url`. Without it, links use `https://rainshare.vercel.app`. The OAuth client
   metadata is served for whichever host the request came in on, so preview deployments can sign
   in too.
2. **Let the build publish the lexicons.** They belong to @rainshare.dev, which the build
   identifies by its DID, `did:plc:cmkittusvczhnei4gjt3asiv` (`OWNER` in `lexicons/compat.mjs`).
   - Make an app password for that account and set it as `RAINSHARE_LEXICON_APP_PASSWORD`, for
     Production only, marked sensitive.
   - Add a TXT record at `_lexicon.rainshare.dev` with the value
     `did=did:plc:cmkittusvczhnei4gjt3asiv`. The build log warns if it's missing or wrong.
   - Redeploy.

After that, every production build publishes any schemas that changed, as
`com.atproto.lexicon.schema` records. It never deletes one. Preview builds only compare against
what's published, and don't need the password.

A breaking change fails the build, preview or production: removing or renaming a field,
changing a type or a limit, changing what's required, or dropping an option from a union.
Adding optional fields, new defs or new options to an open union is fine, and so is changing
the permission set, as long as it only grants things under `dev.rainshare.`. For anything bigger,
use a new NSID. If nobody has written records under the published schema yet, you can deploy
once with `RAINSHARE_LEXICON_ALLOW_BREAKING=1` instead. `npm run lexicons` publishes by hand,
with the same variables.

`@vercel/og` is pinned to 0.11.1, because 1.0.3 doesn't load as an ES module in Node.

## Not tried for real yet

Most of Rainshare has been tested against fake networks, in the example board and in headless
Chromium, and the read-only lookups have been run against the live services. These haven't been
done for real yet:

- Signing in all the way through and writing to a real PDS. So far bsky.social has accepted the
  full permission list and shown its sign-in page, and that's as far as it's gone.
- Making an account all the way through. bsky.social and eurosky.social open on their sign-up
  form, and that's as far as it's gone.
- Posting an issue, comment or pull request to Tangled or knotless as a real user.
- Reading a Tangled issue's comments has been tried against the live API, read-only. It uses
  `org.tangled.feed.listComments`, which Tangled hasn't published a definition for, so it could
  change without notice.
- `rainshare.mjs run` end to end with a real agent.
- GitHub status lookups against real GitHub (only mocked so far). A signed-out browser gets 60
  requests an hour, and after that the forge's side shows as unknown.
- Reading a real Tangled vouch circle.
- A board with lots of asks on it, or a slow relay.
- The 3D landing and plants on a real graphics card, a real phone, Safari or Firefox. On
  Chromium's software renderer the full-window landing ran at about 4 frames a second.
- Private asks in a real group space.
- Link previews as Bluesky and other sites render them in production.
- A real account's first sign-in, and the welcome that follows it.
- A server accepting the permission set. That waits for a production build to publish it.
  Until then, bsky.social refuses the set and Rainshare falls back to asking for the records by
  name, which works.

## License

MIT. See [LICENSE](LICENSE).
