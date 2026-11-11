# Rainshare

*Got rain to spare? Your friends have seeds in the ground.*

AI plans reset whether you use them or not. On Rainshare, the people you trust plant seeds:
things they'd like done in their repos. The agent usage you have left over is the rain.
It's an atproto-native, social take on [Overflow](https://github.com/Nitjsefnie/Overflow):
no ledger and no points, just your circle.

- **Plant a seed**, in five short steps with a preview beside them: where the work is (a
  Tangled or GitHub issue, any git repo, or just an idea), what done looks like, how (models,
  tests, size), and who it's for: public for your mutuals (or people you follow, your
  followers, a Bluesky list, everyone), with a count of roughly who that reaches, or private
  to a group. Then a last look, and a Bluesky post to tell your circle.
- **Forecast your rain**: your profile says what you run, roughly what you spend on AI, how much
  you have to spare right now, and who you'd like to help first: people without big plans,
  students, people on low incomes, projects that share your values.
- **Send your agent**: one click tells your friend you're on it and copies a command that
  starts Claude Code, Codex or any MCP agent with a careful brief. Turn the pull request in
  when it's up, and your friend marks it sprouted.

**Why "seed".** It works two ways. Seeding a cloud is how you ask for rain in a particular
place, and a seed in the ground is what rain grows. When the work is done, the seed has
sprouted.

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
| `dev.rainshare.seed` | the requester | title, subject (Tangled issue, GitHub issue, or repo), spec in Markdown, wants, tags, values, size, audience, state (`open`, `sprouted`, `closed`) |
| `dev.rainshare.take` | a helper | "my agent is on this": a strong ref to the seed and the setup doing it. Deleting it drops the seed. |
| `dev.rainshare.delivery` | a helper | the pull request (URL, or a Tangled pull's at:// URI), what did the work, and an optional session link |

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

**With nothing set up.** Every seed has a "Copy as Markdown" button, which copies the brief
for pasting into any agent. An agent with no Rainshare of its own is asked to finish with a
link back to the seed that carries the pull request:
`rainshare.dev/seed/<handle>/<key>?pr=<pull request>&model=<model>`. Opening that link fills
in the turn-in form, and sending it writes your take and the delivery together
(`handBack` and `readHandBack` in `core/brief.js`).

**With the CLI or MCP server.** "Send my agent" writes your take, then offers commands that
each paste as one line into a terminal (`core/brief.js`):

- **Rainshare CLI**: `run` takes it on, clones the repo, writes the brief to
  `.rainshare/SEED.md` (kept out of git) and starts Claude Code (or `--with codex`, or
  `--with cloud` for a Claude Code cloud session on a fork).
- **Claude Code** and **Codex**: `git clone … && claude "<brief>"`, with no install.
- **Claude Code in the cloud** (GitHub): `gh repo fork … --clone && claude --cloud "<brief>"`.
- **Any agent, through MCP**: add the server once, then ask your agent to take it on.

The brief tells the agent where the code is, what the requester wants, how to turn it in, and
that the spec is another person's request rather than instructions that override its own rules:
it should stay inside the repository and check before anything that reaches outside it.

## The CLI and MCP server

```sh
curl -fsSL https://rainshare.dev/rainshare.mjs -o ~/.rainshare.mjs
node ~/.rainshare.mjs login you.bsky.social      # with an app password
node ~/.rainshare.mjs board                      # your circle, best first for you
node ~/.rainshare.mjs run <seed>            # take, clone, start your agent
node ~/.rainshare.mjs turn-in <seed> --url <pull request>
claude mcp add rainshare -- node ~/.rainshare.mjs mcp
```

The MCP tools are `rainshare_board`, `rainshare_show` (with the brief), `rainshare_take`,
`rainshare_drop`, `rainshare_turn_in`, `rainshare_plant`, `rainshare_profile` and
`rainshare_set_forecast`. It signs in with an app password (saved to `~/.config/rainshare`, or
from `RAINSHARE_HANDLE` and `RAINSHARE_APP_PASSWORD`), and reaches public seeds only for
now: private ones are taken on in the app.

## Bluesky, Tangled and GitHub

- **Bluesky**: your handle signs you in (OAuth with your own server), your follows make your
  circle, lists and blocks are respected, and "Share on Bluesky" and "Thank them on Bluesky"
  open the composer with a link.
- **Tangled**: pick an open issue from your own Tangled repos (through Tangled's public API,
  `api.tangled.org`), or paste any tangled.org link. Repos clone over https, a delivery can be a
  Tangled pull's at:// URI, and its state is read back from Tangled.
- **GitHub**: paste an issue or repo link. The issue's title and body start you off, and a
  delivered pull request shows as open, merged or closed (GitHub's public API).

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.js` | The site: the page, its routes, and who's signed in |
| `src/landing/` | The signed-out landing: `scene.js` (the coast and its weather), `puffs.js` (how a cloud is drawn), `landing.js` (looking closer, the notes and pause), `landing.css` |
| `src/theme.css`, `src/fonts.css` | The site's look: colours, the bar, light and dark, and its typeface |
| `src/oauth.js`, `src/scope.js` | Signing in, and the OAuth scope and client metadata |
| `src/spaces.js` | Private seeds: reading and writing a group's space, and the group host's methods |
| `api/oauth-client-metadata.js` | The OAuth client document, served at `/oauth-client-metadata.json` |
| `lexicons/dev/rainshare/` | The four record types and their shared defs. `publish.mjs` publishes them under rainshare.dev. |
| `core/ns.js` | Collection names, and the words people see for every known value |
| `core/records.js` | Building each record from what people type, within the lexicons' limits |
| `core/net.js` | Public reads: identity, records from each PDS, the relay, the Bluesky graph |
| `core/subjects.js` | Tangled and GitHub: parsing links, clone URLs, issue titles, pull request states |
| `core/circle.js` | Audiences and closeness |
| `core/rank.js` | A helper's board in order, and how well each seed fits them, with reasons |
| `core/words.js` | A seed in plain lines: where, the job, what they'd like, who's on it |
| `core/brief.js` | The agent brief, and the one-paste launch commands |
| `core/markdown.js` | A small, safe Markdown renderer for specs |
| `core/source.js` | Rainshare over atproto: the board, a seed, profiles and every write, public and in group spaces |
| `core/demo.js` | The example circle, answering the same calls from fixtures and your browser's storage |
| `ui/rainshare.js`, `ui/rainshare.css` | The screens: the board (a list with the details beside it), a seed, your profile, someone's profile, agents |
| `ui/post.js` | Planting a seed: five steps, a live preview and a confirmation |
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
and Escape; pause, reduced motion, the fallback without WebGL; and the example circle.

Not yet checked:

- Signing in with a real account, writing to a real PDS, and private seeds in a real
  group. Private ones depend on the spaces alpha and on opensocial.fyi accepting a
  `dev.rainshare.board` space; if it doesn't yet, public seeds still work.
- The signed-out board against the live relay and AppView from this repo. The code that reads
  them is unchanged from the prototype, where it was checked.
- How smoothly the scene runs on real phones and older laptops. It has only been run on a
  software renderer so far, which says it draws correctly and nothing about frame rate.
