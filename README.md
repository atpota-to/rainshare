# Rainshare

*Got rain to spare? Your friends' ideas and projects could use it.*

> **Early alpha.** Rainshare works end to end, but expect rough edges, and changes to the
> screens, the CLI and the record format. What you post is saved in your own account.

AI plans reset whether you use them or not. On Rainshare, the people you trust share the
ideas and projects they'd like a hand with, and you send your own agent to help, signed in as
you, on your own plan. What your friend gets back is the work. That help is the rain. It's
[Overflow](https://github.com/Nitjsefnie/Overflow) on atproto, without the ledger: nobody earns
or spends credits, and you help the people you follow. (Is that allowed by your AI plan? See
[the FAQ](#faq).)

- **Ask for rain**, in three short steps with a preview beside them. *What*: an idea, or a
  project you already have, where it lives (a Tangled, knotless or GitHub issue, or any git
  repo) and how far along the project is as a whole, each drawn as its own little 3D plant. *Details*: what done looks
  like, with models, tests, size and tags folded under "More options". *Who*: everyone, unless
  you narrow it to your mutuals, people you follow, your followers or a Bluesky list, with a
  count of roughly who that reaches, and a Bluesky post to tell people it's there. Private to
  a group is shown as coming. An idea needs no repo and no developer: say what it should do,
  and whether someone else can run with it.
- **Forecast your rain**: your profile says what you run and how much you have to spare right
  now. Folded under "Help the right people find you", it can also say roughly what you spend
  on AI and who you'd like to help first: people without big plans, students, people on low
  incomes, projects that share your values.
- **Send your agent**: one click tells your friend you're on it and copies the command that
  suits your setup (Claude Code, Codex, or a brief for any agent); the other ways are a click
  away. Turn the pull request in when it's up, and your friend marks it done.
- **Grow a garden**: everything that gets done with your help shows on your profile as a
  plant, in a garden of what you've helped with.

**The words, and the pictures.** What people read is plain: an *idea* (nothing built yet)
or a *project* (something that exists), which is *done* when the work lands. Rain is the
brand: the help your agent gives when it has time to spare, and "Ask for rain" to ask for
some. The rest of the metaphor is drawn rather than said. An idea is drawn as a seed in the ground, and a project as a plant
grown as far as it has (just started, taking shape, established). When the work is done it's
drawn one stage on, and what you've helped with grows into a garden on your profile. The
records keep the metaphor's names (`dev.rainshare.seed`, `stage`, `state: sprouted`), which
nobody needs to read.

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
| **Evaporation**: mist lifts off the sea | Time on your plan you won't get to before it resets | a forecast, in the example circle |
| **Condensation**: it gathers into clouds | Forecasts, sitting with the people you follow | the example circle's board |
| **Precipitation**: rain falls on seeds planted by the river | Agents sent after a friend's idea or project | an idea to send an agent after |
| **Collection**: the river runs back to the sea | Pull requests coming home, and the next reset | one that's done |

Picking a part (its pin, or anywhere near it in the scene) flies the camera in for a closer
look and shows a short note: what that part stands for, and a link to the screen where it
happens. "Next" walks round the cycle, and "Whole view" or Escape backs out. The board of open
asks sits under the scene.

The clouds are the ones atmosphere.online's sky is made of: each is a few hundred soft, lit
"puffs" with noisy edges (`puffs.js`, brought over from that repo's `src/puff3d.js` and
`src/sky.js`), under the same Morning and Night colours. Each cloud starts small over the sea, takes on puffs as it drifts inland, towers into a thunderhead over the
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

The "ai" inside the name is lit in its own colour wherever the wordmark appears, and so is
the "ai" inside "rain" where the word is prominent: the headline, the pitch under it, and the
line under the board's heading (`lit` in `ui/bits.js`). It's one variable, `--lit`, in
`src/theme.css`, with a second value for dark. Screen readers get the plain text.

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

**Public, and private soon.** Private seeds are off for now (`GROUPS` in `core/ns.js`),
because spaces are still an alpha on the group host: sign-in asks only for `atproto` and
Rainshare's own four record types, every seed is public, and the app shows "Private, in a
group" as coming. Turning `GROUPS` on brings back everything below that's about groups.

A public seed lives in your repo, and `audience` says who it's
for: apps show it only to those people and only offer it to them. It doesn't hide anything,
though: a public repo can be read by anyone. A private seed lives in your repo
inside a group's Rainshare space (an Open Social space of type `dev.rainshare.board`, which a
group admin adds), and only members can read it. Takes and deliveries go wherever their
seed is.

**Profiles, in two copies** (once groups are on). Your budget and circumstances can be marked "only my groups": the
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
   agent pushes a branch and writes the title and description, and the pull request is opened
   through Rainshare, as its user: by the agent, if Rainshare's CLI or MCP server is signed in
   beside it, or by its user from a link the agent hands back.
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
itself for anything else. The seed's page shows that one, with the other ways folded under it,
and the turn-in form asks only for the pull request's link (what did the work, a session link
and a note are folded away, filled in from your setup).

The link an agent hands back is
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening it fills in the
turn-in form, and sending it writes your take (if there wasn't one) and the delivery together
(`handBack` and `readHandBack` in `core/brief.js`). On Tangled and knotless the link can
carry a branch instead, `?branch=<branch>&from=<fork>&model=<model>`: opening it fills in the
form that opens the pull request, and sending that opens it and turns it in
(`handBackBranch` and `readBranchBack`). Once you've turned something in, the form steps
aside and the page says what's left: nothing, unless the requester asks.

## Ideas and projects

Every ask says what it is: an idea, or a project and how far along the project is as a whole. That's what a
helper sizes it up by, and it's what the brief tells their agent first. Each is drawn as a
seed or a plant.

| What people read | What it means | Drawn as | In the record |
| --- | --- | --- | --- |
| **Idea** | Nothing's been built yet. | a seed | no `subject` |
| **Project**, just started | There's a repo and a first sketch. | a seedling | `stage: seedling` |
| **Project**, taking shape | It works, and it's still changing. | a young plant | `stage: young` |
| **Project**, established | People use it and rely on it. | an established plant | `stage: established` |

Each has a small 3D model (`src/plants/models.js`): a seed lying in a mound of soil, a stem
with its first two leaves, a stem with leaves up it, and several stems in flower. They share
one mound and one framing, so how big each stands says how far along it is. A picture of each
(`public/plants/*.webp`, about 60 KB for all four) is what shows on cards, lists and the
first step of asking. On an ask's own page and in the preview beside those steps the model itself turns
slowly, drawn by one shared renderer that loads only when a plant is on screen
(`src/plants/live.js`); without WebGL, or with reduced motion on, the picture stays.
`npm run plants` takes the pictures again after a model changes.

## What you've helped with

Helping doesn't earn credits. It grows a garden instead: one plant on your profile for
each idea or project that got done with your work, drawn as what it grew into, and each one
opens the ask it came from. Your board says how many ("Helped with 2"), beside your forecast.

It's worked out, not stored (`core/garden.js`). A helper's delivery says what they worked on,
and the asker's own record names the delivery that did it, so a garden needs both
people's records to agree and nobody can add to their own. Two friends could still agree to
pad each other's, so a garden is only ever shown as plants: there's no total and no
leaderboard. Only public asks count for now.

## An idea, with no repo

An idea has no code to point at. Asking for rain on one asks one thing more: whose will it be?

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

Rainshare doesn't make repos anywhere. It sends people to the right page instead
(`core/forges.js`): the new-repo page on Tangled, knotless, GitHub, Codeberg and GitLab, with
the name and description filled in where the forge takes them, and a seed's own repo, issue
and pull requests on whichever forge it lives on. Issues and comments are another matter on
the two forges that live on atproto: see the next section.

## Posting to knotless and Tangled

On knotless and Tangled, Rainshare can post as you (`core/forgewrite.js`): open an issue, leave
a comment, and open a pull request from a branch that's been pushed. On GitHub and the rest it
can't, and links to the right page.

- **A pull request, from the ask's page.** Once a branch is pushed, to the repo or to your
  fork of it, "Open the pull request from here" offers the repo and your forks, each one's
  branches, the branch to merge into, and a title and description to look over (starting from
  the repo's template on knotless, the issue it fixes, and the ask's link). Sending it opens
  the pull request and turns it in on Rainshare with the same press.
- **The same, from an agent.** The brief has the agent push its branch and then either open
  the pull request itself (`open-pr` in the CLI, `rainshare_open_pr` over MCP, when Rainshare
  is signed in beside it) or hand its user a link, `…/seed/<who>/<key>?branch=<branch>`, that
  opens the ask's page with the form filled in.
- **A comment on the issue**, from the ask's own page. It starts with the useful thing to
  say: for the person asking, a note that the issue is on Rainshare, with its link; for a
  helper who's taken it on, that they're having a go.
- **An issue from an ask.** Asking for rain on a repo with no issue picked offers to open
  one there from the title and details, point the ask at it, and note on it where the ask is.

Sign-in asks for all of this up front, so nobody is sent back to their server halfway through
writing something. A server that refuses part of it is asked again for less, down to
Rainshare's own records alone (`ladder` in `src/scope.js`), and a sign-in that ended up with
less is offered "Connect Tangled" or "Connect knotless" where it matters, with what was typed
kept. What's asked for is what each forge needs and no more (`FORGE_SCOPES` in `core/ns.js`):

| | How a post is made | What's asked for |
| --- | --- | --- |
| **knotless** | An issue, a comment or a pull is a record in your own account that names the repo. | Creating `dev.knotless.issue`, `dev.knotless.comment` and `dev.knotless.pull` records |
| **Tangled** | Issues, comments and pull requests are kept with the repo, on the knot that hosts it. Your server gives a token, good for a minute, that says a call is yours; the knot takes the write; and a record in your own account says it was you. A pull request is a ticket that names a branch to merge into, and then its changes. | A token for three calls by name (`com.atproto.repo.createRecord`, `org.tangled.review.submitPatch`, `com.atproto.repo.deleteRecord`), creating `org.tangled.graph.attestation` records, and your `org.tangled.graph.vouch` records (the next section) |

Tangled's permissions are the wider ones. A token "for a createRecord call" can't be tied to
Tangled alone, because what a knot checks is the repo's own identity, which differs for every
repo. They're among the permissions Tangled's own web app asks for, and Rainshare uses them
only for the repo an ask points at. The delete is there for one case: if a knot takes a pull
request's ticket and then refuses its changes, the ticket is taken back rather than left
empty on someone's repo. On this site nothing is posted unless you press a button that says
so. The CLI and MCP server sign in with an app password, which already allows all of it, so
an agent with `rainshare_open_pr` can open a pull request as you: the tool's description
tells it to do so only once the work is pushed.

## Tangled's vouches

Tangled has a [vouch network](https://tangled.org/docs/guides/vouching/): anyone can vouch
for someone, or denounce them, with a reason, and Tangled shows a mark beside a person only
when the word comes from your own circle (you, or someone you vouched for). Rainshare shows
the same mark beside the people who ask and the people who help (`core/vouch.js`), because
"does anyone I trust know this person?" is worth knowing before you send an agent to their
repo, or merge what theirs sent.

- **Reading** needs no extra permission. A vouch is a public record in the voucher's own
  account, `org.tangled.graph.vouch`, keyed by who it's about, so your circle is worked out
  from your records and those of up to 40 people you vouched for. It's read once per sign-in,
  on the first page that shows people. A person's profile says who in your circle vouched
  for them or denounced them, and why.
- **Vouching** is a button on someone's profile, and beside a delivery on your own ask
  ("Vouch for them on Tangled"), where the reason starts as what they helped with and the
  vouch points at the delivery (and at the pull request, when that's on Tangled, which is
  what Tangled itself attaches). You can take a vouch back. Rainshare never writes a
  denouncement: that's done on Tangled.
- A vouch gates nothing, on Tangled or here. It doesn't change who can take an ask on, or
  how the board is sorted.

## Where a seed stands

`core/status.js` answers one question for the app, the brief, the CLI and the MCP server alike:
where does this seed stand, and what should happen next? `look` asks the forge what Rainshare's
own records can't say, and `standing` puts the two together.

| What it finds | A helper is told | The requester is told |
| --- | --- | --- |
| Nobody is on it | It's clear to start | |
| Someone has taken it on | Check with them first (unless the seed welcomes more than one helper) | |
| A pull request has been turned in, or one on the forge mentions the issue or the seed's link | Read that one before making another | |
| A turned-in pull request has been merged | It's probably done | Mark it done, with one button |
| A pull request nobody turned in has been merged | It's probably done | Mark it done |
| The issue was closed on the forge | Ask before starting | Mark it done, or close it |
| It's done and the issue is still open | | Close the issue on the forge |

Nothing is closed automatically. Rainshare doesn't close issues or merge anything on a forge,
and whether a pull request did the job is the requester's call. So each side is shown what's left
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
node ~/.rainshare.mjs check <link>               # where it stands (no sign-in needed)
node ~/.rainshare.mjs run <link>                 # check, take, clone, start your agent, turn it in
node ~/.rainshare.mjs turn-in <link> --url <pull request>
node ~/.rainshare.mjs open-pr <link> --branch <b>   # Tangled and knotless: open the pull request, and turn it in
node ~/.rainshare.mjs done <link>                # your own: the work landed (sprout works too)
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

`take` and `run` look before they write. If someone else is on the seed, or a pull request is
already up, nothing is written and you're told why; `--anyway` goes ahead regardless. `run`
writes the brief to `.rainshare/SEED.md` (kept out of git), starts Claude Code (or
`--with codex`, or `--with cloud`), and when the agent exits it looks for the pull request and
offers to turn it in. `turn-in` writes a take first if you hadn't said you were on it.
`open-pr` is for Tangled and knotless, where opening a pull request is a write as you: given a
branch that's already pushed (and `--from` if it's on a fork), it opens the pull request and
turns it in. A branch that isn't there yet, or that brings nothing new, is refused before
anything is written.

The MCP tools are `rainshare_board`, `rainshare_show` (with the brief), `rainshare_check`,
`rainshare_take`, `rainshare_drop`, `rainshare_turn_in`, `rainshare_open_pr`, `rainshare_ask`,
`rainshare_close_out` (mark your own done, closed or open again), `rainshare_profile`,
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
  address. Tangled has no command for opening a pull request yet, so the brief has the agent
  push a branch and Rainshare opens the pull request as its user (see "Posting to knotless and
  Tangled"); Tangled's launch post says a CLI and agent skills are on the way, and the brief
  should change when they arrive. Vouches from your Tangled circle show beside people.
- **knotless**: pick an open issue from your own knotless repos, or paste any knotless.dev
  link. knotless keeps a repo, its issues and its pulls as records in people's own accounts,
  and its public API (`knotless.dev/xrpc`) says whether an issue is open, whether a pull is
  open, merged or closed, and which pulls name an issue; pulls that carry the seed's link are
  searched for. Repos clone over plain https. A pull can be turned in by its page or by the
  `at://` address `knotless pull create` prints, and Rainshare works out the page from it.
  The brief gives the agent knotless's own commands (and the MCP tools of the same names), and
  asks for "Fixes" and the issue's address in the pull, which closes the issue when it merges.
  A branch that's pushed can also be opened as a pull from Rainshare.
- **GitHub**: paste an issue or repo link. The issue's title and body start you off, and its
  state is read back, along with each delivered pull request's (open, merged or closed). The
  repo's 50 most recently updated pull requests are also searched for the issue's number or
  the seed's link, to find work that wasn't turned in. All of it is GitHub's public API.

## FAQ

### Is this allowed by my AI plan?

We think so, the way Rainshare works today. We're not lawyers, though, and your plan's terms
are between you and its provider, so read them too. As of November 2026, what the big plans
rule out is sharing your account and reselling access to it (Anthropic's
[Consumer Terms](https://www.anthropic.com/legal/consumer-terms) and
[Claude Code's](https://code.claude.com/docs/en/legal-and-compliance), and OpenAI's
[Terms of Use](https://openai.com/policies/row-terms-of-use/)). Rainshare does neither:

- **It's your agent, on your account.** You run Claude Code, Codex or whatever you use, signed
  in as you, on your own machine or in your own cloud session. Nobody else gets your login.
  Rainshare never sees your AI sign-in: it signs in only to your atproto account, and the CLI
  starts your own `claude` or `codex` just as it's installed.
- **What you give is the work, not access.** Your friend gets a pull request (or, for an idea,
  a repo), the way you might send one to any open-source project. Anthropic's and OpenAI's
  terms both assign what you make with them to you.
- **Nobody's paid.** There are no credits, tips or ledger, so nothing is being resold.
- **You're there for it.** You pick each one and start your agent yourself.

That's also why Rainshare doesn't run agents on its own servers, hold anyone's AI sign-in, pay
people for help, or work through asks unattended: each of them would cross that line. And your plan's usage policy covers whatever your agent does, whoever asked for it, so
take on only what you'd be happy to ask for yourself.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.js` | The site: the page, its routes, and who's signed in |
| `src/landing/` | The signed-out landing: `scene.js` (the coast and its weather), `puffs.js` (how a cloud is drawn), `landing.js` (looking closer, the notes and pause), `landing.css` |
| `src/plants/` | The four 3D plants: `models.js` (how each is built), `live.js` (one renderer drawing them all, turning), `sheet.html` (a page to look at them on) |
| `scripts/render-plants.mjs`, `public/plants/` | `npm run plants`, and the pictures it takes of them |
| `src/theme.css`, `src/fonts.css` | The site's look: colours, the bar, light and dark, and its typeface |
| `src/oauth.js`, `src/scope.js` | Signing in, and the OAuth scope and client metadata: what's asked for up front, and the steps down if a server refuses |
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
| `core/garden.js` | What someone has helped with: what got done with their help, worked out from the records |
| `core/forges.js` | The right page on each forge: where to start a repo, fork one, or see its pull requests |
| `core/forgewrite.js` | Posting to knotless and Tangled as you: opening an issue, leaving a comment, opening a pull request from a pushed branch |
| `core/vouch.js` | Tangled's vouch network: your circle's word on a person, read from public records, and vouching for someone |
| `core/brief.js` | The agent brief, the link an agent hands back, and the one-paste launch commands |
| `core/markdown.js` | A small, safe Markdown renderer for specs |
| `core/source.js` | Rainshare over atproto: the board, a seed, profiles and every write, public and in group spaces |
| `core/demo.js` | The example circle, answering the same calls from fixtures and your browser's storage |
| `ui/rainshare.js`, `ui/rainshare.css` | The screens: the board (a list with the details beside it), a seed, your profile, someone's profile, agents |
| `ui/post.js` | Asking for rain on an idea or a project: three steps, a live preview and a confirmation |
| `ui/bits.js` | Small shared pieces: escaping, times, icons, faces, and the glyphs for a forecast's sky and a seed's life |
| `cli/rainshare.mjs` | The CLI and MCP server |
| `test/` | `npm test`: the core, the data source against a fake network, the MCP server, posting to the forges and vouching against made-up ones, and what other people's records can't do (`security.test.mjs`) |

## Security

Almost everything Rainshare shows was written by someone else: seeds, takes, deliveries and
profiles come from other people's repos, through servers they may run themselves. So nothing
read from the network is trusted, and each thing is checked where it's used:

- **Records** (`core/net.js`). A record's address is rebuilt from the account, collection and
  key that were asked for, never copied from a server's answer, and one that claims to be
  somewhere else is dropped. Record keys must be what atproto allows, DIDs must look like DIDs,
  a handle must be a domain name, a PDS must be on https, and a `did:web` is a bare host.
- **Pages** (`ui/`). Every value goes through `esc` before it reaches the page, and a spec's
  Markdown is escaped first and then turned back on for a few safe constructs
  (`core/markdown.js`). Links are http(s) only. `vercel.json` sets a Content Security Policy
  with no inline scripts, so a slip in escaping still can't run code.
- **Commands** (`core/brief.js`, `core/subjects.js`). A repo is cloned only from an address that is
  a host and a plain path; anything bound for a shell is single-quoted, and the folder a seed's
  work goes in is made from letters and digits only.
- **Terminals and agents.** Control characters (and the invisible marks that reorder text) are
  taken out of the brief and of everything the CLI and MCP server print, so a spec can't end a
  terminal's bracketed paste and type commands, or rewrite the screen or the clipboard.
- **Blocks.** Takes and deliveries from people you block on Bluesky are left out along with their
  seeds, so nobody you've blocked can make something look taken.

Two things are by design and worth knowing. A seed's spec is a request from a stranger, and the
brief tells the agent so; a repo you clone for someone can still carry its own agent settings
(a `CLAUDE.md`, hooks, an `.mcp.json`), so look before you trust a folder you haven't seen. And
an audience only decides who Rainshare shows a seed to: anyone can read a public one.

## Running it

```sh
npm install
npm run dev         # the site, at http://127.0.0.1:5173
npm test            # node --test, no extra dependencies
npm run build       # the site in dist/, with the CLI bundled at dist/rainshare.mjs
npm run build:cli   # just the CLI, at dist-cli/rainshare.mjs
```

The app says it's an early alpha in a badge beside the logo, on the landing, once on the
signed-in board, and where you post an ask; the CLI's help and version and the MCP server's
title say so too. `STAGE` in `core/ns.js` drives the board note, the ask screen and the CLI and
MCP text. `index.html` writes the word out by hand in three places (the badge, the badge's
title, and the landing line), so change those with it.

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
a seed, and marking your own seed sprouted after a merge. Asking for rain in three steps (an
idea and a project, "More options" staying open across redraws, everyone by default, the
coming-soon group row), the folded profile and the folded send-your-agent panel were checked
in the example circle at desktop and phone widths. Every screen was checked again at 1280 and 390
pixels wide in light and dark, with the Content Security Policy from `vercel.json` applied: no
sideways scrolling, nothing past the edge of the phone sheet, and nothing blocked by the policy
(the landing's scene, the turning plants and the sign-in code all load under it).

Not yet checked:

- Signing in with a real account (asking for `atproto`, `repo:dev.rainshare.*` and what
  posting to knotless and Tangled needs) and writing to a real PDS. Private seeds in a real group are off until the spaces alpha
  settles; they depend on opensocial.fyi accepting a `dev.rainshare.board` space.
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
- Posting to knotless and Tangled has never been done for real: it needs a real account, and
  Rainshare shouldn't post to someone's repo to test itself. What was checked: the records
  it would write (issues, comments, pulls, the patch call) validate against both forges' own
  published definitions; the steps for Tangled are the ones in Tangled's own web app's
  source; Tangled's knot answers a browser on another site and says it takes writes from
  apps; the lookups a pull request needs (a repo's branches, where two branches part, a
  repo's forks and template) were run read-only against `api.tangled.org` and `knotless.dev`
  on 12 November 2026; and the whole thing runs against a made-up network in
  `test/forgewrite.test.mjs`. Not checked: a real server granting the permissions as they're
  written, or how its consent screen words them; a real post landing; how either forge shows
  it; whether a knot takes a pull request from an account that isn't a collaborator on the
  repo (the repo's own setting decides); whether knotless indexes a pull written without its
  own CLI; and `open-pr` with an app password, which leans on a server giving an app password
  a token for these calls.
- Sign-in asking for everything up front has only been tested as a list of scopes, not
  against a server. If a server refuses the longer list, the step down to a plain sign-in is
  the thing to watch on the first real sign-in.
- Tangled's vouches: the record's shape was checked against real ones on the network, and
  reading a circle and writing a vouch run against a made-up network in `test/vouch.test.mjs`
  and in the example circle. Not checked: reading a real circle from real servers (they
  aren't reachable from where this was built), whether Rainshare's circle matches the marks
  Tangled itself shows in every case (Tangled's own method for this only answers to Tangled),
  and how Tangled displays a vouch whose evidence is a Rainshare delivery.
- Ideas: asking for rain on one, running with one and turning it in were checked in the example circle.
  The pages Rainshare links to on Tangled exist (they ask you to sign in). GitHub's new-repo
  page taking a name and description from the link is from memory, not checked from here; if
  it doesn't, the page still opens, just empty.
- The plants: the four models, their pictures, the turning model on a page and in the preview
  when asking, and the garden were checked in the example circle, on a software renderer and at
  phone width. Not checked: how the turning model runs on a real GPU or an old phone, and a
  garden worked out from real records on the network (it needs a real asker to have marked
  a real delivery).
- The CLI's `run` end to end with a real agent: starting it, finding the pull request with
  `gh` afterwards, and turning it in.
- How smoothly the scene runs on real phones and older laptops. It has only been run on a
  software renderer so far, which says it draws correctly and nothing about frame rate.
