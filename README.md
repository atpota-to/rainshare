# Rainshare

*Got rain to spare? Your friends' seeds and plants could use it.*

AI plans reset whether you use them or not. On Rainshare, the people you trust share what
they're growing: a seed is an idea with nothing built yet, and a plant is a project that
exists and needs a hand. The agent usage you have left over is the rain. It's an
atproto-native, social take on [Overflow](https://github.com/Nitjsefnie/Overflow): no ledger
and nothing to spend, just your circle.

- **Plant something**, in five short steps with a preview beside them: which it is (a seed,
  or a plant at one of three stages, each with its own little 3D plant), where a plant lives
  (a Tangled, knotless or GitHub issue, or any git repo), what done looks like, how (models,
  tests, size), and who it's for: public for your mutuals (or people you follow, your
  followers, a Bluesky list, everyone), with a count of roughly who that reaches, or private
  to a group. Then a last look, and a Bluesky post to tell your circle. A seed needs no repo
  and no developer: say what it should do, and whether someone else can run with it.
- **Forecast your rain**: your profile says what you run, roughly what you spend on AI, how much
  you have to spare right now, and who you'd like to help first: people without big plans,
  students, people on low incomes, projects that share your values.
- **Send your agent**: one click tells your friend you're on it and copies a command that
  starts Claude Code, Codex or any MCP agent with a careful brief. Turn the pull request in
  when it's up, and your friend marks it sprouted.
- **Water a garden**: everything that sprouts with your help shows on your profile as a plant
  in the garden you've watered.

**The words.** Seeding a cloud is how you ask for rain in a particular place, and what's in
the ground is what rain grows. A *seed* is an idea. A *plant* is a project, and it says how
far along it is: a *seedling*, a *young plant* or an *established plant*. Helpers *water*
them. When the work is done it has *sprouted*, whichever it was, and it's drawn one stage on:
a seed that sprouted is a seedling now.

It runs in two places, both from this repo:

| Where | What |
| --- | --- |
| **rainshare.dev** | The site: the landing, sign-in, your circle, and an example circle at `/example` that's kept in your browser. Light and dark. |
| **Your terminal and your agents** | `rainshare.mjs`: a CLI and an MCP server in one dependency-free file, served at `rainshare.dev/rainshare.mjs`. |

## The landing

Signed out, the home page is the pitch beside the water cycle: a stretch of coast, drawn in 3D
(`src/landing/`), to look around in. It's the same loop the app runs on:

| In the scene | In Rainshare | Its note links to |
| --- | --- | --- |
| **Evaporation**: mist lifts off the sea | Usage you won't get to before your plan resets | a forecast, in the example circle |
| **Condensation**: it gathers into clouds | Forecasts, sitting with the people you follow | the example circle's board |
| **Precipitation**: rain falls on seeds planted by the river | Agents sent after a friend's seed | a seed to send an agent after |
| **Collection**: the river runs back to the sea | Pull requests coming home, and the next reset | a seed that sprouted |

Picking a part (its pin, or anywhere near it in the scene) flies the camera in for a closer
look and shows a short note: what that part stands for, and a link to the screen where it
happens. "Next" walks round the cycle, and "Whole view" or Escape backs out. That's all the
explaining the page does; the rest is the scene and the board of open seeds under it.

The clouds are the ones atmosphere.online's sky is made of: each is a few hundred soft, lit
"puffs" with noisy edges (`puffs.js`, brought over from that repo's `src/puff3d.js` and
`src/sky.js`), under the same Morning and Night colours. A cloud here has a life. It starts
small over the sea, takes on puffs as it drifts inland, towers into a thunderhead over the
hills, rains, and thins out past the mountains.

There are seeds in the ground too: rows of them in plots beside the river. Rain brings one
up; once it has sprouted it holds a gold bud for a while, and then a new seed goes in. The
gold is the spark from the logo. It also rises with the mist, falls in the rain and rides the
river home.

The land, sea, river and woods are generated in code from one fixed number (`scene.js`), so
there are no models or textures to download. The scene follows the system's light or dark
setting as day or night, and has no frame: its edges fade into the page.

It's three.js, about 150 kB gzipped, and the page asks for it only when the landing is on
screen, so someone who's signed in never downloads it. It holds still when it's scrolled out
of view, when the tab is hidden, when someone presses pause, and from the start for anyone
who has asked their system to reduce motion (looking closer still works for them, as a cut
rather than a flight). A browser that can't do WebGL gets a flat drawing with all four notes
set out under it.

**The same pictures in the app.** A forecast is drawn as its sky: clear, then a cloud with
more and more rain (`skyIco` in `ui/bits.js`). A seed is drawn where it is in its life: in the
ground, being rained on once someone's on it, up once it's turned in, and sprouted (`lifeIco`).
The board counts them the same way under its heading.

The "ai" inside the name is lit in its own colour wherever the wordmark appears, and so is
the "ai" inside "rain" where the word is prominent: the headline, the pitch under it, and the
line under the board's heading (`lit` in `ui/bits.js`). It's one variable, `--lit`, in
`src/theme.css`, with a second value for dark. A screen reader hears the plain sentence.

The site is set in one typeface, Zen Maru Gothic, the same one atmosphere.online uses
(`--body` in `src/theme.css`).

## The records

Everything is a record in its owner's own account, under `dev.rainshare.*` (rainshare.dev is
the lexicon authority). The schemas are in `lexicons/dev/rainshare/`.

| Record | Written by | Says |
| --- | --- | --- |
| `dev.rainshare.profile` (`self`) | everyone | bio, setups (harness, models, plan, where it runs), AI budget, forecast, circumstances, values, priorities, the kinds of work you take on |
| `dev.rainshare.seed` | the requester | title, subject (Tangled issue, knotless issue, GitHub issue, or repo; none for a seed, which says whose the result will be), stage (for a plant), spec in Markdown, wants, tags, values, size, audience, state (`open`, `sprouted`, `closed`) |
| `dev.rainshare.take` | a helper | "my agent is on this": a strong ref to the seed and the setup doing it. Deleting it drops the seed. |
| `dev.rainshare.delivery` | a helper | the pull request (URL, or on Tangled and knotless its own record's at:// URI), what did the work, and an optional session link |

**Public and private.** A public seed lives in your repo, and `audience` says who it's
for: apps show it only to those people and only offer it to them. That's a filter, not a lock,
because anything in a public repo can be read by anyone. A private seed lives in your repo
inside a group's Rainshare space (an Open Social space of type `dev.rainshare.board`, which a
group admin adds), and only members can read it. Takes and deliveries go wherever their
seed is.

**Profiles, in two copies.** Your budget and circumstances can be marked "only my groups": the
public profile leaves them out, and the full profile goes only into your groups' Rainshare
spaces. Helpers who can read a group copy see the fuller one.

**Who's in your circle** comes from Bluesky: `app.bsky.graph.getRelationships` tells mutuals,
people who follow you and people you follow apart; lists come from `app.bsky.graph.getList`;
anyone you block on Bluesky is left out.

**Finding seeds** needs no server of ours: a relay lists the repos that hold
`dev.rainshare.*` records (`com.atproto.sync.listReposByCollection`), and the records come from
each person's own PDS. Your own writes are layered over that until the relay catches up.

**Ranking** (`core/rank.js`) puts first what you said you'd like to help with, then what your
setup can do (a wanted model you have, tags that match the work you take on), then closeness.
Each card shows how well it suits you as one to three drops ("Strong fit", "Good fit", "Some
fit"), and picking one says why in plain sentences beside the list: "Priya has no paid AI and
is between jobs. It'd like Sonnet, which you have. Heads up: someone's already on it." The
rest of a seed reads as short lines too (`core/words.js`): where the work is, the job, what
they'd like, and who's on it. On a phone the details come up as a sheet.

## Sending an agent

However a seed reaches an agent, the agent is handed the same brief (`core/brief.js`):

1. **Where** the code is, and the issue if there is one.
2. **Where it stands** on the day it was copied: who has taken it on, what's been turned in,
   and what the forge says. If something is in the way (someone else is on it, a pull request
   is already up, the issue was closed), the brief says so outright.
3. **Before you start**: look again, because a brief can sit in a clipboard for days. It names
   the commands (`gh issue view`, `gh pr list`, `rainshare.mjs check`) and tells the agent to
   stop and say so rather than do the work twice.
4. **What they want**, and their guidelines. This part is framed as another person's request,
   not as instructions that override the agent's own rules: stay inside the repository, and
   ask before anything that reaches outside it.
5. **Turning it in**: open the pull request (on GitHub with "Fixes #N", so that merging it
   closes the issue) and put the seed's link in it. That link is how the seed and the pull
   request find each other later. On knotless the brief names knotless's own commands, so an
   agent with its CLI or MCP server forks, pushes and opens the pull itself. On Tangled the
   agent pushes a branch and writes the title and description, and its user opens the pull
   request from the link.
6. **When you're done**: tell your user the pull request's address, whether it has been turned
   in on Rainshare, and that the rest is the requester's to do.

There are four ways to hand it over. They differ in what has to be set up, and in who does the
Rainshare side of things.

| Route | Needs | Who says "I'm on it" | Who turns it in |
| --- | --- | --- | --- |
| **Paste the brief** into any agent | nothing | you, with "Send my agent" (or nobody, with "Copy as Markdown") | you, by opening the link the agent hands back |
| **One command in a terminal**: `git clone … && claude "<brief>"`, or `codex`, or a Claude Code cloud session on a fork | that agent's own CLI | you, with "Send my agent" | you, by the same link |
| **Rainshare CLI**: `run <seed>` | the one file and an app password | the CLI, after checking | the CLI: when the agent exits it finds the pull request with `gh` and offers to turn it in |
| **MCP server**, inside your agent | the one file and an app password | the agent, with `rainshare_take`, which checks first | the agent, with `rainshare_turn_in` |

"Send my agent" reads the seed again and asks the forge before it writes your take. If that
turns up something the screen wasn't already showing, it asks before going on. Then it copies
whatever suits the setup in your profile: the Claude Code or Codex command, or the brief by
itself for anything else.

The link an agent hands back is
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening it fills in the
turn-in form, and sending it writes your take (if there wasn't one) and the delivery together
(`handBack` and `readHandBack` in `core/brief.js`). Once you've turned something in, the form
steps aside and the page says what's left: nothing, unless the requester asks.

## Seeds and plants

Every ask says what it is, by how far along the project is. That's what a helper sizes it up
by, and it's what the brief tells their agent first.

| | What it means | In the record |
| --- | --- | --- |
| **Seed** | An idea. Nothing's been built yet. | no `subject` |
| **Seedling** | Just started. There's a repo and a first sketch. | `stage: seedling` |
| **Young plant** | It works, and it's still taking shape. | `stage: young` |
| **Established plant** | People use it and rely on it. | `stage: established` |

Each has a small 3D model (`src/plants/models.js`): a seed lying in a mound of soil, a stem
with its first two leaves, a stem with leaves up it, and several stems in flower. They share
one mound and one framing, so how big each stands says how far along it is. A picture of each
(`public/plants/*.webp`, about 60 KB for all four) is what shows on cards, lists and the
planting step. On an ask's own page and in the planting preview the model itself turns
slowly, drawn by one shared renderer that loads only when a plant is on screen
(`src/plants/live.js`); without WebGL, or with reduced motion on, the picture stays.
`npm run plants` takes the pictures again after a model changes.

## The garden you've watered

Helping earns nothing you can spend. What it leaves is a garden: one plant on your profile for
each seed or plant that sprouted with your work, drawn as what it grew into, and each one
opens the ask it came from. Your board shows how many, beside your forecast.

It's worked out, not stored (`core/garden.js`). A helper's delivery says what they worked on,
and the planter's own record names the delivery that made it sprout, so a garden needs both
people's records to agree and nobody can add to their own. Two friends could still agree to
pad each other's, which is why it's a picture of what you've done and not a score: there's
no total to compare and no ranking of people. Only public asks count for now.

## A seed, with no repo

A seed is an idea, so it has no code to point at. Planting one asks one thing more: whose
will it be?

| | **Someone else can run with it** | **Start it for me** |
| --- | --- | --- |
| Who keeps what's built | whoever builds it, in a repo of their own | the person who asked |
| Who it's for | anyone with an idea, developer or not | someone who wants the repo but hasn't made it |
| How many can take it on | more than one, by default | one at a time, by default |
| What's asked when planting | the idea in plain words, how big it feels, tags | the same as any seed |
| What the brief tells the agent | it's your user's project: start a new repo | ask where it should live before creating anything |

Either way the brief lists where a new repo can go and the command for each, tells the agent
to look first for something that already does the job, and asks for a README that credits the
idea. What gets turned in is the repo's address, and with no merge to wait for, the person who
asked is told to have a look as soon as something is turned in. From a terminal, the
one-line commands and `run` start in a new, empty repository instead of a clone.

Rainshare doesn't make anything on a forge itself. It sends people to the right page instead
(`core/forges.js`): the new-repo page on Tangled, knotless, GitHub, Codeberg and GitLab, with
the name and description filled in where the forge takes them, and a seed's own repo, issue
and pull requests on whichever forge it lives on.

## Where a seed stands

`core/status.js` answers one question for the app, the brief, the CLI and the MCP server alike:
where does this seed stand, and what should happen next? `look` asks the forge what Rainshare's
own records can't say, and `standing` puts the two together.

| What it finds | A helper is told | The requester is told |
| --- | --- | --- |
| Nobody is on it | It's clear to start | |
| Someone has taken it on | Check with them first (unless the seed welcomes more than one helper) | |
| A pull request has been turned in, or one on the forge mentions the issue or the seed's link | Read that one before making another | |
| A turned-in pull request has been merged | It's probably done | Mark it sprouted, with one button |
| A pull request nobody turned in has been merged | It's probably done | Mark it sprouted |
| The issue was closed on the forge | Ask before starting | Mark it sprouted, or close it |
| The seed has sprouted and the issue is still open | | Close the issue on the forge |

Nothing is closed automatically. Rainshare reads the forges but can't write to them, and
whether a pull request did the job is the requester's call. So each side is shown what's left
for them at the moment they're looking: on the seed's page, in `check`, and in the brief.

A pull request that mentions a seed without having been turned in is listed on the seed's page
under "Also on GitHub" (or Tangled, or knotless). Whoever's agent opened it can turn it in from
there.

## The CLI and MCP server

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs doctor                     # what's set up here, and what will work
node ~/.rainshare.mjs login you.bsky.social      # with an app password
node ~/.rainshare.mjs board                      # your circle, best first for you
node ~/.rainshare.mjs check <seed>               # where it stands (no sign-in needed)
node ~/.rainshare.mjs run <seed>                 # check, take, clone, start your agent, turn it in
node ~/.rainshare.mjs turn-in <seed> --url <pull request>
node ~/.rainshare.mjs sprout <seed>              # your own seed: the work landed
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` look before they write. If someone else is on the seed, or a pull request is
already up, nothing is written and you're told why; `--anyway` goes ahead regardless. `run`
writes the brief to `.rainshare/SEED.md` (kept out of git), starts Claude Code (or
`--with codex`, or `--with cloud`), and when the agent exits it looks for the pull request and
offers to turn it in. `turn-in` writes a take first if you hadn't said you were on it.

The MCP tools are `rainshare_board`, `rainshare_show` (with the brief), `rainshare_check`,
`rainshare_take`, `rainshare_drop`, `rainshare_turn_in`, `rainshare_plant`,
`rainshare_close_out` (mark your own seed sprouted, closed or open again), `rainshare_profile`,
`rainshare_set_forecast` and `rainshare_whoami`. The server's instructions give an agent the
order: check, take, do the work, open the pull request with the seed's link in it, check again,
turn it in, and tell its user what's left. Without a sign-in the read-only tools still work, and
the agent is told to finish the work and hand its user the link instead.

Both sign in with an app password (saved to `~/.config/rainshare`, or from `RAINSHARE_HANDLE`
and `RAINSHARE_APP_PASSWORD`), and reach public seeds only for now: private ones are taken on
in the app.

## Bluesky, Tangled, knotless and GitHub

- **Bluesky**: your handle signs you in (OAuth with your own server), your follows make your
  circle, lists and blocks are respected, and "Share on Bluesky" and "Thank them on Bluesky"
  open the composer with a link.
- **Tangled**: pick an open issue from your own Tangled repos, or paste any tangled.org link.
  It's read through Tangled's public API (`api.tangled.org`), with the `org.tangled.*` methods
  that replaced `sh.tangled.*` when Tangled relaunched on 30 October 2026. An issue and a pull
  request are now the same kind of record, `org.tangled.track.ticket`, kept in the repo's own
  account, and a pull request is one that names a target branch. From it Rainshare reads
  whether the issue is still open and whether a delivered pull request is open, merged or
  closed. Pull requests that mention the issue or the seed's link are found through the repo's
  50 newest and through Tangled's search. Repos clone over https from their tangled.org
  address. Pull requests are opened on the web for now, so the brief has the agent push a
  branch and hand its user the link that opens one; Tangled's launch post says a CLI and agent
  skills are on the way, and the brief should change when they arrive.
- **knotless**: pick an open issue from your own knotless repos, or paste any knotless.dev
  link. knotless keeps a repo, its issues and its pulls as records in people's own accounts,
  and its public API (`knotless.dev/xrpc`) says whether an issue is open, whether a pull is
  open, merged or closed, and which pulls name an issue; pulls that carry the seed's link are
  searched for. Repos clone over plain https. A pull can be turned in by its page or by the
  `at://` address `knotless pull create` prints, and Rainshare works out the page from it.
  The brief gives the agent knotless's own commands (and the MCP tools of the same names), and
  asks for "Fixes" and the issue's address in the pull, which closes the issue when it merges.
- **GitHub**: paste an issue or repo link. The issue's title and body start you off, and its
  state is read back, along with each delivered pull request's (open, merged or closed). The
  repo's 50 most recently updated pull requests are also searched for the issue's number or
  the seed's link, to find work that wasn't turned in. All of it is GitHub's public API.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.js` | The site: the page, its routes, and who's signed in |
| `src/landing/` | The signed-out landing: `scene.js` (the coast and its weather), `puffs.js` (how a cloud is drawn), `landing.js` (looking closer, the notes and pause), `landing.css` |
| `src/plants/` | The four 3D plants: `models.js` (how each is built), `live.js` (one renderer drawing them all, turning), `sheet.html` (a page to look at them on) |
| `scripts/render-plants.mjs`, `public/plants/` | `npm run plants`, and the pictures it takes of them |
| `src/theme.css`, `src/fonts.css` | The site's look: colours, the bar, light and dark, and its typeface |
| `src/oauth.js`, `src/scope.js` | Signing in, and the OAuth scope and client metadata |
| `src/spaces.js` | Private seeds: reading and writing a group's space, and the group host's methods |
| `api/oauth-client-metadata.js` | The OAuth client document, served at `/oauth-client-metadata.json` |
| `lexicons/dev/rainshare/` | The four record types and their shared defs. `publish.mjs` publishes them under rainshare.dev. |
| `core/ns.js` | Collection names, and the words people see for every known value |
| `core/records.js` | Building each record from what people type, within the lexicons' limits |
| `core/net.js` | Public reads: identity, records from each PDS, the relay, the Bluesky graph |
| `core/subjects.js` | Tangled, knotless and GitHub: parsing links, clone URLs, issue titles and states, pull request states, pull requests that mention a seed |
| `core/circle.js` | Audiences and closeness |
| `core/rank.js` | A helper's board in order, and how well each seed fits them, with reasons |
| `core/words.js` | A seed in plain lines: where, the job, what they'd like, who's on it |
| `core/status.js` | Where a seed stands: who's on it, what's been turned in, what the forge says, and what each side should do next |
| `core/garden.js` | The garden someone has watered: what sprouted with their help, worked out from the records |
| `core/forges.js` | The right page on each forge: where to start a repo, fork one, or see its pull requests |
| `core/brief.js` | The agent brief, the link an agent hands back, and the one-paste launch commands |
| `core/markdown.js` | A small, safe Markdown renderer for specs |
| `core/source.js` | Rainshare over atproto: the board, a seed, profiles and every write, public and in group spaces |
| `core/demo.js` | The example circle, answering the same calls from fixtures and your browser's storage |
| `ui/rainshare.js`, `ui/rainshare.css` | The screens: the board (a list with the details beside it), a seed, your profile, someone's profile, agents |
| `ui/post.js` | Planting a seed or a plant: five steps, a live preview and a confirmation |
| `ui/bits.js` | Small shared pieces: escaping, times, icons, faces, and the glyphs for a forecast's sky and a seed's life |
| `cli/rainshare.mjs` | The CLI and MCP server |
| `test/` | `npm test`: the core, the data source against a fake network, and the MCP server |

## Running it

```sh
npm install
npm run dev         # the site, at http://127.0.0.1:5173
npm test            # node --test, no extra dependencies
npm run build       # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli   # just the CLI, at dist-cli/rainshare.mjs
```

Sign-in in dev uses atproto's loopback client, so open the dev server at `http://127.0.0.1:<port>`
rather than `localhost`.

The typeface is bundled with the site (`src/fonts.css`), so the page makes no requests to a
font host. Only its Latin ranges are included; names in other scripts fall back to the
reader's own fonts.

## Deploying rainshare.dev

It's a Vercel project on this repo (`vercel.json`):

1. Import the repo with the framework preset Vite. The build command is `npm run build`.
2. Add the domain `rainshare.dev`. `/oauth-client-metadata.json` serves the OAuth client for
   whichever host the request came in on, so preview URLs can sign in too.
3. Publish the lexicons: `node lexicons/publish.mjs` as the account that should own them, then
   add the `_lexicon.rainshare.dev` TXT record it prints.

The link-preview image (`public/og.jpg`) is referenced at `https://rainshare.dev/og.jpg`, so
previews show it once that domain is live.

## What's been checked, and what hasn't

Checked: the core and the data source pass their tests, including every audience, blocks, and
writes against a fake network; the MCP server's handshake and tools; the production build and
its bundled CLI. The records the app builds (`core/records.js`: seeds for every audience,
profiles, takes and deliveries) validate against the lexicons with `@atproto/lexicon`. That
was a one-off check and isn't part of `npm test` yet. In a headless browser: the
landing in light and dark from 360 to 1680 pixels wide with no sideways scrolling; looking
closer at each part by its pin, by tapping the scene and from the keyboard; Next, Whole view
and Escape; pause, reduced motion, the fallback without WebGL; and the example circle,
including sending an agent, turning a pull request in, the warning when someone is already on
a seed, and marking your own seed sprouted after a merge.

Not yet checked:

- Signing in with a real account, writing to a real PDS, and private seeds in a real
  group. Private ones depend on the spaces alpha and on opensocial.fyi accepting a
  `dev.rainshare.board` space; if it doesn't yet, public seeds still work.
- The signed-out board against the live relay and AppView from this repo. The code that reads
  them is unchanged from the prototype, where it was checked.
- GitHub's side of `look` (`core/status.js`) has only been run against made-up answers. Two
  things to watch when it meets GitHub: a browser that isn't signed in may ask 60 things an
  hour, after which the forge's side is left unknown rather than guessed; and matching by
  "#N" finds any pull request whose text mentions the issue, including ones that only refer
  to it in passing.
- Tangled: the lookups were run against `api.tangled.org` on 11 November 2026, read-only, on
  Tangled's own `core` repo (repos, open issues, an open and a closed issue, an open and a
  merged pull request, and the pull request that closes an issue). Not checked: an agent
  pushing to a Tangled fork and the link that push prints, picking an issue from your own
  repos while signed in, cloning (tangled.org answers with a redirect to the repo's knot,
  which was seen but not followed), and repos on knots other than Tangled's own.
- knotless: the lookups were run against `knotless.dev` on 11 November 2026, read-only, on a
  public repo there (a person's repos, a repo's open issues, an open and a closed issue, a
  merged pull by its page and by its record, and the pull that names an issue). Its API
  allows requests from other sites, and a repo's git address answered. Not checked: an agent
  forking, pushing and opening a pull with the knotless CLI or MCP server (the commands in
  the brief are from knotless's docs, not from running them), private repos, and knotless
  servers other than knotless.dev, which Rainshare doesn't recognise as knotless yet.
- Ideas: planting one, running with one and turning it in were checked in the example circle.
  The pages Rainshare links to on Tangled exist (they ask you to sign in). GitHub's new-repo
  page taking a name and description from the link is from memory, not checked from here; if
  it doesn't, the page still opens, just empty.
- The plants: the four models, their pictures, the turning model on a page and in the planting
  preview, and the garden were checked in the example circle, on a software renderer and at
  phone width. Not checked: how the turning model runs on a real GPU or an old phone, and a
  garden worked out from real records on the network (it needs a real planter to have marked
  a real delivery).
- The CLI's `run` end to end with a real agent: starting it, finding the pull request with
  `gh` afterwards, and turning it in.
- How smoothly the scene runs on real phones and older laptops. It has only been run on a
  software renderer so far, which says it draws correctly and nothing about frame rate.
